// /api/payment/payme — Payme (Paycom) JSONRPC callback handler
// Uses ac.order_id flow — order doc stored in `payments` collection
import { NextRequest, NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore } from 'firebase-admin/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ── Payme error codes ──────────────────────────────────────────────────────────
// Payme checkout extracts message.ru / message.uz / message.en — must be multilingual object
const PAYME_ERRORS = {
  INVALID_AMOUNT:        { code: -31001, message: { ru: 'Неверная сумма',            uz: "Noto'g'ri summa",              en: 'Invalid amount'            } },
  ORDER_NOT_FOUND:       { code: -31050, message: { ru: 'Заказ не найден',            uz: 'Buyurtma topilmadi',            en: 'Order not found'           } },
  ALREADY_PAID:          { code: -31051, message: { ru: 'Заказ уже оплачен',         uz: "Buyurtma to'langan",            en: 'Order already paid'        } },
  CANNOT_PERFORM:        { code: -31008, message: { ru: 'Невозможно выполнить',      uz: "Bajarib bo'lmaydi",            en: 'Cannot perform transaction' } },
  TRANSACTION_NOT_FOUND: { code: -31003, message: { ru: 'Транзакция не найдена',     uz: 'Tranzaksiya topilmadi',        en: 'Transaction not found'     } },
  UNAUTHORIZED:          { code: -32504, message: { ru: 'Ошибка авторизации',        uz: 'Avtorizatsiya xatosi',         en: 'Authorization error'       } },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function rpcError(id: unknown, err: { code: number; message: unknown }) {
  return NextResponse.json({ jsonrpc: '2.0', id, error: err })
}
function rpcOk(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id, result })
}

// Load Payme secret from Firestore; fallback to env
async function getPaymeSecret(db: FirebaseFirestore.Firestore): Promise<string> {
  try {
    const snap = await db.collection('settings').doc('main').get()
    const d = snap.data() ?? {}
    const isProduction = d.paymeMode === true || d.paymeMode === 'prod'
    return isProduction
      ? ((d.paymeSecretKey     as string) || process.env.PAYME_SECRET_KEY      || '')
      : ((d.paymeSecretKeyTest as string) || process.env.PAYME_SECRET_KEY_TEST || process.env.PAYME_SECRET_KEY || '')
  } catch {
    return process.env.PAYME_SECRET_KEY || ''
  }
}

// Verify Basic auth header: login must be 'Paycom', password = secret
function verifyPaymeAuth(authHeader: string | null, secret: string): boolean {
  if (!secret || !authHeader || !authHeader.startsWith('Basic ')) return false
  let decoded: string
  try { decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8') } catch { return false }
  const colonIdx = decoded.indexOf(':')
  if (colonIdx < 0) return false
  const login    = decoded.slice(0, colonIdx)
  const password = decoded.slice(colonIdx + 1)
  return login === 'Paycom' && password === secret
}

// Find payment doc by orderId string
async function getPaymentByOrderId(db: FirebaseFirestore.Firestore, orderId: string) {
  const snap = await db.collection('payments').where('orderId', '==', orderId).limit(1).get()
  return snap.empty ? null : snap.docs[0]
}

// ─── CheckPerformTransaction ──────────────────────────────────────────────────
async function checkPerformTransaction(db: FirebaseFirestore.Firestore, params: Record<string, unknown>) {
  const account = params.account as { order_id?: unknown } | undefined
  const orderId = String(account?.order_id ?? '')
  if (!orderId) return { error: PAYME_ERRORS.ORDER_NOT_FOUND }

  const paymentDoc = await getPaymentByOrderId(db, orderId)
  if (!paymentDoc) return { error: PAYME_ERRORS.ORDER_NOT_FOUND }

  const payment = paymentDoc.data()
  if (payment.status === 'completed') return { error: PAYME_ERRORS.ALREADY_PAID }

  const expectedTiyin = Math.round(Number(payment.amountUZS || 0) * 100)
  if (Number(params.amount) !== expectedTiyin) return { error: PAYME_ERRORS.INVALID_AMOUNT }

  return { result: { allow: true } }
}

// ─── CreateTransaction ────────────────────────────────────────────────────────
async function createTransaction(db: FirebaseFirestore.Firestore, params: Record<string, unknown>) {
  const paymeId = params.id as string
  const account = params.account as { order_id?: unknown } | undefined
  const orderId = String(account?.order_id ?? '')
  if (!orderId) return { error: PAYME_ERRORS.ORDER_NOT_FOUND }

  const paymentDoc = await getPaymentByOrderId(db, orderId)
  if (!paymentDoc) return { error: PAYME_ERRORS.ORDER_NOT_FOUND }

  const payment = paymentDoc.data()
  if (payment.status === 'completed') return { error: PAYME_ERRORS.ALREADY_PAID }

  const expectedTiyin = Math.round(Number(payment.amountUZS || 0) * 100)
  if (Number(params.amount) !== expectedTiyin) return { error: PAYME_ERRORS.INVALID_AMOUNT }

  // Idempotency: return existing transaction
  const existSnap = await db.collection('payme_transactions').where('paymeId', '==', paymeId).limit(1).get()
  if (!existSnap.empty) {
    const d = existSnap.docs[0].data()
    if (d.state < 0) return { error: PAYME_ERRORS.CANNOT_PERFORM }
    return { result: { create_time: d.createTime, transaction: existSnap.docs[0].id, state: d.state } }
  }

  // Reject duplicate pending transaction for same order
  const pendingSnap = await db.collection('payme_transactions')
    .where('orderId', '==', orderId).where('state', '==', 1).limit(1).get()
  if (!pendingSnap.empty) {
    return { error: { code: -31099, message: { ru: 'Платёж выполняется', uz: "To'lov jarayonda", en: 'Payment in progress' } } }
  }

  const createTime = Date.now()
  const txRef = db.collection('payme_transactions').doc()
  await txRef.set({
    paymeId, orderId,
    paymentId: paymentDoc.id, userId: payment.userId,
    planId: payment.planId,
    amount: Number(params.amount),
    createTime, performTime: 0, cancelTime: 0,
    state: 1, reason: null,
    createdAt: new Date().toISOString(),
  })

  await paymentDoc.ref.update({ status: 'processing', paymeTransactionId: paymeId, updatedAt: new Date().toISOString() })

  return { result: { create_time: createTime, transaction: txRef.id, state: 1 } }
}

// ─── PerformTransaction ───────────────────────────────────────────────────────
async function performTransaction(db: FirebaseFirestore.Firestore, params: Record<string, unknown>) {
  const paymeId = params.id as string
  const txSnap = await db.collection('payme_transactions').where('paymeId', '==', paymeId).limit(1).get()
  if (txSnap.empty) return { error: PAYME_ERRORS.TRANSACTION_NOT_FOUND }

  const txDoc = txSnap.docs[0]
  const tx = txDoc.data()

  // Idempotency
  if (tx.state === 2) return { result: { transaction: txDoc.id, perform_time: tx.performTime, state: 2 } }
  if (tx.state !== 1) return { error: PAYME_ERRORS.CANNOT_PERFORM }

  const performTime = Date.now()
  await txDoc.ref.update({ state: 2, performTime, updatedAt: new Date().toISOString() })

  // Mark payment completed
  await db.collection('payments').doc(tx.paymentId).update({
    status: 'completed', completedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  })

  // Load plan from Firestore for duration info
  const userId = String(tx.userId || '')
  const planId = String(tx.planId || '')
  if (userId && planId) {
    const planSnap = await db.collection('plans').where('name', '==', planId).limit(1).get()
    const planData = planSnap.empty ? null : planSnap.docs[0].data()
    const durationDays = Number(planData?.durationDays ?? 30)
    const now = Date.now()
    const planExpiresAt = now + durationDays * 24 * 60 * 60 * 1000

    await db.collection('users').doc(userId).set({
      plan: planId,
      planActivatedAt: now,
      planExpiresAt,
      updatedAt: new Date().toISOString(),
    }, { merge: true })

    await db.collection('subscriptions').add({
      uid: userId, planId,
      planName: planData?.displayName ?? planId,
      amount: Math.round(Number(tx.amount) / 100),
      currency: 'UZS',
      paymentMethod: 'payme',
      paymeTransactionId: paymeId,
      orderId: tx.orderId,
      status: 'active',
      paidAt: new Date().toISOString(),
      expiresAt: new Date(planExpiresAt).toISOString(),
      createdAt: new Date().toISOString(),
    })
  }

  return { result: { transaction: txDoc.id, perform_time: performTime, state: 2 } }
}

// ─── CancelTransaction ────────────────────────────────────────────────────────
async function cancelTransaction(db: FirebaseFirestore.Firestore, params: Record<string, unknown>) {
  const paymeId = params.id as string
  const txSnap = await db.collection('payme_transactions').where('paymeId', '==', paymeId).limit(1).get()
  if (txSnap.empty) return { error: PAYME_ERRORS.TRANSACTION_NOT_FOUND }

  const txDoc = txSnap.docs[0]
  const tx = txDoc.data()

  if (tx.state < 0) return { result: { transaction: txDoc.id, cancel_time: tx.cancelTime, state: tx.state } }

  const cancelTime = Date.now()
  const newState = tx.state === 2 ? -2 : -1
  await txDoc.ref.update({ state: newState, cancelTime, reason: Number(params.reason) || 0, updatedAt: new Date().toISOString() })

  await db.collection('payments').doc(tx.paymentId).update({
    status: 'cancelled', cancelledAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  })

  // If already performed — revert plan
  if (tx.state === 2 && tx.userId) {
    await db.collection('users').doc(String(tx.userId)).set({
      plan: 'free', planExpiresAt: null, updatedAt: new Date().toISOString(),
    }, { merge: true })
    await db.collection('subscriptions')
      .where('paymeTransactionId', '==', paymeId).limit(1).get()
      .then(s => s.docs[0]?.ref.update({ status: 'cancelled', cancelledAt: new Date().toISOString() }))
  }

  return { result: { transaction: txDoc.id, cancel_time: cancelTime, state: newState } }
}

// ─── CheckTransaction ─────────────────────────────────────────────────────────
async function checkTransaction(db: FirebaseFirestore.Firestore, params: Record<string, unknown>) {
  const paymeId = params.id as string
  const txSnap = await db.collection('payme_transactions').where('paymeId', '==', paymeId).limit(1).get()
  if (txSnap.empty) return { error: PAYME_ERRORS.TRANSACTION_NOT_FOUND }
  const tx = txSnap.docs[0].data()
  return {
    result: {
      create_time:  tx.createTime,
      perform_time: tx.performTime || 0,
      cancel_time:  tx.cancelTime  || 0,
      transaction:  txSnap.docs[0].id,
      state:        tx.state,
      reason:       tx.reason ?? null,
    },
  }
}

// ─── GetStatement ─────────────────────────────────────────────────────────────
async function getStatement(db: FirebaseFirestore.Firestore, params: Record<string, unknown>) {
  const from = Number(params.from) || 0
  const to   = Number(params.to)   || Date.now()

  const snap = await db.collection('payme_transactions')
    .where('createTime', '>=', from)
    .where('createTime', '<=', to)
    .orderBy('createTime', 'asc')
    .get()

  const transactions = snap.docs.map(doc => {
    const t = doc.data()
    return {
      id:           t.paymeId,
      time:         t.createTime,
      amount:       t.amount,
      account:      { order_id: t.orderId },
      create_time:  t.createTime,
      perform_time: t.performTime || 0,
      cancel_time:  t.cancelTime  || 0,
      transaction:  doc.id,
      state:        t.state,
      reason:       t.reason ?? null,
    }
  })

  return { result: { transactions } }
}

// ─── Main JSONRPC handler ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  initAdmin()
  const db = getFirestore()

  const secret = await getPaymeSecret(db)
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')

  // Parse body first to get id for error responses
  let body: { method?: string; params?: Record<string, unknown>; id?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })
  }

  // Allow request if:
  // 1. Valid Payme Basic auth (secret configured in admin settings or env)
  // 2. OR internal proxy from fath-node Cloud Function (X-Proxy-Source header with shared internal token)
  const internalToken = req.headers.get('x-proxy-source')
  const isInternalProxy = internalToken === (process.env.INTERNAL_PROXY_TOKEN || 'fath-internal-proxy-2026')

  if (!isInternalProxy && !verifyPaymeAuth(authHeader, secret)) {
    return NextResponse.json({ jsonrpc: '2.0', id: body.id ?? null, error: PAYME_ERRORS.UNAUTHORIZED })
  }

  const { method, params = {}, id } = body

  try {
    let res: unknown
    switch (method) {
      case 'CheckPerformTransaction': res = await checkPerformTransaction(db, params); break
      case 'CreateTransaction':       res = await createTransaction(db, params);       break
      case 'PerformTransaction':      res = await performTransaction(db, params);      break
      case 'CancelTransaction':       res = await cancelTransaction(db, params);       break
      case 'CheckTransaction':        res = await checkTransaction(db, params);        break
      case 'GetStatement':            res = await getStatement(db, params);            break
      default:
        return NextResponse.json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } })
    }
    return NextResponse.json({ jsonrpc: '2.0', id, ...(res as object) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server xatosi'
    return NextResponse.json({ jsonrpc: '2.0', id, error: { code: -32400, message: msg } })
  }
}

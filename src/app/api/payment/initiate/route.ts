// /api/payment/initiate — Click / Payme / Stripe uchun to'lov URL generatsiya
import { NextRequest, NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore } from 'firebase-admin/firestore'
import {
  requireString, requireEnum, validationErrorResponse, parseBody, ValidationError,
} from '@/lib/validation'

export const runtime = 'nodejs'

const VALID_METHODS = ['click', 'payme', 'stripe'] as const

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://traderai.uz'

// Generate TraderAI orderId with 'tai' prefix (distinguishes from Ticknote/EPDF orders)
function generateOrderId(): string {
  return `tai${Date.now()}`
}

// Load Firestore settings + plan price
async function getSettings(db: FirebaseFirestore.Firestore) {
  const snap = await db.collection('settings').doc('main').get()
  return snap.data() ?? {}
}

async function getPlanByName(db: FirebaseFirestore.Firestore, planName: string) {
  const snap = await db.collection('plans').where('name', '==', planName).limit(1).get()
  return snap.empty ? null : snap.docs[0].data()
}

function buildClickUrl(
  settings: Record<string, unknown>,
  uid: string, planId: string, amountUZS: number,
): string {
  const serviceId  = (settings.clickServiceId  as string) || process.env.CLICK_SERVICE_ID  || ''
  const merchantId = (settings.clickMerchantId as string) || process.env.CLICK_MERCHANT_ID || ''
  if (!serviceId || !merchantId) throw new Error('Click sozlamalari topilmadi')
  const transactionParam = `${uid}_${planId}_${Date.now()}`
  const params = new URLSearchParams({
    service_id:        serviceId,
    merchant_id:       merchantId,
    amount:            String(amountUZS),
    transaction_param: transactionParam,
    return_url:        `${BASE_URL}/billing?status=success&method=click`,
  })
  return `https://my.click.uz/services/pay?${params.toString()}`
}

function buildPaymeUrl(
  settings: Record<string, unknown>,
  orderId: string, amountUZS: number,
): string {
  const isProduction = settings.paymeMode === true || settings.paymeMode === 'prod'
  const merchantId = isProduction
    ? ((settings.paymeMerchantId     as string) || process.env.PAYME_MERCHANT_ID      || '')
    : ((settings.paymeMerchantIdTest as string) || process.env.PAYME_MERCHANT_ID_TEST || process.env.PAYME_MERCHANT_ID || '')
  if (!merchantId) throw new Error('Payme merchant ID topilmadi')
  const amountTiyin = Math.round(amountUZS * 100)
  const payload = `m=${merchantId};ac.order_id=${orderId};a=${amountTiyin}`
  const encoded = Buffer.from(payload).toString('base64')
  return isProduction
    ? `https://checkout.paycom.uz/${encoded}`
    : `https://test.paycom.uz/${encoded}`
}

function buildStripeUrl(settings: Record<string, unknown>, uid: string, planId: string): string {
  const key = `stripePriceId${planId.charAt(0).toUpperCase() + planId.slice(1)}`
  const priceId = (settings[key] as string)
    || process.env[`STRIPE_PRICE_${planId.toUpperCase()}`]
    || ''
  if (!priceId) throw new Error('Stripe narx ID topilmadi')
  const params = new URLSearchParams({
    client_reference_id: uid,
    success_url:         `${BASE_URL}/billing?status=success&method=stripe`,
    cancel_url:          `${BASE_URL}/billing?status=cancelled`,
  })
  return `https://buy.stripe.com/${priceId}?${params.toString()}`
}

export async function POST(req: NextRequest) {
  try {
    initAdmin()
    const body = await parseBody<{ planId?: unknown; method?: unknown; uid?: unknown }>(req)

    // Validate + sanitize input
    const planId = requireString(body.planId, 'planId', 64)
    const method = requireEnum(body.method, 'method', VALID_METHODS)
    const uid    = requireString(body.uid, 'uid', 128)

    const db = getFirestore()

    // Load settings + plan concurrently
    const [settings, plan] = await Promise.all([
      getSettings(db),
      getPlanByName(db, planId),
    ])

    if (!plan) {
      return NextResponse.json({ error: "Noto'g'ri reja tanlandi" }, { status: 400 })
    }

    // Verify user exists
    const userDoc = await db.collection('users').doc(uid).get()
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'Foydalanuvchi topilmadi' }, { status: 404 })
    }

    // Plan price in UZS (stored as number in Firestore)
    const amountUZS: number = Number(plan.priceUZS || plan.price || 0)
    if (amountUZS <= 0) {
      return NextResponse.json({ error: 'Reja narxi topilmadi' }, { status: 400 })
    }

    // Generate orderId for Payme (9 digits starting with 8)
    const orderId = generateOrderId()

    let url: string
    switch (method) {
      case 'click':
        url = buildClickUrl(settings, uid, planId, amountUZS)
        break
      case 'payme':
        url = buildPaymeUrl(settings, orderId, amountUZS)
        break
      case 'stripe':
        url = buildStripeUrl(settings, uid, planId)
        break
      default:
        return NextResponse.json({ error: "Noto'g'ri to'lov usuli" }, { status: 400 })
    }

    // Create payments document for Payme JSONRPC lookup
    await db.collection('payments').doc(orderId).set({
      orderId,
      userId:    uid,
      planId,
      planName:  String(plan.displayName || plan.name || planId),
      amountUZS,
      method,
      status:    'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true, url, orderId })
  } catch (e) {
    const vrErr = validationErrorResponse(e)
    if (vrErr) return vrErr
    const msg = e instanceof Error ? e.message : 'Server xatosi'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

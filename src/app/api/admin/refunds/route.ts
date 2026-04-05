import { NextRequest, NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

initAdmin()
const db = getFirestore()

// GET /api/admin/refunds?status=pending|approved|rejected|all&limit=50
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') ?? 'all'
    const limit = parseInt(searchParams.get('limit') ?? '50')

    let q = db.collection('refundRequests').orderBy('requestedAt', 'desc').limit(limit)
    if (status !== 'all') q = q.where('status', '==', status) as typeof q

    const snap = await q.get()
    const refunds = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    return NextResponse.json({ refunds })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST /api/admin/refunds — create refund request
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      userId: string
      subscriptionId: string
      amount: number
      currency?: string
      reason: string
      adminInitiated?: boolean
    }

    const { userId, subscriptionId, amount, currency = 'USD', reason, adminInitiated = false } = body

    if (!userId || !subscriptionId || !amount || !reason) {
      return NextResponse.json({ error: 'userId, subscriptionId, amount, reason majburiy' }, { status: 400 })
    }

    // Fetch subscription to verify it exists
    const subSnap = await db.collection('subscriptions').doc(subscriptionId).get()
    if (!subSnap.exists) {
      return NextResponse.json({ error: 'Obuna topilmadi' }, { status: 404 })
    }
    const subData = subSnap.data()!

    // Fetch user info
    const userSnap = await db.collection('users').doc(userId).get()
    const userData = userSnap.exists ? userSnap.data()! : {}

    const ref = await db.collection('refundRequests').add({
      userId,
      userEmail: userData.email ?? '',
      userName: userData.displayName ?? userData.name ?? '',
      subscriptionId,
      planId: subData.planId ?? '',
      planName: subData.planName ?? '',
      amount,
      currency,
      reason,
      status: 'pending',
      adminInitiated,
      requestedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ ok: true, id: ref.id })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// PATCH /api/admin/refunds — approve or reject
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as {
      id: string
      status: 'approved' | 'rejected'
      adminNote?: string
      processedBy?: string
    }

    const { id, status, adminNote = '', processedBy = 'admin' } = body

    if (!id || !status) return NextResponse.json({ error: 'id va status majburiy' }, { status: 400 })
    if (status !== 'approved' && status !== 'rejected') {
      return NextResponse.json({ error: "status 'approved' yoki 'rejected' bo'lishi kerak" }, { status: 400 })
    }

    const refDoc = db.collection('refundRequests').doc(id)
    const snap = await refDoc.get()
    if (!snap.exists) return NextResponse.json({ error: 'Refund topilmadi' }, { status: 404 })

    const refData = snap.data()!

    const updateData: Record<string, unknown> = {
      status,
      adminNote,
      processedBy,
      processedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }

    const batch = db.batch()
    batch.update(refDoc, updateData)

    if (status === 'approved') {
      // Cancel subscription
      if (refData.subscriptionId) {
        const subRef = db.collection('subscriptions').doc(refData.subscriptionId)
        batch.update(subRef, {
          status: 'refunded',
          refundedAt: FieldValue.serverTimestamp(),
          refundAmount: refData.amount,
        })
      }

      // Log to transactions
      batch.set(db.collection('transactions').doc(), {
        type: 'refund',
        userId: refData.userId,
        subscriptionId: refData.subscriptionId,
        amount: -Math.abs(refData.amount),
        currency: refData.currency ?? 'USD',
        refundRequestId: id,
        processedBy,
        processedAt: FieldValue.serverTimestamp(),
      })

      // Notify user
      batch.set(db.collection('notifications').doc(), {
        userId: refData.userId,
        type: 'refund_approved',
        title: 'Refund tasdiqlandi',
        message: `${refData.currency ?? 'USD'} ${refData.amount} to'lov qaytarildi. ${adminNote}`.trim(),
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      })
    } else {
      // Notify rejection
      batch.set(db.collection('notifications').doc(), {
        userId: refData.userId,
        type: 'refund_rejected',
        title: 'Refund rad etildi',
        message: `Refund so'rovi rad etildi. ${adminNote}`.trim(),
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      })
    }

    await batch.commit()
    return NextResponse.json({ ok: true, status })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

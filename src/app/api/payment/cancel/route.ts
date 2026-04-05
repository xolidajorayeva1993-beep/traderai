// /api/payment/cancel — Obunani bekor qilish
import { NextRequest, NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore } from 'firebase-admin/firestore'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    initAdmin()
    const db   = getFirestore()
    const body = await req.json() as { uid?: string }
    const { uid } = body

    if (!uid) return NextResponse.json({ error: 'uid majburiy' }, { status: 400 })

    const userDoc = await db.collection('users').doc(uid).get()
    if (!userDoc.exists) return NextResponse.json({ error: 'Foydalanuvchi topilmadi' }, { status: 404 })

    // Find active subscription
    const subsSnap = await db.collection('subscriptions')
      .where('uid', '==', uid)
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get()

    if (!subsSnap.empty) {
      await subsSnap.docs[0].ref.update({
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }

    // Revert user to free plan (keep planExpiresAt for access until expiry)
    await db.collection('users').doc(uid).update({
      plan: 'free',
      updatedAt: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server xatosi'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

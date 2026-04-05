// GET /api/payment/subscriptions — Joriy foydalanuvchining to'lov tarixi
import { NextRequest, NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    initAdmin()
    const db = getFirestore()

    // Auth header dan UID ni tekshiramiz
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Avtorizatsiya kerak' }, { status: 401 })
    }
    const idToken = authHeader.slice(7)
    const decoded = await getAuth().verifyIdToken(idToken)
    const uid = decoded.uid

    const snap = await db
      .collection('subscriptions')
      .where('uid', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get()

    const subscriptions = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    return NextResponse.json({ subscriptions })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server xatosi'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

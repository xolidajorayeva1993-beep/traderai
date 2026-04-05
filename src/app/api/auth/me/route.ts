// GET /api/auth/me — Returns fresh user profile from Firestore (Admin SDK, no cache)
import { NextRequest, NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') ?? ''
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    initAdmin()
    const decoded = await getAuth().verifyIdToken(idToken)
    const uid = decoded.uid

    const userDoc = await getFirestore().collection('users').doc(uid).get()
    if (!userDoc.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const data = userDoc.data() ?? {}
    return NextResponse.json({
      uid,
      plan: data.plan ?? 'free',
      role: data.role ?? decoded.role ?? 'free',
      planExpiresAt: data.planExpiresAt ?? null,
      limits: data.limits ?? {},
      displayName: data.displayName ?? decoded.name ?? '',
      photoURL: data.photoURL ?? decoded.picture ?? null,
      email: data.email ?? decoded.email ?? '',
      telegramId: data.telegramId ?? null,
      telegramUsername: data.telegramUsername ?? null,
      notifSettings: data.notifSettings ?? null,
      referralCode: data.referralCode ?? null,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

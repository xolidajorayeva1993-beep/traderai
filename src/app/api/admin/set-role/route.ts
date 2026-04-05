import { NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

type Role = 'admin' | 'premium' | 'free'

export async function POST(req: Request) {
  try {
    initAdmin()
    const db   = getFirestore()
    const auth = getAuth()
    const body = await req.json() as { uid?: string; role?: Role }

    const { uid, role } = body
    if (!uid || !role) {
      return NextResponse.json({ error: 'uid va role majburiy' }, { status: 400 })
    }
    if (!['admin', 'premium', 'free'].includes(role)) {
      return NextResponse.json({ error: 'Noto\'g\'ri role. admin | premium | free bo\'lishi kerak' }, { status: 400 })
    }

    // Set Firebase Auth custom claims
    await auth.setCustomUserClaims(uid, { role })

    // Sync Firestore user doc
    await db.collection('users').doc(uid).set(
      { role, updatedAt: new Date().toISOString() },
      { merge: true }
    )

    return NextResponse.json({ ok: true, uid, role })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server xatosi'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    initAdmin()
    const auth = getAuth()
    const url  = new URL(req.url)
    const uid  = url.searchParams.get('uid')
    if (!uid) return NextResponse.json({ error: 'uid majburiy' }, { status: 400 })

    const user   = await auth.getUser(uid)
    const claims = user.customClaims ?? {}
    return NextResponse.json({ uid, email: user.email, claims })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server xatosi'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// GET /api/admin/users — Firebase Auth foydalanuvchilar ro'yxati
import { NextRequest, NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const app = initAdmin()
    const auth = getAuth(app)
    const db = getFirestore(app)

    // Auth dan 100 ta user olamiz
    const listResult = await auth.listUsers(100)

    const uids = listResult.users.map(u => u.uid)

    // Firestore /users/ dan extra ma'lumot olamiz (plan, role)
    let firestoreUsers: Record<string, { role?: string; plan?: string; createdAt?: number }> = {}
    if (uids.length > 0) {
      const chunks: string[][] = []
      for (let i = 0; i < uids.length; i += 10) chunks.push(uids.slice(i, i + 10))
      for (const chunk of chunks) {
        const snaps = await db.getAll(...chunk.map(uid => db.collection('users').doc(uid)))
        for (const snap of snaps) {
          if (snap.exists) firestoreUsers[snap.id] = snap.data() as typeof firestoreUsers[string]
        }
      }
    }

    const users = listResult.users.map(u => ({
      uid:          u.uid,
      email:        u.email ?? '',
      displayName:  u.displayName ?? '',
      photoURL:     u.photoURL ?? null,
      emailVerified:u.emailVerified,
      disabled:     u.disabled,
      createdAt:    u.metadata.creationTime ? new Date(u.metadata.creationTime).getTime() : 0,
      lastSignIn:   u.metadata.lastSignInTime ? new Date(u.metadata.lastSignInTime).getTime() : 0,
      role:         (u.customClaims as Record<string, unknown>)?.role as string ?? firestoreUsers[u.uid]?.role ?? 'free',
      plan:         firestoreUsers[u.uid]?.plan ?? 'free',
    }))

    return NextResponse.json({ ok: true, count: users.length, users })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list users'
    console.error('[GET /api/admin/users]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

// POST /api/admin/users — rol o'zgartirish
export async function POST(req: NextRequest) {
  try {
    const { uid, role, disabled } = await req.json()
    if (!uid) return NextResponse.json({ error: 'uid required' }, { status: 400 })

    const app = initAdmin()
    const auth = getAuth(app)
    const db = getFirestore(app)

    const updates: Promise<unknown>[] = []

    if (role) {
      updates.push(auth.setCustomUserClaims(uid, { role }))
      updates.push(db.collection('users').doc(uid).set({ role, updatedAt: Date.now() }, { merge: true }))
    }

    if (typeof disabled === 'boolean') {
      updates.push(auth.updateUser(uid, { disabled }))
    }

    await Promise.all(updates)

    return NextResponse.json({ ok: true, uid, role, disabled })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Update failed' }, { status: 500 })
  }
}

// GET  /api/admin/users/[uid] — user to'liq ma'lumoti
// PATCH /api/admin/users/[uid] — user ma'lumotlarini yangilash
import { NextRequest, NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  try {
    const { uid } = await params
    initAdmin()
    const auth = getAuth()
    const db = getFirestore()

    const [authUser, userDoc, signalsSnap, subSnap] = await Promise.all([
      auth.getUser(uid),
      db.collection('users').doc(uid).get(),
      db.collection('aiSignals').where('userId', '==', uid).orderBy('createdAt', 'desc').limit(20).get(),
      db.collection('subscriptions').where('uid', '==', uid).orderBy('paidAt', 'desc').limit(10).get(),
    ])

    const userData = userDoc.data() ?? {}
    const recentSignals = signalsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    const subscriptions = subSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    // Signal statistika
    const allSignalsSnap = await db.collection('aiSignals').where('userId', '==', uid).get()
    let tpCount = 0; let slCount = 0
    for (const d of allSignalsSnap.docs) {
      const s = d.data()
      if (['tp1', 'tp2', 'tp3'].includes(s.status)) tpCount++
      else if (s.status === 'sl') slCount++
    }
    const resolved = tpCount + slCount
    const winRate = resolved > 0 ? Math.round((tpCount / resolved) * 100) : 0

    return NextResponse.json({
      uid,
      email: authUser.email ?? '',
      displayName: authUser.displayName ?? '',
      photoURL: authUser.photoURL ?? null,
      emailVerified: authUser.emailVerified,
      disabled: authUser.disabled,
      createdAt: authUser.metadata.creationTime,
      lastSignIn: authUser.metadata.lastSignInTime,
      role: (authUser.customClaims as Record<string, unknown>)?.role as string ?? userData.role ?? 'free',
      plan: userData.plan ?? 'free',
      planExpiresAt: userData.planExpiresAt ?? null,
      telegramId: userData.telegramId ?? null,
      limits: userData.limits ?? {},
      notes: userData.adminNotes ?? '',
      stats: { total: allSignalsSnap.size, tpCount, slCount, winRate },
      recentSignals,
      subscriptions,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  try {
    const { uid } = await params
    initAdmin()
    const auth = getAuth()
    const db = getFirestore()
    const body = await req.json()
    const { role, plan, planExpiresAt, planActivatedAt, disabled, limits, adminNotes } = body

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    const authUpdates: Record<string, unknown> = {}

    if (role !== undefined) {
      await auth.setCustomUserClaims(uid, { role })
      updates.role = role
    }
    if (plan !== undefined) updates.plan = plan
    if (planExpiresAt !== undefined) updates.planExpiresAt = planExpiresAt
    if (planActivatedAt !== undefined) updates.planActivatedAt = planActivatedAt
    if (disabled !== undefined) authUpdates.disabled = disabled
    if (limits !== undefined) updates.limits = limits
    if (adminNotes !== undefined) updates.adminNotes = adminNotes

    if (Object.keys(authUpdates).length > 0) await auth.updateUser(uid, authUpdates)
    await db.collection('users').doc(uid).set(updates, { merge: true })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

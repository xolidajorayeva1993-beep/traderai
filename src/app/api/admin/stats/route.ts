// ============================================================
// Admin Stats API — real Firestore data
// GET /api/admin/stats
// ============================================================
import { NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    initAdmin()
    const db = getFirestore()
    const auth = getAuth()

    const todayStart = new Date(Date.now() - 86400000) // 24 soat oldin

    // Parallel fetches
    const [
      signalsSnap,
      usersCountSnap,
      activeSignalsSnap,
      todaySignalsSnap,
    ] = await Promise.all([
      db.collection('aiSignals').count().get(),
      db.collection('users').count().get(),
      db.collection('aiSignals').where('status', '==', 'open').count().get(),
      // createdAt = Firestore Timestamp → Date object bilan solishtir
      db.collection('aiSignals').where('createdAt', '>=', todayStart).count().get(),
    ])

    const totalSignals  = signalsSnap.data().count
    const totalUsers    = usersCountSnap.data().count
    const activeSignals = activeSignalsSnap.data().count
    const todaySignals  = todaySignalsSnap.data().count

    // Win/loss: status = 'tp1'|'tp2'|'tp3'|'sl'
    const resolvedSnap = await db.collection('aiSignals')
      .where('status', 'in', ['tp1', 'tp2', 'tp3', 'sl'])
      .limit(200)
      .get()

    let tpCount = 0; let slCount = 0
    for (const doc of resolvedSnap.docs) {
      const s = doc.data().status as string
      if (s === 'tp1' || s === 'tp2' || s === 'tp3') tpCount++
      else if (s === 'sl') slCount++
    }
    const resolved = tpCount + slCount
    const winRate = resolved > 0 ? Math.round((tpCount / resolved) * 100) : 0

    // User role breakdown
    let adminCount = 0; let premiumCount = 0; let freeCount = 0
    const userDocs = await db.collection('users').limit(500).get()
    for (const doc of userDocs.docs) {
      const r = doc.data().role ?? 'free'
      if (r === 'admin') adminCount++
      else if (r === 'premium' || r === 'pro') premiumCount++
      else freeCount++
    }

    // Recent 10 signals from aiSignals
    const recentSnap = await db.collection('aiSignals')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get()

    const recentSignals = recentSnap.docs.map(doc => {
      const d = doc.data()
      return {
        id:         doc.id,
        symbol:     d.symbol,
        direction:  d.direction,
        confidence: d.confidence,
        status:     d.status,
        createdAt:  d.createdAt?.toDate?.()?.toISOString() ?? String(d.createdAt ?? ''),
      }
    })

    // Firebase Auth user count
    let authUserCount = totalUsers
    try {
      const listResult = await auth.listUsers(1)
      void listResult
    } catch { /* ignore */ }

    return NextResponse.json({
      signals: {
        total:  totalSignals,
        active: activeSignals,
        today:  todaySignals,
        tpHit:  tpCount,
        slHit:  slCount,
        winRate,
      },
      users: {
        total:   totalUsers,
        auth:    authUserCount,
        admin:   adminCount,
        premium: premiumCount,
        free:    freeCount,
      },
      recentSignals,
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[admin/stats]', err)
    return NextResponse.json({
      signals: { total: 0, active: 0, today: 0, tpHit: 0, slHit: 0, winRate: 0 },
      users: { total: 0, auth: 0, admin: 0, premium: 0, free: 0 },
      recentSignals: [],
      generatedAt: new Date().toISOString(),
      error: String(err),
    })
  }
}

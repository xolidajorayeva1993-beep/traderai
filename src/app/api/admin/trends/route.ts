// ================================================================
// Admin Trends API — haftalik/oylik statistika
// GET /api/admin/trends?days=14|30|90
// ================================================================
import { NextRequest, NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore } from 'firebase-admin/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

function lastNDays(n: number) {
  const days: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(dayKey(d))
  }
  return days
}

export async function GET(req: NextRequest) {
  try {
    initAdmin()
    const db = getFirestore()
    const days = parseInt(req.nextUrl.searchParams.get('days') ?? '14')
    const clampedDays = Math.min(Math.max(days, 7), 90)
    const from = new Date()
    from.setDate(from.getDate() - clampedDays)
    const allDays = lastNDays(clampedDays)

    // aiSignals: createdAt = Firestore serverTimestamp → compare with Date object
    const signalsSnap = await db.collection('aiSignals')
      .where('createdAt', '>=', from)
      .get()

    const signalsByDay: Record<string, { tp: number; sl: number; open: number; total: number }> = {}
    for (const day of allDays) signalsByDay[day] = { tp: 0, sl: 0, open: 0, total: 0 }

    for (const doc of signalsSnap.docs) {
      const d = doc.data()
      // createdAt is Firestore Timestamp
      const createdMs = d.createdAt?.toDate?.()?.getTime() ?? (typeof d.createdAt === 'number' ? d.createdAt : null)
      if (!createdMs) continue
      const key = dayKey(new Date(createdMs))
      if (!signalsByDay[key]) continue
      signalsByDay[key].total++
      const s = d.status as string
      if (s === 'tp1' || s === 'tp2' || s === 'tp3') signalsByDay[key].tp++
      else if (s === 'sl') signalsByDay[key].sl++
      else if (s === 'open') signalsByDay[key].open++
    }

    // users: createdAt = Date.now() (number) → compare with timestamp number
    const usersSnap = await db.collection('users')
      .where('createdAt', '>=', from.getTime())
      .get()

    const usersByDay: Record<string, number> = {}
    for (const day of allDays) usersByDay[day] = 0
    for (const doc of usersSnap.docs) {
      const d = doc.data()
      const createdMs: number | null = typeof d.createdAt === 'number' ? d.createdAt : null
      if (!createdMs) continue
      const key = dayKey(new Date(createdMs))
      if (usersByDay[key] === undefined) continue
      usersByDay[key]++
    }

    // Revenue: subscriptions.paidAt = ISO string
    const subSnap = await db.collection('subscriptions')
      .where('paidAt', '>=', from.toISOString())
      .get()

    const revenueByDay: Record<string, number> = {}
    for (const day of allDays) revenueByDay[day] = 0
    for (const doc of subSnap.docs) {
      const d = doc.data()
      const key = d.paidAt ? dayKey(new Date(d.paidAt)) : null
      if (!key || revenueByDay[key] === undefined) continue
      revenueByDay[key] += d.amount ?? 0
    }

    // Build chart arrays
    const signalChart = allDays.map(day => ({
      date:  day,
      total: signalsByDay[day].total,
      tp:    signalsByDay[day].tp,
      sl:    signalsByDay[day].sl,
    }))
    const userChart    = allDays.map(day => ({ date: day, count: usersByDay[day] }))
    const revenueChart = allDays.map(day => ({ date: day, amount: revenueByDay[day] }))

    const totalNewUsers = Object.values(usersByDay).reduce((a, b) => a + b, 0)
    const totalRevenue  = Object.values(revenueByDay).reduce((a, b) => a + b, 0)
    const totalSignals  = Object.values(signalsByDay).reduce((a, b) => a + b.total, 0)

    return NextResponse.json({
      days: clampedDays,
      signalChart,
      userChart,
      revenueChart,
      totals: { newUsers: totalNewUsers, revenue: totalRevenue, signals: totalSignals },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

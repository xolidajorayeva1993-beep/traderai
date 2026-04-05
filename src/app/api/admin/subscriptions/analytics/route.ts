// GET /api/admin/subscriptions/analytics — MRR, Churn, LTV tahlili
import { NextRequest, NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore } from 'firebase-admin/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const months = parseInt(searchParams.get('months') ?? '6', 10)

    initAdmin()
    const db = getFirestore()

    const now = new Date()
    const startDate = new Date(now)
    startDate.setMonth(startDate.getMonth() - months)

    // All subscriptions
    const [allSubSnap, usersSnap] = await Promise.all([
      db.collection('subscriptions').orderBy('createdAt', 'desc').limit(1000).get(),
      db.collection('users').where('plan', '!=', 'free').get(),
    ])

    const subs = allSubSnap.docs.map(d => ({
      id: d.id,
      uid: d.data().uid ?? d.data().userId,
      plan: d.data().plan ?? d.data().planId ?? 'free',
      amount: Number(d.data().amount ?? d.data().price ?? 0),
      currency: d.data().currency ?? 'USD',
      status: d.data().status ?? 'active',
      createdAt: d.data().createdAt?.toMillis?.() ?? d.data().paidAt ?? Date.now(),
      canceledAt: d.data().canceledAt?.toMillis?.() ?? null,
    }))

    // Active subscribers
    const activeUsers = usersSnap.docs.length

    // MRR — Monthly Recurring Revenue (active subscriptions * monthly price)
    const activeSubs  = subs.filter(s => s.status === 'active' || s.status === 'paid')
    const mrr         = activeSubs.reduce((sum, s) => sum + s.amount, 0)

    // Monthly revenue chart (last N months)
    const monthlyChart: { month: string; revenue: number; subscribers: number; newSubs: number; churned: number }[] = []
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setMonth(d.getMonth() - i)
      const label       = d.toLocaleDateString('uz-UZ', { month: 'short', year: 'numeric' })
      const monthStart  = new Date(d.getFullYear(), d.getMonth(), 1).getTime()
      const monthEnd    = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime()

      const newInMonth     = subs.filter(s => s.createdAt >= monthStart && s.createdAt <= monthEnd)
      const churnedInMonth = subs.filter(s => s.canceledAt && s.canceledAt >= monthStart && s.canceledAt <= monthEnd)
      const revenue        = newInMonth.reduce((sum, s) => sum + s.amount, 0)

      monthlyChart.push({ month: label, revenue, subscribers: newInMonth.length, newSubs: newInMonth.length, churned: churnedInMonth.length })
    }

    // Plan distribution
    const planDist: Record<string, { count: number; revenue: number }> = {}
    activeSubs.forEach(s => {
      if (!planDist[s.plan]) planDist[s.plan] = { count: 0, revenue: 0 }
      planDist[s.plan].count++
      planDist[s.plan].revenue += s.amount
    })

    // Churn rate (canceled / total at start of period)
    const totalAtStart   = subs.filter(s => s.createdAt < startDate.getTime()).length
    const churnedInPeriod = subs.filter(s => s.canceledAt && s.canceledAt >= startDate.getTime()).length
    const churnRate      = totalAtStart > 0 ? Math.round((churnedInPeriod / totalAtStart) * 100 * 10) / 10 : 0

    // ARPU — Average Revenue Per User
    const arpu = activeUsers > 0 ? Math.round(mrr / activeUsers) : 0

    // LTV estimate: ARPU / churnRate * 100 (months), min 6x ARPU
    const avgLifeMonths = churnRate > 0 ? Math.round(100 / churnRate) : 24
    const ltv           = arpu * avgLifeMonths

    // Total revenue all time
    const totalRevenue = subs.reduce((sum, s) => sum + s.amount, 0)

    return NextResponse.json({
      mrr,
      arpu,
      ltv,
      churnRate,
      activeSubscribers: activeUsers,
      activeSubs: activeSubs.length,
      totalRevenue,
      avgLifeMonths,
      monthlyChart,
      planDistribution: Object.entries(planDist).map(([plan, data]) => ({ plan, ...data })),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

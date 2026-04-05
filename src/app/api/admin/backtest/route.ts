// ============================================================
// Admin Backtest API — signal performance analytics
// GET /api/admin/backtest?period=week|month|3months|all
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore } from 'firebase-admin/firestore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Signal {
  id: string
  pair: string
  direction: string
  timeframe: string
  confidence: number
  status: string
  createdAt: string | number
  riskReward: number
  pips?: number
  pnl?: number
  entryPrice?: number
  stopLoss?: number
  takeProfit1?: number
}

function getPeriodStart(period: string): Date {
  const now = new Date()
  switch (period) {
    case 'week':    return new Date(now.getTime() - 7 * 86400000)
    case 'month':   return new Date(now.getTime() - 30 * 86400000)
    case '3months': return new Date(now.getTime() - 90 * 86400000)
    default:        return new Date(0) // all time
  }
}

export async function GET(req: NextRequest) {
  try {
    initAdmin()
    const db = getFirestore()
    const period = req.nextUrl.searchParams.get('period') ?? 'month'
    const periodStart = getPeriodStart(period)

    // Fetch resolved signals in period
    const snap = await db.collection('signals')
      .where('status', 'in', ['tp_hit', 'sl_hit', 'expired'])
      .orderBy('createdAt', 'desc')
      .limit(500)
      .get()

    const signals: Signal[] = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Signal))
      .filter(s => {
        const ts = typeof s.createdAt === 'number'
          ? s.createdAt
          : new Date(s.createdAt).getTime()
        return ts >= periodStart.getTime()
      })

    // ── Summary stats ─────────────────────────────────────────
    const total   = signals.length
    const tp      = signals.filter(s => s.status === 'tp_hit').length
    const sl      = signals.filter(s => s.status === 'sl_hit').length
    const expired = signals.filter(s => s.status === 'expired').length
    const winRate = total > 0 ? Math.round((tp / (tp + sl || 1)) * 100) : 0

    const avgConfidence = total > 0
      ? Math.round(signals.reduce((a, s) => a + (s.confidence ?? 0), 0) / total)
      : 0
    const avgRR = total > 0
      ? +(signals.reduce((a, s) => a + (s.riskReward ?? 0), 0) / total).toFixed(2)
      : 0

    // Profit factor: (sum of winning pips) / (sum of losing pips)
    const winPips  = signals.filter(s => s.status === 'tp_hit').reduce((a, s) => a + Math.abs(s.pips ?? (s.riskReward ?? 1.5) * 10), 0)
    const lossPips = signals.filter(s => s.status === 'sl_hit').reduce((a, s) => a + 10, 0) // 1R = 10 pips default
    const profitFactor = lossPips > 0 ? +(winPips / lossPips).toFixed(2) : winPips > 0 ? 9.99 : 0

    // Max consecutive losses
    let maxLoss = 0; let curLoss = 0
    for (const s of [...signals].reverse()) {
      if (s.status === 'sl_hit') { curLoss++; maxLoss = Math.max(maxLoss, curLoss) }
      else curLoss = 0
    }

    // ── Equity curve (cumulative pips day by day) ─────────────
    const equityMap: Record<string, number> = {}
    let running = 0
    for (const s of [...signals].reverse()) {
      const date = new Date(
        typeof s.createdAt === 'number' ? s.createdAt : s.createdAt
      ).toISOString().slice(0, 10)
      const pips = s.status === 'tp_hit'
        ? Math.abs(s.pips ?? (s.riskReward ?? 1.5) * 10)
        : s.status === 'sl_hit' ? -10 : 0
      running += pips
      equityMap[date] = running
    }
    const equityCurve = Object.entries(equityMap).map(([date, pips]) => ({ date, pips }))

    // ── Per-pair breakdown ────────────────────────────────────
    const pairMap: Record<string, { tp: number; sl: number; expired: number }> = {}
    for (const s of signals) {
      const pair = s.pair ?? 'UNKNOWN'
      if (!pairMap[pair]) pairMap[pair] = { tp: 0, sl: 0, expired: 0 }
      if (s.status === 'tp_hit') pairMap[pair].tp++
      else if (s.status === 'sl_hit') pairMap[pair].sl++
      else pairMap[pair].expired++
    }
    const pairBreakdown = Object.entries(pairMap)
      .map(([pair, d]) => ({
        pair,
        total: d.tp + d.sl + d.expired,
        tp: d.tp,
        sl: d.sl,
        expired: d.expired,
        winRate: d.tp + d.sl > 0 ? Math.round((d.tp / (d.tp + d.sl)) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    // ── Confidence bucket analysis ────────────────────────────
    const buckets = [
      { label: '50–60%', min: 50, max: 60 },
      { label: '60–70%', min: 60, max: 70 },
      { label: '70–80%', min: 70, max: 80 },
      { label: '80–90%', min: 80, max: 90 },
      { label: '90–100%', min: 90, max: 101 },
    ]
    const confidenceChart = buckets.map(b => {
      const subset = signals.filter(s => s.confidence >= b.min && s.confidence < b.max)
      const bTp = subset.filter(s => s.status === 'tp_hit').length
      const bSl = subset.filter(s => s.status === 'sl_hit').length
      return {
        label: b.label,
        total: subset.length,
        tp: bTp,
        sl: bSl,
        winRate: bTp + bSl > 0 ? Math.round((bTp / (bTp + bSl)) * 100) : 0,
      }
    })

    // ── Timeframe breakdown ───────────────────────────────────
    const tfMap: Record<string, { tp: number; sl: number }> = {}
    for (const s of signals) {
      const tf = s.timeframe ?? 'N/A'
      if (!tfMap[tf]) tfMap[tf] = { tp: 0, sl: 0 }
      if (s.status === 'tp_hit') tfMap[tf].tp++
      else if (s.status === 'sl_hit') tfMap[tf].sl++
    }
    const tfBreakdown = Object.entries(tfMap).map(([tf, d]) => ({
      tf,
      tp: d.tp, sl: d.sl,
      winRate: d.tp + d.sl > 0 ? Math.round((d.tp / (d.tp + d.sl)) * 100) : 0,
    }))

    // ── Weekly win-rate trend ─────────────────────────────────
    const weekMap: Record<string, { tp: number; sl: number }> = {}
    for (const s of signals) {
      const d = new Date(typeof s.createdAt === 'number' ? s.createdAt : s.createdAt)
      const monday = new Date(d)
      monday.setDate(d.getDate() - d.getDay() + 1)
      const key = monday.toISOString().slice(0, 10)
      if (!weekMap[key]) weekMap[key] = { tp: 0, sl: 0 }
      if (s.status === 'tp_hit') weekMap[key].tp++
      else if (s.status === 'sl_hit') weekMap[key].sl++
    }
    const weeklyTrend = Object.entries(weekMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, d]) => ({
        week,
        tp: d.tp, sl: d.sl,
        winRate: d.tp + d.sl > 0 ? Math.round((d.tp / (d.tp + d.sl)) * 100) : 0,
      }))

    return NextResponse.json({
      summary: { total, tp, sl, expired, winRate, avgConfidence, avgRR, profitFactor, maxConsecutiveLoss: maxLoss },
      equityCurve,
      pairBreakdown,
      confidenceChart,
      tfBreakdown,
      weeklyTrend,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

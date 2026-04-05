// ============================================================
// /api/admin/reports
// Kunlik / Haftalik / Oylik signal hisobotlarini avtomatik yaratadi
// GET ?type=daily|weekly|monthly&date=YYYY-MM-DD  — hisobot olish
// POST { type, date? }                            — yaratish/qayta hisoblash
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore } from 'firebase-admin/firestore'

type ReportType = 'daily' | 'weekly' | 'monthly'

interface ReportData {
  id?: string
  type: ReportType
  periodStart: string
  periodEnd: string
  generatedAt: string

  // Signal stats
  totalSignals: number
  tpCount: number
  slCount: number
  expiredCount: number
  winRate: number
  profitFactor: number
  avgRR: number
  avgConfidence: number

  // Pair breakdown
  topPairs: { pair: string; signals: number; winRate: number }[]

  // Direction split
  buyCount: number
  sellCount: number

  // Market breakdown
  forexCount: number
  cryptoCount: number

  // Timeframe breakdown
  tfBreakdown: { tf: string; count: number; winRate: number }[]

  // User engagement
  newUsers: number
  activeUsers: number

  // Revenue (from subscriptions)
  revenue: number
  newSubscriptions: number
}

function getPeriodRange(type: ReportType, date: Date): { start: Date; end: Date } {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)

  if (type === 'daily') {
    const start = new Date(d)
    const end = new Date(d)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  if (type === 'weekly') {
    const dayOfWeek = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - dayOfWeek)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  // monthly
  const start = new Date(d.getFullYear(), d.getMonth(), 1)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

function periodKey(type: ReportType, date: Date): string {
  if (type === 'daily') return date.toISOString().slice(0, 10)
  if (type === 'weekly') {
    const day = date.getDay()
    const mon = new Date(date)
    mon.setDate(date.getDate() - day)
    return `week-${mon.toISOString().slice(0, 10)}`
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

async function generateReport(type: ReportType, date: Date): Promise<ReportData> {
  initAdmin()
  const db = getFirestore()
  const { start, end } = getPeriodRange(type, date)

  // Fetch signals in period (aiSignals collection, createdAt = Firestore Timestamp)
  const sigSnap = await db.collection('aiSignals')
    .where('createdAt', '>=', start)
    .where('createdAt', '<=', end)
    .limit(1000)
    .get()

  interface SigDoc {
    symbol?: string
    pair?: string
    direction?: string
    status?: string
    confidence?: number
    rr?: number
    riskReward?: number
    pips?: number
    market?: string
    assetType?: string
    timeframe?: string
  }

  const signals: SigDoc[] = sigSnap.docs.map(d => d.data() as SigDoc)

  const total    = signals.length
  const tpCount  = signals.filter(s => s.status === 'tp_hit' || s.status === 'tp1_hit' || s.status === 'tp2_hit' || s.status === 'tp3_hit').length
  const slCount  = signals.filter(s => s.status === 'sl_hit').length
  const expiredCount = signals.filter(s => s.status === 'expired').length
  const winRate  = tpCount + slCount > 0 ? Math.round((tpCount / (tpCount + slCount)) * 100) : 0

  const rrVal = (s: SigDoc) => s.rr ?? s.riskReward ?? 1.5
  const winPips  = signals.filter(s => s.status === 'tp_hit' || s.status === 'tp1_hit' || s.status === 'tp2_hit' || s.status === 'tp3_hit').reduce((a, s) => a + Math.abs(s.pips ?? rrVal(s) * 10), 0)
  const lossPips = slCount * 10
  const profitFactor = lossPips > 0 ? +(winPips / lossPips).toFixed(2) : winPips > 0 ? 9.99 : 0

  const avgRR = total > 0
    ? +(signals.reduce((a, s) => a + rrVal(s), 0) / total).toFixed(2)
    : 0

  const avgConfidence = total > 0
    ? Math.round(signals.reduce((a, s) => a + (s.confidence ?? 0), 0) / total)
    : 0

  // Pair breakdown (aiSignals uses 'symbol', fallback to 'pair')
  const pairMap: Record<string, { total: number; tp: number; sl: number }> = {}
  for (const s of signals) {
    const p = s.symbol ?? s.pair ?? 'UNKNOWN'
    if (!pairMap[p]) pairMap[p] = { total: 0, tp: 0, sl: 0 }
    pairMap[p].total++
    if (s.status === 'tp_hit' || s.status === 'tp1_hit' || s.status === 'tp2_hit' || s.status === 'tp3_hit') pairMap[p].tp++
    if (s.status === 'sl_hit') pairMap[p].sl++
  }
  const topPairs = Object.entries(pairMap)
    .map(([pair, d]) => ({ pair, signals: d.total, winRate: d.tp + d.sl > 0 ? Math.round((d.tp / (d.tp + d.sl)) * 100) : 0 }))
    .sort((a, b) => b.signals - a.signals)
    .slice(0, 5)

  // Direction split
  const buyCount  = signals.filter(s => String(s.direction).includes('BUY')).length
  const sellCount = signals.filter(s => String(s.direction).includes('SELL')).length

  // Market
  const forexCount  = signals.filter(s => (s.market ?? s.assetType) === 'forex').length
  const cryptoCount = signals.filter(s => (s.market ?? s.assetType) === 'crypto').length

  // Timeframe breakdown
  const tfMap: Record<string, { count: number; tp: number; sl: number }> = {}
  for (const s of signals) {
    const tf = s.timeframe ?? 'N/A'
    if (!tfMap[tf]) tfMap[tf] = { count: 0, tp: 0, sl: 0 }
    tfMap[tf].count++
    if (s.status === 'tp_hit' || s.status === 'tp1_hit' || s.status === 'tp2_hit' || s.status === 'tp3_hit') tfMap[tf].tp++
    if (s.status === 'sl_hit') tfMap[tf].sl++
  }
  const tfBreakdown = Object.entries(tfMap).map(([tf, d]) => ({
    tf, count: d.count, winRate: d.tp + d.sl > 0 ? Math.round((d.tp / (d.tp + d.sl)) * 100) : 0,
  }))

  // Users in period (createdAt = Date.now() number)
  const userSnap = await db.collection('users')
    .where('createdAt', '>=', start.getTime())
    .where('createdAt', '<=', end.getTime())
    .limit(500)
    .get()
  const newUsers = userSnap.size

  // Subscriptions in period
  const subSnap = await db.collection('subscriptions')
    .where('createdAt', '>=', start.toISOString())
    .where('createdAt', '<=', end.toISOString())
    .limit(500)
    .get()
  const newSubscriptions = subSnap.size
  const revenue = subSnap.docs.reduce((a, d) => a + (d.data().amount ?? 0), 0)

  const report: ReportData = {
    type,
    periodStart: start.toISOString(),
    periodEnd:   end.toISOString(),
    generatedAt: new Date().toISOString(),
    totalSignals: total, tpCount, slCount, expiredCount,
    winRate, profitFactor, avgRR, avgConfidence,
    topPairs, buyCount, sellCount, forexCount, cryptoCount, tfBreakdown,
    newUsers, activeUsers: 0, revenue, newSubscriptions,
  }

  return report
}

// GET — so'nggi yoki berilgan sana uchun hisobot
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    initAdmin()
    const db = getFirestore()
    const { searchParams } = new URL(req.url)
    const type = (searchParams.get('type') as ReportType) || 'daily'
    const dateStr = searchParams.get('date') || new Date().toISOString().slice(0, 10)
    const date = new Date(dateStr)
    const key = periodKey(type, date)

    // Cache dan tekshir
    const existing = await db.collection('reports').doc(`${type}-${key}`).get()
    if (existing.exists) {
      return NextResponse.json({ report: { id: existing.id, ...existing.data() }, cached: true })
    }

    // Yangi yaratamiz
    const report = await generateReport(type, date)
    await db.collection('reports').doc(`${type}-${key}`).set(report)
    return NextResponse.json({ report: { id: `${type}-${key}`, ...report }, cached: false })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST — yaratish yoki qayta hisoblash
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    initAdmin()
    const db = getFirestore()
    const body = await req.json() as { type?: ReportType; date?: string }
    const type = body.type || 'daily'
    const date = body.date ? new Date(body.date) : new Date()
    const key = periodKey(type, date)

    const report = await generateReport(type as ReportType, date)
    await db.collection('reports').doc(`${type}-${key}`).set(report)

    return NextResponse.json({ report: { id: `${type}-${key}`, ...report } })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// DELETE — kesh tozalash (qayta hisoblash uchun)
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    initAdmin()
    const db = getFirestore()
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'daily'
    const dateStr = searchParams.get('date') || new Date().toISOString().slice(0, 10)
    const date = new Date(dateStr)
    const key = periodKey(type as ReportType, date)

    await db.collection('reports').doc(`${type}-${key}`).delete()
    return NextResponse.json({ deleted: `${type}-${key}` })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

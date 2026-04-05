// ============================================================
// /api/admin/backtest/optimize
// Strategiya parametrlarini grid search orqali optimizatsiya qiladi
// POST { strategyId, paramGrid, period? }
// → Har bir kombinatsiyani test qiladi, eng yaxshisini qaytaradi
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore } from 'firebase-admin/firestore'

interface ParamGrid {
  minConfidence?: number[]     // [60, 65, 70, 75]
  minRR?: number[]             // [1.5, 2.0, 2.5]
  maxSpread?: number[]         // [2, 3, 5]
  sessionFilter?: string[]     // ['london', 'ny', 'london+ny', 'all']
  tpRatio?: number[]           // [1.5, 2.0, 2.5, 3.0]
}

interface OptimResult {
  params: Record<string, number | string>
  winRate: number
  profitFactor: number
  totalTrades: number
  avgRR: number
  score: number   // composite: winRate * profitFactor
}

function getPeriodStart(period: string): number {
  const now = Date.now()
  switch (period) {
    case 'week':    return now - 7 * 86400000
    case 'month':   return now - 30 * 86400000
    case '3months': return now - 90 * 86400000
    default:        return now - 90 * 86400000
  }
}

function cartesian<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>(
    (acc, arr) => acc.flatMap(a => arr.map(v => [...a, v])),
    [[]]
  )
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    initAdmin()
    const db = getFirestore()

    const body = await req.json() as {
      strategyId?: string
      paramGrid: ParamGrid
      period?: string
    }

    if (!body.paramGrid) {
      return NextResponse.json({ error: 'paramGrid majburiy' }, { status: 400 })
    }

    const period = body.period || '3months'
    const since = getPeriodStart(period)

    // Fetch signals from Firestore for backtesting
    const snap = await db.collection('signals')
      .where('status', 'in', ['tp_hit', 'sl_hit', 'expired'])
      .orderBy('createdAt', 'desc')
      .limit(300)
      .get()

    interface SigData {
      confidence?: number
      riskReward?: number
      pips?: number
      status: string
      createdAt: number | string
      timeframe?: string
    }

    const allSignals: SigData[] = snap.docs
      .map(d => ({ ...d.data() } as SigData))
      .filter(s => {
        const ts = typeof s.createdAt === 'number' ? s.createdAt : new Date(s.createdAt).getTime()
        return ts >= since
      })

    if (!allSignals.length) {
      return NextResponse.json({ error: 'Tahlil uchun yetarli signal yo\'q' }, { status: 400 })
    }

    // Build param combinations
    const gridKeys = Object.keys(body.paramGrid) as (keyof ParamGrid)[]
    const gridValues = gridKeys.map(k => (body.paramGrid[k] as unknown[]) ?? [])
    const combinations = cartesian(gridValues)

    const results: OptimResult[] = []

    for (const combo of combinations.slice(0, 100)) { // max 100 combinations
      const params: Record<string, number | string> = {}
      gridKeys.forEach((k, i) => { params[k] = combo[i] as number | string })

      const minConf = (params.minConfidence as number) ?? 0
      const minRR   = (params.minRR as number) ?? 0

      // Filter signals by these params
      const filtered = allSignals.filter(s => {
        if (minConf > 0 && (s.confidence ?? 0) < minConf) return false
        if (minRR > 0 && (s.riskReward ?? 0) < minRR) return false
        return true
      })

      if (filtered.length < 5) continue // not enough data

      const tp  = filtered.filter(s => s.status === 'tp_hit').length
      const sl  = filtered.filter(s => s.status === 'sl_hit').length
      const winRate = tp + sl > 0 ? Math.round((tp / (tp + sl)) * 100) : 0

      const winPips  = filtered.filter(s => s.status === 'tp_hit').reduce((a, s) => a + Math.abs(s.pips ?? (s.riskReward ?? 1.5) * 10), 0)
      const lossPips = filtered.filter(s => s.status === 'sl_hit').length * 10
      const profitFactor = lossPips > 0 ? +(winPips / lossPips).toFixed(2) : winPips > 0 ? 9.99 : 0

      const avgRR = filtered.length > 0
        ? +(filtered.reduce((a, s) => a + (s.riskReward ?? 0), 0) / filtered.length).toFixed(2)
        : 0

      const score = +(winRate * profitFactor / 100).toFixed(2)

      results.push({ params, winRate, profitFactor, totalTrades: filtered.length, avgRR, score })
    }

    if (!results.length) {
      return NextResponse.json({ error: 'Natija yo\'q — parametrlar signallarga mos kelmadi' }, { status: 400 })
    }

    results.sort((a, b) => b.score - a.score)
    const best = results[0]
    const top5 = results.slice(0, 5)

    // Save optimization result to Firestore
    const optRef = db.collection('backtestOptimizations').doc()
    await optRef.set({
      strategyId: body.strategyId || null,
      period,
      paramGrid: body.paramGrid,
      totalCombinations: results.length,
      totalSignals: allSignals.length,
      bestParams: best.params,
      bestScore: best.score,
      bestWinRate: best.winRate,
      bestProfitFactor: best.profitFactor,
      top5: top5,
      optimizedAt: new Date().toISOString(),
    })

    // If strategyId given — update strategy with best params & reset needsBacktest
    if (body.strategyId) {
      await db.collection('strategies').doc(body.strategyId).update({
        optimizedParams: best.params,
        lastOptimizedAt: new Date().toISOString(),
        needsBacktest: false,
        lastUpdated: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      best,
      top5,
      totalCombinations: results.length,
      totalSignals: allSignals.length,
      optimizationId: optRef.id,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// GET — optimization tarixi
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    initAdmin()
    const db = getFirestore()

    const { searchParams } = new URL(req.url)
    const strategyId = searchParams.get('strategyId')

    let query = db.collection('backtestOptimizations').orderBy('optimizedAt', 'desc').limit(20)
    if (strategyId) {
      query = db.collection('backtestOptimizations')
        .where('strategyId', '==', strategyId)
        .orderBy('optimizedAt', 'desc')
        .limit(10) as typeof query
    }

    const snap = await query.get()
    const optimizations = snap.docs.map(d => ({ id: d.id, ...d.data() }))

    return NextResponse.json({ optimizations })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

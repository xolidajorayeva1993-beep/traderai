import { NextRequest, NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

// GET  /api/admin/ai-stats?period=today|week|month
// POST /api/admin/ai-stats  { model, tokens, latencyMs, success, signalId? }

interface AiLogEntry {
  model: string
  tokens: number
  latencyMs: number
  success: boolean
  signalId?: string
  ts: FirebaseFirestore.Timestamp
}

export async function GET(req: NextRequest) {
  try {
    initAdmin()
    const db     = getFirestore()
    const period = new URL(req.url).searchParams.get('period') ?? 'today'

    const now   = new Date()
    const start = new Date()
    if (period === 'today') {
      start.setHours(0, 0, 0, 0)
    } else if (period === 'week') {
      start.setDate(now.getDate() - 7)
    } else {
      start.setDate(now.getDate() - 30)
    }

    const snap = await db.collection('aiLogs')
      .where('ts', '>=', start)
      .orderBy('ts', 'desc')
      .limit(500)
      .get()

    const logs = snap.docs.map(d => d.data() as AiLogEntry)

    // Aggregate per model
    const modelMap: Record<string, { calls: number; tokens: number; successCount: number; totalLatency: number }> = {}
    for (const log of logs) {
      const m = log.model ?? 'unknown'
      if (!modelMap[m]) modelMap[m] = { calls: 0, tokens: 0, successCount: 0, totalLatency: 0 }
      modelMap[m].calls++
      modelMap[m].tokens += log.tokens ?? 0
      modelMap[m].totalLatency += log.latencyMs ?? 0
      if (log.success) modelMap[m].successCount++
    }

    const stats = Object.entries(modelMap).map(([model, v]) => ({
      model,
      calls:      v.calls,
      tokens:     v.tokens,
      successRate: v.calls > 0 ? Math.round((v.successCount / v.calls) * 100) : 0,
      avgLatency:  v.calls > 0 ? Math.round(v.totalLatency / v.calls) : 0,
    }))

    // Today totals
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayLogs  = logs.filter(l => l.ts?.toDate?.() >= todayStart)
    const todayCalls = todayLogs.length
    const todayTokens = todayLogs.reduce((acc, l) => acc + (l.tokens ?? 0), 0)

    return NextResponse.json({ stats, todayCalls, todayTokens, period })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Partial<AiLogEntry>
    initAdmin()
    const db = getFirestore()
    await db.collection('aiLogs').add({
      model:     body.model ?? 'unknown',
      tokens:    body.tokens ?? 0,
      latencyMs: body.latencyMs ?? 0,
      success:   body.success ?? true,
      signalId:  body.signalId ?? null,
      ts:        FieldValue.serverTimestamp(),
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

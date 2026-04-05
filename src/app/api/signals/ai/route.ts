import { NextRequest, NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore } from 'firebase-admin/firestore'

export interface AiSignal {
  id: string
  symbol: string
  timeframe: string
  direction: 'BUY' | 'SELL'
  entry: number
  sl: number
  tp1: number
  tp2: number
  tp3: number
  rr: number
  /** Natija holati: open | tp1 | tp2 | tp3 | sl | cancelled */
  status: 'open' | 'tp1' | 'tp2' | 'tp3' | 'sl' | 'cancelled'
  /** Signal turi: ACTIVE (darhol) | PENDING (trigger kutilmoqda) */
  signalStatus: 'ACTIVE' | 'PENDING'
  triggerZone: { from: number; to: number } | null
  triggerCondition: string | null
  validUntil: string | null
  triggeredAt: string | null
  closedAt: string | null
  closedPrice: number | null
  pips: number | null
  createdAt: string
  aiReply: string | null
  chartUrl: string | null
}

// GET /api/signals/ai?limit=50
export async function GET(req: NextRequest) {
  try {
    initAdmin()
    const db = getFirestore()
    const url = new URL(req.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200)

    const snap = await db.collection('aiSignals')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()

    const signals: AiSignal[] = snap.docs.map(d => {
      const data = d.data()
      return {
        id:               d.id,
        symbol:           data.symbol           ?? '',
        timeframe:        data.timeframe        ?? '1h',
        direction:        data.direction        ?? 'BUY',
        entry:            data.entry            ?? 0,
        sl:               data.sl               ?? 0,
        tp1:              data.tp1              ?? 0,
        tp2:              data.tp2              ?? 0,
        tp3:              data.tp3              ?? 0,
        rr:               data.rr               ?? 0,
        status:           data.status           ?? 'open',
        signalStatus:     data.signalStatus     ?? 'ACTIVE',
        triggerZone:      data.triggerZone      ?? null,
        triggerCondition: data.triggerCondition ?? null,
        validUntil:       data.validUntil       ?? null,
        triggeredAt:      data.triggeredAt      ?? null,
        closedAt:         data.closedAt   ? (data.closedAt.toDate?.()?.toISOString()   ?? data.closedAt) : null,
        closedPrice:      data.closedPrice ?? null,
        pips:             data.pips        ?? null,
        createdAt:        data.createdAt   ? (data.createdAt.toDate?.()?.toISOString() ?? String(data.createdAt)) : new Date().toISOString(),
        aiReply:          data.aiReply    ?? null,
        chartUrl:         data.chartUrl   ?? null,
      }
    })

    // Stats hisoblash (cancelled natija hisoblanmaydi — faqat TP/SL)
    const openList     = signals.filter(s => s.status === 'open')
    const activeCount  = openList.filter(s => s.signalStatus === 'ACTIVE').length
    const pendingCount = openList.filter(s => s.signalStatus === 'PENDING').length
    const wins         = signals.filter(s => ['tp1','tp2','tp3'].includes(s.status))
    const losses       = signals.filter(s => s.status === 'sl')
    const cancelled    = signals.filter(s => s.status === 'cancelled').length
    const decided      = wins.length + losses.length
    const winRate      = decided > 0 ? Math.round((wins.length / decided) * 100) : 0
    const streak       = computeStreak(signals)

    return NextResponse.json({
      signals,
      stats: {
        total:     signals.length,
        open:      openList.length,
        active:    activeCount,
        pending:   pendingCount,
        wins:      wins.length,
        losses:    losses.length,
        cancelled,
        winRate,
        streak,
      }
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Server xatosi' }, { status: 500 })
  }
}

// Joriy ketma-ket TP seriyasini hisoblash (cancelled va open o'tkazib yuboriladi)
function computeStreak(signals: AiSignal[]): number {
  let streak = 0
  for (const s of signals) {
    if (s.status === 'open' || s.status === 'cancelled') continue
    if (s.status.startsWith('tp')) streak++
    else break
  }
  return streak
}

// PATCH /api/signals/ai  — signal natijasini yangilash
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as { id: string; status: AiSignal['status']; closedPrice: number }
    const { id, status, closedPrice } = body
    if (!id || !status) return NextResponse.json({ error: 'id va status kerak' }, { status: 400 })

    initAdmin()
    const db = getFirestore()
    const ref = db.collection('aiSignals').doc(id)
    const snap = await ref.get()
    if (!snap.exists) return NextResponse.json({ error: 'Signal topilmadi' }, { status: 404 })

    const data = snap.data()!
    const entry = data.entry as number
    const pips  = closedPrice != null ? parseFloat(((closedPrice - entry) * (data.direction === 'BUY' ? 1 : -1)).toFixed(2)) : null

    await ref.update({
      status,
      closedAt:    new Date().toISOString(),
      closedPrice: closedPrice ?? null,
      pips,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Server xatosi' }, { status: 500 })
  }
}

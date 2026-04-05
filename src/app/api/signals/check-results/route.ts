// ============================================================
// /api/signals/check-results — AI Signal natijalarini avtomatik hisoblash
// Signal berilgandan keyin: TP ga bordimi yoki SL ga bordimi?
// ACTIVE  → OHLCV candles orqali TP/SL tekshirish
// PENDING → Trigger zone kirilganmi? Expired?
// ============================================================
import { NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore } from 'firebase-admin/firestore'

// ─── Types ────────────────────────────────────────────────────
type OHLCBar = { time: number; open: number; high: number; low: number; close: number }

interface SignalDoc {
  id: string
  symbol: string
  timeframe: string
  direction: 'BUY' | 'SELL'
  entry: number; sl: number
  tp1: number; tp2: number; tp3: number
  signalStatus: 'ACTIVE' | 'PENDING'
  triggerZone?: { from: number; to: number } | null
  validUntil?: string | null
  triggeredAt?: string | null
  createdAt: string
}

// ─── Timeframe → Binance interval ────────────────────────────
function toBinanceInterval(tf: string): string {
  const m: Record<string, string> = {
    '1m':'1m', '5m':'5m', '15m':'15m', '30m':'30m',
    '1h':'1h', '2h':'2h', '4h':'4h',   '6h':'6h',
    '8h':'8h', '12h':'12h', '1d':'1d', '1w':'1w',
  }
  return m[tf.toLowerCase()] ?? '1h'
}

// ─── Pips / points hisoblash ─────────────────────────────────
function calcPips(entry: number, closedPrice: number, direction: 'BUY' | 'SELL', symbol: string): number {
  const raw = (closedPrice - entry) * (direction === 'BUY' ? 1 : -1)
  if (symbol.includes('JPY'))                  return +( raw * 100   ).toFixed(1)
  if (symbol.includes('XAU') || symbol.includes('XAG')) return +( raw * 10  ).toFixed(1)
  if (symbol.endsWith('USDT') || symbol.endsWith('BTC')) return +raw.toFixed(2)
  return +(raw * 10000).toFixed(1)  // forex pairs
}

// ─── Binance public OHLCV (crypto) ───────────────────────────
async function fetchBinanceOHLCV(symbol: string, tf: string, fromMs: number): Promise<OHLCBar[]> {
  const interval = toBinanceInterval(tf)
  const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&startTime=${fromMs}&limit=300`
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000), cache: 'no-store' })
    if (!r.ok) return []
    const raw = await r.json() as [number, string, string, string, string][]
    return raw.map(k => ({ time: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4] }))
  } catch { return [] }
}

// ─── Yahoo Finance public OHLCV (forex / gold) ───────────────
async function fetchYahooOHLCV(symbol: string, tf: string, fromMs: number): Promise<OHLCBar[]> {
  const yahooSym = symbol.includes('XAU') ? 'GC=F'
    : symbol.includes('XAG') ? 'SI=F'
    : symbol.includes('=X') ? symbol
    : symbol + '=X'

  const ageMs = Date.now() - fromMs
  const range  = ageMs > 30 * 86400_000 ? '60d' : ageMs > 7 * 86400_000 ? '30d' : '7d'
  const interval = tf.toLowerCase().startsWith('1d') || tf.toLowerCase().startsWith('1w') ? '1d' : '1h'

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=${interval}&range=${range}`
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TraderAI/1.0)' },
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    })
    if (!r.ok) return []
    const data = await r.json() as {
      chart: { result?: Array<{
        timestamp: number[]
        indicators: { quote: Array<{ open: number[]; high: number[]; low: number[]; close: number[] }> }
      }> }
    }
    const result = data.chart.result?.[0]
    if (!result) return []
    const { timestamp, indicators: { quote: [q] } } = result
    return timestamp
      .map((t, i) => ({ time: t * 1000, open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i] }))
      .filter(b => b.time >= fromMs && isFinite(b.open) && isFinite(b.high))
  } catch { return [] }
}

// ─── Unified OHLCV fetcher ────────────────────────────────────
async function fetchOHLCV(symbol: string, tf: string, fromMs: number): Promise<OHLCBar[]> {
  const isCrypto = /USDT$|BTC$|ETH$|BNB$/i.test(symbol)
  return isCrypto
    ? fetchBinanceOHLCV(symbol, tf, fromMs)
    : fetchYahooOHLCV(symbol, tf, fromMs)
}

// ─── Core: OHLCV skanerlash — birinchi TP yoki SL ────────────
// Returns: null = hali ochiq
// Mantiqi:
//   1. Har bir candle da SL va TP levellarini tekshir
//   2. TP engida (TP1/TP2/TP3) yetganda maxTpHit ni yangilaymiz
//   3. SL hit:
//      - maxTpHit == 0 → to'liq loss (SL)
//      - maxTpHit > 0  → oldingi candle(lar)da TP yetgan, WIN (maxTpHit level)
//   4. Bir candle da ikkalasi → opening price yaqinligiga qarab hal qilinadi
// ─────────────────────────────────────────────────────────────
export function scanForResult(
  bars: OHLCBar[],
  direction: 'BUY' | 'SELL',
  sl: number, tp1: number, tp2: number, tp3: number,
): { result: 'tp1'|'tp2'|'tp3'|'sl'; closedPrice: number; closedAt: string } | null {
  let maxTpHit = 0  // 0=none, 1=tp1, 2=tp2, 3=tp3

  for (const bar of bars) {
    if (!isFinite(bar.high) || !isFinite(bar.low)) continue

    let slHit = false
    let tpHitThisBar = 0

    if (direction === 'BUY') {
      slHit         = bar.low  <= sl
      tpHitThisBar  = bar.high >= tp3 ? 3 : bar.high >= tp2 ? 2 : bar.high >= tp1 ? 1 : 0
    } else {
      slHit         = bar.high >= sl
      tpHitThisBar  = bar.low  <= tp3 ? 3 : bar.low  <= tp2 ? 2 : bar.low  <= tp1 ? 1 : 0
    }

    // Ikkala bir xil candleda: open narxga yaqinligiga qarab kim birinchi yetganini aniqlash
    if (slHit && tpHitThisBar > 0) {
      const distSL  = Math.abs(bar.open - sl)
      const distTP1 = Math.abs(bar.open - tp1)

      if (distSL < distTP1) {
        // Open SLga yaqin → SL birinchi yetgan
        if (maxTpHit === 0) {
          return { result: 'sl', closedPrice: sl, closedAt: new Date(bar.time).toISOString() }
        }
        // Oldin TP yetgan bo'lsa → o'sha darajada WIN
        return buildTpResult(maxTpHit, tp1, tp2, tp3, bar.time)
      } else {
        // Open TPga yaqin → TP birinchi yetgan
        const newMax = Math.max(maxTpHit, tpHitThisBar)
        if (newMax >= 3) return buildTpResult(3, tp1, tp2, tp3, bar.time)
        maxTpHit = newMax
        // SL ham yetdi → bu darajada yopamiz
        return buildTpResult(maxTpHit, tp1, tp2, tp3, bar.time)
      }
    }

    // Faqat SL hit
    if (slHit) {
      if (maxTpHit > 0) return buildTpResult(maxTpHit, tp1, tp2, tp3, bar.time)
      return { result: 'sl', closedPrice: sl, closedAt: new Date(bar.time).toISOString() }
    }

    // TP hit → darhol o'sha darajada yopamiz
    if (tpHitThisBar > 0) {
      maxTpHit = Math.max(maxTpHit, tpHitThisBar)
      return buildTpResult(maxTpHit, tp1, tp2, tp3, bar.time)
    }
  }

  return null  // hali ochiq
}

function buildTpResult(
  level: number,
  tp1: number, tp2: number, tp3: number,
  barTime: number,
): { result: 'tp1'|'tp2'|'tp3'; closedPrice: number; closedAt: string } {
  const map: Record<number, 'tp1'|'tp2'|'tp3'> = { 1: 'tp1', 2: 'tp2', 3: 'tp3' }
  const prices = { 1: tp1, 2: tp2, 3: tp3 }
  const lv = Math.max(1, Math.min(3, level)) as 1|2|3
  return { result: map[lv], closedPrice: prices[lv], closedAt: new Date(barTime).toISOString() }
}

// ─── PENDING trigger tekshirish ───────────────────────────────
function isTriggerHit(bar: OHLCBar, direction: 'BUY' | 'SELL', triggerZone: { from: number; to: number }): boolean {
  const zoneLow  = Math.min(triggerZone.from, triggerZone.to)
  const zoneHigh = Math.max(triggerZone.from, triggerZone.to)
  if (direction === 'BUY')  return bar.low  <= zoneHigh
  if (direction === 'SELL') return bar.high >= zoneLow
  return false
}

// ─── MAIN: GET /api/signals/check-results ────────────────────
export async function GET() {
  try {
    initAdmin()
    const db  = getFirestore()
    const now = Date.now()

    // Hamma ochiq signallarni olamiz
    const snap = await db.collection('aiSignals')
      .where('status', '==', 'open')
      .limit(60)
      .get()

    if (snap.empty) {
      return NextResponse.json({ updated: 0, results: [], message: 'Ochiq signal yo\'q' })
    }

    const log: string[] = []
    const batchUpdates: Promise<void>[] = []

    for (const docSnap of snap.docs) {
      batchUpdates.push((async () => {
        const d = docSnap.data()
        const sig: SignalDoc = {
          id:           docSnap.id,
          symbol:       String(d.symbol     ?? ''),
          timeframe:    String(d.timeframe  ?? '1h'),
          direction:    (d.direction as 'BUY'|'SELL') ?? 'BUY',
          entry:        Number(d.entry      ?? 0),
          sl:           Number(d.sl         ?? 0),
          tp1:          Number(d.tp1        ?? 0),
          tp2:          Number(d.tp2        ?? 0),
          tp3:          Number(d.tp3        ?? 0),
          signalStatus: (d.signalStatus as 'ACTIVE'|'PENDING') ?? 'ACTIVE',
          triggerZone:  d.triggerZone ?? null,
          validUntil:   d.validUntil  ?? null,
          triggeredAt:  d.triggeredAt ?? null,
          createdAt:    d.createdAt?.toDate?.()?.toISOString() ?? String(d.createdAt ?? ''),
        }

        if (!sig.symbol || sig.entry <= 0) return

        // ─── PENDING signal tekshirish ─────────────────────────
        if (sig.signalStatus === 'PENDING' && !sig.triggeredAt) {
          // 1) Muddat tugadimi?
          if (sig.validUntil && new Date(sig.validUntil).getTime() < now) {
            await docSnap.ref.update({
              status:    'cancelled',
              closedAt:  new Date().toISOString(),
              pips:      null,
              closedPrice: null,
            })
            log.push(`${sig.symbol}: BEKOR (muddat tugadi)`)
            return
          }

          // 2) Trigger zone kirilganmi?
          if (sig.triggerZone) {
            const fromMs = new Date(sig.createdAt).getTime()
            const bars   = await fetchOHLCV(sig.symbol, sig.timeframe, fromMs)
            const triggerBar = bars.find(b => isTriggerHit(b, sig.direction, sig.triggerZone!))

            if (triggerBar) {
              await docSnap.ref.update({
                signalStatus: 'ACTIVE',
                triggeredAt:  new Date(triggerBar.time).toISOString(),
              })
              log.push(`${sig.symbol}: PENDING → AKTIV (trigger ${new Date(triggerBar.time).toLocaleString()})`)

              // Trigger dan keyingi barlarda ACTIVE kabi TP/SL tekshiramiz
              const fromTrigger = bars.filter(b => b.time >= triggerBar.time)
              const outcome = scanForResult(fromTrigger, sig.direction, sig.sl, sig.tp1, sig.tp2, sig.tp3)
              if (outcome) {
                const pips = calcPips(sig.entry, outcome.closedPrice, sig.direction, sig.symbol)
                await docSnap.ref.update({
                  status: outcome.result, closedAt: outcome.closedAt,
                  closedPrice: outcome.closedPrice, pips,
                })
                log.push(`${sig.symbol}: ${outcome.result.toUpperCase()} (${pips > 0 ? '+' : ''}${pips} pips)`)
              }
            }
          }
          return
        }

        // ─── ACTIVE signal tekshirish ──────────────────────────
        const fromMs = new Date(sig.triggeredAt ?? sig.createdAt).getTime()
        const bars   = await fetchOHLCV(sig.symbol, sig.timeframe, fromMs)
        if (!bars.length) {
          log.push(`${sig.symbol}: ma'lumot topilmadi`)
          return
        }

        const outcome = scanForResult(bars, sig.direction, sig.sl, sig.tp1, sig.tp2, sig.tp3)
        if (!outcome) {
          log.push(`${sig.symbol}: hali ochiq (TP/SL yetilmadi)`)
          return
        }

        const pips = calcPips(sig.entry, outcome.closedPrice, sig.direction, sig.symbol)
        await docSnap.ref.update({
          status:      outcome.result,
          closedAt:    outcome.closedAt,
          closedPrice: outcome.closedPrice,
          pips,
        })
        log.push(`${sig.symbol} ${sig.direction}: ${outcome.result.toUpperCase()} (${pips > 0 ? '+' : ''}${pips} pips)`)
      })())
    }

    await Promise.all(batchUpdates)

    return NextResponse.json({
      updated: log.filter(l => !l.includes('ochiq') && !l.includes('topilmadi')).length,
      total: snap.size,
      results: log,
    })
  } catch (err) {
    console.error('[check-results]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server xatosi' },
      { status: 500 },
    )
  }
}

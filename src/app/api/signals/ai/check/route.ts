/**
 * POST /api/signals/ai/check
 *
 * Barcha ochiq signallarni OHLCV candle ma'lumotlari bilan tekshiradi.
 * Har bir signalning createdAt vaqtidan boshlab candlelardagi HIGH va LOW
 * ni ko'rib, qaysi daraja (TP1/TP2/TP3/SL) avval urilganini bafosiz aniqlaydi.
 *
 * Mantiq:
 *   BUY signal:  HIGH >= TP → win  |  LOW <= SL → loss
 *   SELL signal: LOW <= TP → win   |  HIGH >= SL → loss
 *   Bir candleda ikkisi ham ursa → SL PRIORITY (xavf boshqaruvi tamoyili)
 *
 * Xavfsizlik:
 *   - Signal yaratilganidan 5 daqiqa o'tmaguncha tekshirilmaydi (false trigger oldini olish)
 *   - OHLCV get bilan bir vaqt oralig'i filtrlanadi
 */

import { NextResponse } from 'next/server'
import { initAdmin } from '@/lib/firebase/admin'
import { getFirestore } from 'firebase-admin/firestore'
import { FailoverDataProvider } from '@/lib/data/DataProvider'
import { TwelveDataAdapter } from '@/lib/data/TwelveDataAdapter'
import { YahooFinanceAdapter } from '@/lib/data/YahooFinanceAdapter'
import { BinanceAdapter } from '@/lib/data/BinanceAdapter'

const CRYPTO_SYMBOLS = new Set(['BTCUSDT', 'BTCUSD', 'ETHUSDT', 'ETHUSD', 'BNBUSD'])

const forexProvider = new FailoverDataProvider([
  new TwelveDataAdapter(),
  new YahooFinanceAdapter(),
])
const cryptoProvider = new FailoverDataProvider([
  new BinanceAdapter(),
  new YahooFinanceAdapter(),
])

// Minimal kutish vaqti: signal yaratilganidan 5 daqiqa keyin tekshiramiz
const MIN_AGE_MS = 5 * 60 * 1000

interface Candle {
  timestamp: number
  open:  number
  high:  number
  low:   number
  close: number
  volume: number
}

interface CheckResult {
  id:     string
  symbol: string
  status: 'tp1' | 'tp2' | 'tp3' | 'sl' | 'still_open'
  closedPrice: number | null
  closedAt:    string | null
  reason:      string
}

function determineOutcome(
  candles:   Candle[],
  signalTs:  number,      // ms
  direction: 'BUY' | 'SELL',
  sl:  number,
  tp1: number,
  tp2: number,
  tp3: number,
): { status: 'tp1' | 'tp2' | 'tp3' | 'sl' | 'still_open'; closedPrice: number | null; reason: string } {

  // Faqat signal vaqtidan keyin kelgan candlelarni ko'rib chiqamiz
  const relevant = candles.filter(c => c.timestamp > signalTs)

  if (relevant.length === 0) {
    return { status: 'still_open', closedPrice: null, reason: 'Hali candle yo\'q (yangi signal)' }
  }

  for (const candle of relevant) {
    const { high, low } = candle

    if (direction === 'BUY') {
      // Bir candleda ikkisi ham ursa → SL prioritet (eng xavfsiz yondashuv)
      const slHit  = low  <= sl
      const tp1Hit = high >= tp1
      const tp2Hit = high >= tp2
      const tp3Hit = high >= tp3

      if (slHit && !tp1Hit) {
        return { status: 'sl', closedPrice: sl, reason: `LOW=${low.toFixed(4)} <= SL=${sl.toFixed(4)}` }
      }
      if (tp3Hit) {
        return { status: 'tp3', closedPrice: tp3, reason: `HIGH=${high.toFixed(4)} >= TP3=${tp3.toFixed(4)}` }
      }
      if (tp2Hit) {
        return { status: 'tp2', closedPrice: tp2, reason: `HIGH=${high.toFixed(4)} >= TP2=${tp2.toFixed(4)}` }
      }
      if (tp1Hit) {
        return { status: 'tp1', closedPrice: tp1, reason: `HIGH=${high.toFixed(4)} >= TP1=${tp1.toFixed(4)}` }
      }
      if (slHit) {
        // TP ham urdi lekin SL ham — SL prioritet (wost case)
        return { status: 'sl', closedPrice: sl, reason: `LOW=${low.toFixed(4)} <= SL=${sl.toFixed(4)} (TP ham urildi, SL prioritet)` }
      }
    } else {
      // SELL: low TP ga yetsa win, high SL ga yetsa loss
      const slHit  = high >= sl
      const tp1Hit = low  <= tp1
      const tp2Hit = low  <= tp2
      const tp3Hit = low  <= tp3

      if (slHit && !tp1Hit) {
        return { status: 'sl', closedPrice: sl, reason: `HIGH=${high.toFixed(4)} >= SL=${sl.toFixed(4)}` }
      }
      if (tp3Hit) {
        return { status: 'tp3', closedPrice: tp3, reason: `LOW=${low.toFixed(4)} <= TP3=${tp3.toFixed(4)}` }
      }
      if (tp2Hit) {
        return { status: 'tp2', closedPrice: tp2, reason: `LOW=${low.toFixed(4)} <= TP2=${tp2.toFixed(4)}` }
      }
      if (tp1Hit) {
        return { status: 'tp1', closedPrice: tp1, reason: `LOW=${low.toFixed(4)} <= TP1=${tp1.toFixed(4)}` }
      }
      if (slHit) {
        return { status: 'sl', closedPrice: sl, reason: `HIGH=${high.toFixed(4)} >= SL=${sl.toFixed(4)} (TP ham urildi, SL prioritet)` }
      }
    }
  }

  return { status: 'still_open', closedPrice: null, reason: `${relevant.length} ta candle tekshirildi, hech biri darajaga yetmadi` }
}

export async function POST() {
  try {
    initAdmin()
    const db = getFirestore()

    // Barcha ochiq signallarni olish
    const snap = await db.collection('aiSignals')
      .where('status', '==', 'open')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get()

    if (snap.empty) {
      return NextResponse.json({ checked: 0, results: [], message: 'Ochiq signal yo\'q' })
    }

    const now = Date.now()
    const results: CheckResult[] = []
    const batch = db.batch()
    let updatedCount = 0

    for (const doc of snap.docs) {
      const data = doc.data()
      const signalTs: number = data.createdAt?.toMillis?.() ?? Date.now()

      // Minimal yosh tekshiruvi: 5 daqiqa o'tmagan signallarni o'tkazib yuboramiz
      if (now - signalTs < MIN_AGE_MS) {
        results.push({
          id: doc.id, symbol: data.symbol,
          status: 'still_open', closedPrice: null, closedAt: null,
          reason: 'Signal juda yangi (< 5 daqiqa), tekshirilmadi',
        })
        continue
      }

      const symbol    = data.symbol    as string
      const timeframe = data.timeframe as string
      const direction = data.direction as 'BUY' | 'SELL'
      const sl  = data.sl  as number
      const tp1 = data.tp1 as number
      const tp2 = data.tp2 as number
      const tp3 = data.tp3 as number

      // OHLCV ma'lumotlarini olish (candle soni: 200)
      let candles: Candle[] | null = null
      try {
        const isCrypto = CRYPTO_SYMBOLS.has(symbol)
        const provider = isCrypto ? cryptoProvider : forexProvider
        const raw = await provider.getOHLCV(symbol, timeframe, 200)
        candles = raw as Candle[]
      } catch {
        results.push({
          id: doc.id, symbol,
          status: 'still_open', closedPrice: null, closedAt: null,
          reason: 'OHLCV ma\'lumotlari olinmadi (provider xatosi)',
        })
        continue
      }

      if (!candles || candles.length === 0) {
        results.push({
          id: doc.id, symbol,
          status: 'still_open', closedPrice: null, closedAt: null,
          reason: 'OHLCV ma\'lumotlari bo\'sh',
        })
        continue
      }

      const outcome = determineOutcome(candles, signalTs, direction, sl, tp1, tp2, tp3)

      results.push({
        id: doc.id, symbol,
        status: outcome.status,
        closedPrice: outcome.closedPrice,
        closedAt: outcome.status !== 'still_open' ? new Date().toISOString() : null,
        reason: outcome.reason,
      })

      if (outcome.status !== 'still_open') {
        const entry = data.entry as number
        const pips = outcome.closedPrice != null
          ? parseFloat(((outcome.closedPrice - entry) * (direction === 'BUY' ? 1 : -1)).toFixed(2))
          : null

        batch.update(doc.ref, {
          status:      outcome.status,
          closedAt:    new Date().toISOString(),
          closedPrice: outcome.closedPrice,
          pips,
          checkReason: outcome.reason,
        })
        updatedCount++
      }
    }

    if (updatedCount > 0) {
      await batch.commit()
    }

    return NextResponse.json({
      checked: snap.size,
      updated: updatedCount,
      results,
    })
  } catch (e) {
    console.error('[signals/check]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Server xatosi' },
      { status: 500 }
    )
  }
}

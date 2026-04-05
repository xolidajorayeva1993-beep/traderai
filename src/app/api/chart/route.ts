/**
 * GET /api/chart?symbol=EURUSD&tf=4h&entry=1.152&sl=1.155&tp1=1.15&tp2=1.148&tp3=1.146
 *
 * Signal darajalari asosida OHLCV ma'lumotlarini olib, grafikni PNG
 * sifatida qaytaradi. Dashboard modal uchun ishlatiladi — Firestore'da
 * katta fayllar saqlamaslik uchun on-demand generatsiya.
 *
 * Javob: image/png (binary) yoki JSON xato
 */

import { type NextRequest, NextResponse } from 'next/server'
import { FailoverDataProvider } from '@/lib/data/DataProvider'
import { TwelveDataAdapter } from '@/lib/data/TwelveDataAdapter'
import { YahooFinanceAdapter } from '@/lib/data/YahooFinanceAdapter'
import { BinanceAdapter } from '@/lib/data/BinanceAdapter'
import { withOHLCVCache } from '@/lib/ohlcvCache'
import { generateChartSVG } from '@/lib/analysis/chartRenderer'
import { svgToPngBase64 } from '@/lib/ai/svgToImage'
import type { Levels } from '@/lib/analysis/chartRenderer'
import type { FullAnalysisResult } from '@/lib/analysis/types'

const CRYPTO_SYMBOLS = new Set(['BTCUSDT', 'BTCUSD', 'ETHUSDT', 'ETHUSD', 'BNBUSD'])
const forexProvider = new FailoverDataProvider([
  new TwelveDataAdapter(),
  new YahooFinanceAdapter(),
])
const cryptoProvider = new FailoverDataProvider([
  new BinanceAdapter(),
  new YahooFinanceAdapter(),
])

function emptyAnalysis(): FullAnalysisResult {
  return {
    indicators: { rsi: { value: 50 }, macd: { macd: 0, signal: 0, histogram: 0 }, atr: { value: 0 }, ema: [] },
    snr: { supports: [], resistances: [], nearestSupport: null, nearestResistance: null },
    fibonacci: { retracementLevels: [], swingHigh: 0, swingLow: 0 },
    patterns: { patterns: [] },
    trendline: { mainTrend: 'sideways', shortTrend: 'sideways' },
    confluence: { finalScore: 0, direction: 'NEUTRAL', components: { indicators: 0, snr: 0, patterns: 0, trendline: 0, fibonacci: 0, gann: 0, smc: 0 } },
    smc: { lastBOS: null, fvgs: [], orderBlocks: [] },
    gann: {},
  } as unknown as FullAnalysisResult
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol')?.toUpperCase() ?? ''
  const tf     = searchParams.get('tf') ?? '1h'
  const entry  = parseFloat(searchParams.get('entry') ?? '0')
  const sl     = parseFloat(searchParams.get('sl')    ?? '0')
  const tp1    = parseFloat(searchParams.get('tp1')   ?? '0')
  const tp2    = parseFloat(searchParams.get('tp2')   ?? tp1.toString())
  const tp3    = parseFloat(searchParams.get('tp3')   ?? tp2.toString())

  if (!symbol || !entry || !sl || !tp1) {
    return NextResponse.json({ error: 'symbol, entry, sl, tp1 majburiy' }, { status: 400 })
  }

  try {
    const isCrypto = CRYPTO_SYMBOLS.has(symbol)
    const provider = isCrypto ? cryptoProvider : forexProvider
    const candles = await withOHLCVCache(symbol, tf, () => provider.getOHLCV(symbol, tf, 200))

    if (!candles || candles.length < 10) {
      return NextResponse.json({ error: 'OHLCV ma\'lumotlari olinmadi' }, { status: 502 })
    }

    const levels: Levels = {
      entry,
      sl,
      tp1,
      tp2: isNaN(tp2) ? tp1 : tp2,
      tp3: isNaN(tp3) ? tp1 : tp3,
      rr: Math.abs(tp1 - entry) / Math.max(Math.abs(entry - sl), 0.0001),
    }

    const svgStr = generateChartSVG(symbol, tf, candles, emptyAnalysis(), levels)
    const pngBase64 = await svgToPngBase64(svgStr)

    if (!pngBase64) {
      return NextResponse.json({ error: 'Grafik yaratishda xato' }, { status: 500 })
    }

    const pngBuffer = Buffer.from(pngBase64, 'base64')
    return new Response(pngBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=300', // 5 daqiqa kesh (OHLCV ham keshlangan)
        'Content-Length': String(pngBuffer.length),
      },
    })
  } catch (e) {
    console.error('[api/chart]', e)
    return NextResponse.json({ error: 'Server xatosi' }, { status: 500 })
  }
}

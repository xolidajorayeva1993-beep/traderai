// ============================================================
// GET /api/ai/analyze?symbol=EURUSD&timeframe=4h
// Standalone AI analysis endpoint (without chart rendering)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { runFullAnalysis, DEFAULT_WEIGHTS } from '@/lib/analysis'
import { withOHLCVCache } from '@/lib/ohlcvCache'
import { forexProvider, cryptoProvider } from '@/lib/data'
import { runFundamentalAnalysis } from '@/lib/fundamental'
import { runAIAnalysis } from '@/lib/ai'
import type { AnalysisContext } from '@/lib/ai'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  symbol:    z.string().min(3).max(20).toUpperCase(),
  timeframe: z.enum(['15m', '1h', '4h', '1d']).default('4h'),
})

const CRYPTO_SYMBOLS = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOT']

function isCrypto(symbol: string): boolean {
  return CRYPTO_SYMBOLS.some((s) => symbol.includes(s)) || symbol.endsWith('USDT')
}

function buildContext(
  symbol: string,
  timeframe: string,
  analysis: Awaited<ReturnType<typeof runFullAnalysis>>,
  currentPrice: number,
  fundamental: Awaited<ReturnType<typeof runFundamentalAnalysis>> | null,
): AnalysisContext {
  const ind = analysis.indicators
  const snr = analysis.snr
  const fib = analysis.fibonacci
  const conf = analysis.confluence

  // EMA values from indicator result
  const ema = (period: number) =>
    ind.ema.find((e) => e.period === period)?.value ?? currentPrice

  // ATR value
  const atr = ind.atr.value ?? 0.001

  // SNR nearest levels
  const nearestSupport     = snr.nearestSupport     ? (snr.nearestSupport.priceTop + snr.nearestSupport.priceBottom) / 2      : null
  const nearestResistance  = snr.nearestResistance  ? (snr.nearestResistance.priceTop + snr.nearestResistance.priceBottom) / 2 : null
  const supportStrength    = snr.nearestSupport?.strength    ?? 0
  const resistanceStrength = snr.nearestResistance?.strength ?? 0

  // Fibonacci retracements (top 6 levels, sorted by price)
  const fibLevels = fib.retracementLevels
    .slice(0, 6)
    .map((l) => ({ level: l.label, price: l.price }))

  // Confluence strategies
  const strategies = [
    { name: 'Texnik Indikatorlar', score: conf.components.indicators, direction: conf.direction },
    { name: 'SNR Zonalar',         score: conf.components.snr,         direction: conf.direction },
    { name: 'Chart Patterns',      score: conf.components.patterns,    direction: conf.direction },
    { name: 'Trendline',           score: conf.components.trendline,   direction: conf.direction },
    { name: 'Fibonacci',           score: conf.components.fibonacci,   direction: conf.direction },
    { name: 'Gann',                score: conf.components.gann,        direction: conf.direction },
    { name: 'SMC / Price Action',  score: conf.components.smc,         direction: conf.direction },
  ]

  // Trend from trendline
  const trendMap = { up: 'bullish', down: 'bearish', sideways: 'sideways' } as const
  const trend: string = trendMap[analysis.trendline.mainTrend] ?? 'sideways'

  const ctx: AnalysisContext = {
    symbol,
    timeframe,
    currentPrice,
    indicators: {
      rsi:   ind.rsi.value   ?? 50,
      macd: {
        value:     ind.macd.macd      ?? 0,
        signal:    ind.macd.signal    ?? 0,
        histogram: ind.macd.histogram ?? 0,
      },
      ema20:  ema(20),
      ema50:  ema(50),
      ema200: ema(200),
      atr,
    },
    confluence: {
      score:      conf.finalScore,
      direction:  conf.direction,
      strategies,
    },
    snr: {
      nearestSupport,
      nearestResistance,
      supportStrength,
      resistanceStrength,
    },
    fibonacci: {
      retracements: fibLevels,
      trend: fib.swingHigh > fib.swingLow ? 'bearish_retracement' : 'bullish_retracement',
    },
    patterns: analysis.patterns.patterns.map((p) => ({
      type:      p.type,
      direction: p.direction,
      score:     p.score,
    })),
    trend,
  }

  // Attach fundamental if available
  if (fundamental) {
    const fs = fundamental.fundamentalScore
    ctx.fundamental = {
      score:         fs.overallScore,
      direction:     fs.direction,
      highlights:    fs.highlights,
      signalBlocked: fs.signalBlocked,
      blockedReason: fs.blockedReason ?? undefined,
    }
  }

  return ctx
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl
  const parse = querySchema.safeParse({
    symbol:    url.searchParams.get('symbol')    ?? '',
    timeframe: url.searchParams.get('timeframe') ?? '4h',
  })

  if (!parse.success) {
    return NextResponse.json({ error: 'Invalid params', details: parse.error.flatten() }, { status: 400 })
  }

  const { symbol, timeframe } = parse.data

  try {
    const provider = isCrypto(symbol) ? cryptoProvider : forexProvider

    const [candlesResult, fundamentalResult] = await Promise.allSettled([
      withOHLCVCache(symbol, timeframe, () => provider.getOHLCV(symbol, timeframe, 200)),
      runFundamentalAnalysis(symbol),
    ])

    const candleData      = candlesResult.status      === 'fulfilled' ? candlesResult.value      : null
    const fundamentalData = fundamentalResult.status  === 'fulfilled' ? fundamentalResult.value  : null

    if (!candleData || candleData.length < 30) {
      return NextResponse.json({ error: "Ma'lumot yetarli emas" }, { status: 422 })
    }

    const analysis     = await runFullAnalysis(symbol, timeframe, candleData, DEFAULT_WEIGHTS)
    const currentPrice = candleData[candleData.length - 1].close
    const ctx          = buildContext(symbol, timeframe, analysis, currentPrice, fundamentalData)

    const aiResult = await runAIAnalysis(ctx)

    return NextResponse.json(aiResult)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI tahlil xatosi'
    console.error(`[ai/analyze] ${symbol}:`, message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

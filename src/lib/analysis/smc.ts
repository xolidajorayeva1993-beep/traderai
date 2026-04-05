// ============================================================
// Faza 3.7 — Price Action & Smart Money Concepts (SMC)
// Market Structure, BOS, CHoCH, FVG, Liquidity Sweep
// ============================================================
import type {
  OHLCVCandle, SMCResult, MarketStructurePoint,
  FairValueGap, LiquiditySweep, SignalDirection
} from './types'

// ------------------------------------------------------------------
// Market Structure: HH, HL, LH, LL aniqlash
// ------------------------------------------------------------------
function detectMarketStructure(candles: OHLCVCandle[]): MarketStructurePoint[] {
  const points: MarketStructurePoint[] = []
  const lb = 3

  const swingHighs: { price: number; index: number }[] = []
  const swingLows: { price: number; index: number }[] = []

  for (let i = lb; i < candles.length - lb; i++) {
    let isHigh = true, isLow = true
    for (let j = i - lb; j <= i + lb; j++) {
      if (j === i) continue
      if (candles[j].high >= candles[i].high) isHigh = false
      if (candles[j].low <= candles[i].low) isLow = false
    }
    if (isHigh) swingHighs.push({ price: candles[i].high, index: i })
    if (isLow) swingLows.push({ price: candles[i].low, index: i })
  }

  // High strukturasi
  for (let i = 1; i < swingHighs.length; i++) {
    const prev = swingHighs[i - 1]
    const curr = swingHighs[i]
    if (curr.price > prev.price) {
      points.push({ type: 'HH', price: curr.price, index: curr.index })
    } else {
      points.push({ type: 'LH', price: curr.price, index: curr.index })
    }
  }

  // Low strukturasi
  for (let i = 1; i < swingLows.length; i++) {
    const prev = swingLows[i - 1]
    const curr = swingLows[i]
    if (curr.price > prev.price) {
      points.push({ type: 'HL', price: curr.price, index: curr.index })
    } else {
      points.push({ type: 'LL', price: curr.price, index: curr.index })
    }
  }

  // Index bo'yicha saralash
  return points.sort((a, b) => a.index - b.index).slice(-20)
}

// ------------------------------------------------------------------
// Break of Structure (BOS) va Change of Character (CHoCH)
// ------------------------------------------------------------------
function detectBOSandCHoCH(
  structure: MarketStructurePoint[],
  candles: OHLCVCandle[]
): {
  lastBOS: { price: number; direction: 'bullish' | 'bearish' } | null
  lastCHoCH: { price: number; direction: 'bullish' | 'bearish' } | null
} {
  let lastBOS: { price: number; direction: 'bullish' | 'bearish' } | null = null
  let lastCHoCH: { price: number; direction: 'bullish' | 'bearish' } | null = null

  const recentHighs = structure.filter((p) => p.type === 'HH' || p.type === 'LH')
  const recentLows = structure.filter((p) => p.type === 'HL' || p.type === 'LL')

  if (recentHighs.length >= 2 && recentLows.length >= 2) {
    const lastHigh = recentHighs[recentHighs.length - 1]
    const prevHigh = recentHighs[recentHighs.length - 2]
    const lastLow = recentLows[recentLows.length - 1]
    const prevLow = recentLows[recentLows.length - 2]

    const currentPrice = candles[candles.length - 1].close

    // Bullish BOS: current price oldingi HH dan yuqori = strukturani sindirdi
    if (lastHigh.type === 'LH' && currentPrice > prevHigh.price) {
      lastBOS = { price: prevHigh.price, direction: 'bullish' }
    }
    // Bearish BOS: current price oldingi LL dan past
    if (lastLow.type === 'HL' && currentPrice < prevLow.price) {
      lastBOS = { price: prevLow.price, direction: 'bearish' }
    }

    // CHoCH: trend yo'nalishi o'zgardi
    const wasUptrend = prevHigh.type === 'HH' && prevLow.type === 'HL'
    const wasDowntrend = prevHigh.type === 'LH' && prevLow.type === 'LL'

    if (wasUptrend && lastHigh.type === 'LH') {
      lastCHoCH = { price: lastHigh.price, direction: 'bearish' }
    }
    if (wasDowntrend && lastLow.type === 'HL') {
      lastCHoCH = { price: lastLow.price, direction: 'bullish' }
    }
  }

  return { lastBOS, lastCHoCH }
}

// ------------------------------------------------------------------
// Fair Value Gap (FVG) — 3 ta sham o'rtasidagi bo'shliq
// ------------------------------------------------------------------
function detectFVG(candles: OHLCVCandle[]): FairValueGap[] {
  const gaps: FairValueGap[] = []

  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2] // birinchi
    const c2 = candles[i - 1] // o'rta (katta harakat)
    const c3 = candles[i]     // uchinchi

    // Bullish FVG: c1 high < c3 low (bo'shliq)
    if (c1.high < c3.low) {
      const top = c3.low
      const bottom = c1.high
      // To'ldirilganmi tekshirish: keyingi shamlar bu darajaga qaytganmi?
      const filled = candles.slice(i + 1).some(
        (c) => c.low <= top && c.high >= bottom
      )
      gaps.push({
        direction: 'bullish',
        top,
        bottom,
        midpoint: (top + bottom) / 2,
        startIndex: i - 2,
        filled,
      })
    }

    // Bearish FVG: c1 low > c3 high
    if (c1.low > c3.high) {
      const top = c1.low
      const bottom = c3.high
      const filled = candles.slice(i + 1).some(
        (c) => c.high >= bottom && c.low <= top
      )
      gaps.push({
        direction: 'bearish',
        top,
        bottom,
        midpoint: (top + bottom) / 2,
        startIndex: i - 2,
        filled,
      })
    }
  }

  // So'nggi 10 ta FVG, to'ldirilmaganini afzallik
  return gaps
    .filter((g) => !g.filled)
    .slice(-10)
}

// ------------------------------------------------------------------
// Liquidity Sweep — stop-loss zone larni aniqlash
// ------------------------------------------------------------------
function detectLiquiditySweeps(candles: OHLCVCandle[]): LiquiditySweep[] {
  const sweeps: LiquiditySweep[] = []
  const lb = 5

  for (let i = lb + 1; i < candles.length; i++) {
    const window = candles.slice(i - lb - 1, i - 1)
    const prevHigh = Math.max(...window.map((c) => c.high))
    const prevLow = Math.min(...window.map((c) => c.low))
    const curr = candles[i]

    // Buy-side liquidity sweep: narx old highs dan o'tdi, keyin pastga qaytdi
    if (curr.high > prevHigh && curr.close < prevHigh) {
      sweeps.push({
        direction: 'buy_side',
        level: prevHigh,
        index: i,
        swept: true,
      })
    }

    // Sell-side liquidity sweep: narx old lows dan pastga tushdi, keyin qaytdi
    if (curr.low < prevLow && curr.close > prevLow) {
      sweeps.push({
        direction: 'sell_side',
        level: prevLow,
        index: i,
        swept: true,
      })
    }
  }

  return sweeps.slice(-8)
}

// ------------------------------------------------------------------
// Trend aniqlash: HH/HL yo'nalishi bo'yicha
// ------------------------------------------------------------------
function determineTrend(
  structure: MarketStructurePoint[]
): 'bullish' | 'bearish' | 'ranging' {
  if (structure.length < 4) return 'ranging'

  const recent = structure.slice(-6)
  const hhCount = recent.filter((p) => p.type === 'HH').length
  const hlCount = recent.filter((p) => p.type === 'HL').length
  const lhCount = recent.filter((p) => p.type === 'LH').length
  const llCount = recent.filter((p) => p.type === 'LL').length

  if (hhCount >= 2 && hlCount >= 2) return 'bullish'
  if (lhCount >= 2 && llCount >= 2) return 'bearish'
  return 'ranging'
}

// ------------------------------------------------------------------
// Asosiy funksiya
// ------------------------------------------------------------------
export function analyzeSMC(candles: OHLCVCandle[]): SMCResult {
  if (candles.length < 15) {
    return {
      marketStructure: [],
      trend: 'ranging',
      lastBOS: null,
      lastCHoCH: null,
      fvgZones: [],
      liquiditySweeps: [],
      signal: 'NEUTRAL',
      score: 50,
    }
  }

  const marketStructure = detectMarketStructure(candles)
  const { lastBOS, lastCHoCH } = detectBOSandCHoCH(marketStructure, candles)
  const fvgZones = detectFVG(candles)
  const liquiditySweeps = detectLiquiditySweeps(candles)
  const trend = determineTrend(marketStructure)

  // Signal hisoblash
  let signal: SignalDirection = 'NEUTRAL'
  let score = 50

  const currentPrice = candles[candles.length - 1].close

  if (trend === 'bullish') {
    score = 65
    signal = 'BUY'
  } else if (trend === 'bearish') {
    score = 35
    signal = 'SELL'
  }

  // BOS kuchaytirish
  if (lastBOS?.direction === 'bullish') { score += 15; signal = 'BUY' }
  if (lastBOS?.direction === 'bearish') { score -= 15; signal = 'SELL' }

  // CHoCH bonusi
  if (lastCHoCH?.direction === 'bullish') { score += 10; signal = 'BUY' }
  if (lastCHoCH?.direction === 'bearish') { score -= 10; signal = 'SELL' }

  // Narx Bullish FVG ustida → kuchli
  const bullishFVG = fvgZones.filter((g) => g.direction === 'bullish')
  if (bullishFVG.some((g) => currentPrice >= g.bottom && currentPrice <= g.top)) {
    score += 8
  }

  // Sell-side liquidity sweep yaqinda → BUY setup
  const recentSellSweep = liquiditySweeps.filter(
    (s) => s.direction === 'sell_side' && s.swept &&
    candles.length - s.index <= 5
  )
  if (recentSellSweep.length > 0) { score += 12; signal = 'BUY' }

  // Buy-side liquidity sweep → SELL setup
  const recentBuySweep = liquiditySweeps.filter(
    (s) => s.direction === 'buy_side' && s.swept &&
    candles.length - s.index <= 5
  )
  if (recentBuySweep.length > 0) { score -= 12; signal = 'SELL' }

  score = Math.max(0, Math.min(100, score))
  if (score > 65) signal = 'BUY'
  else if (score < 35) signal = 'SELL'
  else signal = 'NEUTRAL'

  return {
    marketStructure: marketStructure.slice(-12),
    trend,
    lastBOS,
    lastCHoCH,
    fvgZones: fvgZones.slice(-6),
    liquiditySweeps: liquiditySweeps.slice(-5),
    signal,
    score,
  }
}

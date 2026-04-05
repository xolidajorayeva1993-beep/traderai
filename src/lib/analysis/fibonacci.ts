// ============================================================
// Faza 3.6 — Fibonacci Analiz Engine
// Retracement, Extension, Auto Swing High/Low, Time Zones
// ============================================================
import type { OHLCVCandle, FibResult, FibLevel, SignalDirection } from './types'

// Fibonacci nisbatlari
const FIB_RETRACEMENT_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0]
const FIB_EXTENSION_RATIOS = [1.272, 1.414, 1.618, 2.0, 2.618]

// ------------------------------------------------------------------
// Swing High va Swing Low topish (eng kuchli)
// ------------------------------------------------------------------
function findMostSignificantSwing(candles: OHLCVCandle[]): {
  swingHigh: number; swingHighIndex: number
  swingLow: number; swingLowIndex: number
} {
  const lookback = Math.min(candles.length - 2, 60)
  const slice = candles.slice(-lookback)
  const offset = candles.length - lookback

  let maxHigh = -Infinity
  let maxHighIdx = 0
  let minLow = Infinity
  let minLowIdx = 0

  for (let i = 0; i < slice.length; i++) {
    if (slice[i].high > maxHigh) { maxHigh = slice[i].high; maxHighIdx = i + offset }
    if (slice[i].low < minLow) { minLow = slice[i].low; minLowIdx = i + offset }
  }

  return { swingHigh: maxHigh, swingHighIndex: maxHighIdx, swingLow: minLow, swingLowIndex: minLowIdx }
}

// ------------------------------------------------------------------
// Retracement darajalar hisoblash
// Trend yuqoriga: low → high, narx hodisa high dan tushib kelmoqda
// Trend pastga: high → low, narx hodisa low dan ko'tarilmoqda
// ------------------------------------------------------------------
function calcRetracementLevels(
  swingHigh: number,
  swingLow: number,
  currentPrice: number,
  trend: 'up' | 'down'
): FibLevel[] {
  const range = swingHigh - swingLow
  const levels: FibLevel[] = []

  for (const ratio of FIB_RETRACEMENT_RATIOS) {
    let price: number
    let label: string

    if (trend === 'up') {
      // Trend yuqoriga: retracement = high - ratio * range
      price = swingHigh - ratio * range
      label = ratio === 0 ? '0% (High)' : ratio === 1 ? '100% (Low)' : `${(ratio * 100).toFixed(1)}%`
    } else {
      // Trend pastga: retracement = low + ratio * range
      price = swingLow + ratio * range
      label = ratio === 0 ? '0% (Low)' : ratio === 1 ? '100% (High)' : `${(ratio * 100).toFixed(1)}%`
    }

    const tolerance = range * 0.005
    const isActive = Math.abs(currentPrice - price) < tolerance * 3

    levels.push({ ratio, price, type: 'retracement', label, isActive })
  }

  return levels
}

// ------------------------------------------------------------------
// Extension darajalar (TP uchun)
// ------------------------------------------------------------------
function calcExtensionLevels(
  swingHigh: number,
  swingLow: number,
  currentPrice: number,
  trend: 'up' | 'down'
): FibLevel[] {
  const range = swingHigh - swingLow
  const levels: FibLevel[] = []

  for (const ratio of FIB_EXTENSION_RATIOS) {
    let price: number
    if (trend === 'up') {
      price = swingLow + ratio * range
    } else {
      price = swingHigh - ratio * range
    }

    const tolerance = range * 0.005
    const isActive = Math.abs(currentPrice - price) < tolerance * 3

    levels.push({
      ratio,
      price,
      type: 'extension',
      label: `${(ratio * 100).toFixed(1)}%`,
      isActive,
    })
  }

  return levels
}

// ------------------------------------------------------------------
// Eng yaqin Fibonacci darajasini topish
// ------------------------------------------------------------------
function findNearestLevel(
  levels: FibLevel[],
  currentPrice: number
): FibLevel | null {
  if (levels.length === 0) return null
  return levels.reduce((nearest, level) => {
    return Math.abs(level.price - currentPrice) < Math.abs(nearest.price - currentPrice)
      ? level : nearest
  })
}

// ------------------------------------------------------------------
// Signal: narx qaysi darajaga yaqin va qaysi yo'nalishda
// ------------------------------------------------------------------
function computeFibSignal(
  retracementLevels: FibLevel[],
  currentPrice: number,
  swingHigh: number,
  swingLow: number,
  trend: 'up' | 'down'
): { signal: SignalDirection; score: number } {
  const range = swingHigh - swingLow
  if (range === 0) return { signal: 'NEUTRAL', score: 50 }

  // Kuchli Fibonacci darajalari: 0.382, 0.5, 0.618, 0.786
  const strongLevels = retracementLevels.filter(
    (l) => [0.382, 0.5, 0.618, 0.786].includes(l.ratio)
  )

  for (const level of strongLevels) {
    const tolerance = range * 0.008
    if (Math.abs(currentPrice - level.price) <= tolerance) {
      // Narx kuchli Fibonacci darajasida
      if (trend === 'up') {
        // Yuqoriga trenddagi retracement → BUY
        const strength = level.ratio === 0.618 ? 85
          : level.ratio === 0.5 ? 78
          : level.ratio === 0.382 ? 72
          : 68
        return { signal: 'BUY', score: strength }
      } else {
        const strength = level.ratio === 0.618 ? 85
          : level.ratio === 0.5 ? 78
          : level.ratio === 0.382 ? 72
          : 68
        return { signal: 'SELL', score: 100 - strength }
      }
    }
  }

  // Umumiy holat: trend asosida
  if (trend === 'up') return { signal: 'BUY', score: 60 }
  return { signal: 'SELL', score: 40 }
}

// ------------------------------------------------------------------
// Asosiy funksiya
// ------------------------------------------------------------------
export function analyzeFibonacci(candles: OHLCVCandle[]): FibResult {
  if (candles.length < 10) {
    return {
      swingHigh: 0, swingLow: 0,
      swingHighIndex: 0, swingLowIndex: 0,
      retracementLevels: [], extensionLevels: [],
      nearestLevel: null, signal: 'NEUTRAL', score: 50,
    }
  }

  const currentPrice = candles[candles.length - 1].close
  const { swingHigh, swingHighIndex, swingLow, swingLowIndex } = findMostSignificantSwing(candles)

  // Trend yo'nalishini aniqlash: swing high keyinroqmi yoki swing low?
  const trend: 'up' | 'down' = swingLowIndex > swingHighIndex ? 'down' : 'up'

  const retracementLevels = calcRetracementLevels(swingHigh, swingLow, currentPrice, trend)
  const extensionLevels = calcExtensionLevels(swingHigh, swingLow, currentPrice, trend)

  const allLevels = [...retracementLevels, ...extensionLevels]
  const nearestLevel = findNearestLevel(allLevels, currentPrice)

  const { signal, score } = computeFibSignal(retracementLevels, currentPrice, swingHigh, swingLow, trend)

  return {
    swingHigh,
    swingLow,
    swingHighIndex,
    swingLowIndex,
    retracementLevels,
    extensionLevels,
    nearestLevel,
    signal,
    score,
  }
}

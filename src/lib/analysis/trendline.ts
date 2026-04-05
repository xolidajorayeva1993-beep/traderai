// ============================================================
// Faza 3.4 — Trendline Analiz Engine
// Auto Trendline, Channel, Breakout Detection, Multi-TF
// ============================================================
import type { OHLCVCandle, TrendlineResult, Trendline, SignalDirection } from './types'
import { ADX } from 'technicalindicators'

// ------------------------------------------------------------------
// Zigzag — narx to'lqinlari uchun pivot nuqtalar
// Bu trendline chizish uchun asosiy kirish
// ------------------------------------------------------------------
function zigzag(candles: OHLCVCandle[], deviation = 0.005): { price: number; index: number; type: 'high' | 'low' }[] {
  const pivots: { price: number; index: number; type: 'high' | 'low' }[] = []
  let lastType: 'high' | 'low' | null = null
  let lastPrice = candles[0].close
  let lastIndex = 0

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]
    const changeUp = (c.high - lastPrice) / lastPrice
    const changeDown = (lastPrice - c.low) / lastPrice

    if (changeUp >= deviation && lastType !== 'high') {
      if (lastType === 'low') {
        pivots.push({ price: lastPrice, index: lastIndex, type: 'low' })
      }
      lastType = 'high'
      lastPrice = c.high
      lastIndex = i
    } else if (changeDown >= deviation && lastType !== 'low') {
      if (lastType === 'high') {
        pivots.push({ price: lastPrice, index: lastIndex, type: 'high' })
      }
      lastType = 'low'
      lastPrice = c.low
      lastIndex = i
    } else {
      // So'nggi pivotni yangilash
      if (lastType === 'high' && c.high > lastPrice) {
        lastPrice = c.high
        lastIndex = i
      } else if (lastType === 'low' && c.low < lastPrice) {
        lastPrice = c.low
        lastIndex = i
      }
    }
  }

  // Oxirgi pivot
  if (lastType) {
    pivots.push({ price: lastPrice, index: lastIndex, type: lastType })
  }

  return pivots
}

// ------------------------------------------------------------------
// Linear regression slope
// ------------------------------------------------------------------
function linearRegression(points: { x: number; y: number }[]): {
  slope: number; intercept: number; r2: number
} {
  const n = points.length
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0, r2: 0 }

  const sumX = points.reduce((s, p) => s + p.x, 0)
  const sumY = points.reduce((s, p) => s + p.y, 0)
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0)
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0)

  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 }

  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n

  // R² hisoblash
  const meanY = sumY / n
  const ssTot = points.reduce((s, p) => s + Math.pow(p.y - meanY, 2), 0)
  const ssRes = points.reduce((s, p) => s + Math.pow(p.y - (slope * p.x + intercept), 2), 0)
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0

  return { slope, intercept, r2 }
}

// ------------------------------------------------------------------
// Trendline qurish: pivotlar asosida chiziq
// ------------------------------------------------------------------
function buildTrendlines(
  pivots: { price: number; index: number; type: 'high' | 'low' }[],
  candles: OHLCVCandle[],
  direction: 'up' | 'down'
): Trendline[] {
  const type = direction === 'up' ? 'low' : 'high'
  const filtered = pivots.filter((p) => p.type === type).slice(-8)
  const result: Trendline[] = []

  if (filtered.length < 2) return result

  // Har juft pivot orqali chiziq
  for (let i = 0; i < filtered.length - 1; i++) {
    for (let j = i + 1; j < filtered.length; j++) {
      const p1 = filtered[i]
      const p2 = filtered[j]

      const points = [
        { x: p1.index, y: p1.price },
        { x: p2.index, y: p2.price },
      ]
      const { slope, intercept, r2 } = linearRegression(points)

      // Bu chiziq bilan bir xil tomondan o'tib ketgan nuqtalar bormi?
      let touchCount = 0
      let violated = false
      for (const p of filtered) {
        const linePrice = slope * p.index + intercept
        const diff = (p.price - linePrice) / linePrice

        if (direction === 'up') {
          if (diff < -0.003) { violated = true; break } // chiziq ostida
          if (Math.abs(diff) < 0.003) touchCount++
        } else {
          if (diff > 0.003) { violated = true; break }
          if (Math.abs(diff) < 0.003) touchCount++
        }
      }

      if (violated || touchCount < 2) continue

      const lastIdx = candles.length - 1
      const projectedPrice = slope * (lastIdx + 1) + intercept
      const currentLinePrice = slope * lastIdx + intercept
      const currentCandle = candles[lastIdx]

      // Breakout tekshiruvi
      const broken = direction === 'up'
        ? currentCandle.close < currentLinePrice * 0.998
        : currentCandle.close > currentLinePrice * 1.002

      // Strength: touch count + R2
      const strength = Math.min(100, Math.round(touchCount * 15 + r2 * 70))

      result.push({
        direction,
        startIndex: p1.index,
        endIndex: p2.index,
        startPrice: p1.price,
        endPrice: p2.price,
        slope,
        strength,
        touchCount,
        broken,
        projectedPrice,
      })
    }
  }

  return result.sort((a, b) => b.strength - a.strength).slice(0, 3)
}

// ------------------------------------------------------------------
// Trend kuchi: ADX asosida
// ------------------------------------------------------------------
function getTrendStrength(candles: OHLCVCandle[]): number {
  if (candles.length < 28) return 50
  try {
    const adxVals = ADX.calculate({
      period: 14,
      high: candles.map((c) => c.high),
      low: candles.map((c) => c.low),
      close: candles.map((c) => c.close),
    })
    const lastAdx = adxVals[adxVals.length - 1]
    if (!lastAdx) return 50
    return Math.min(100, Math.round(lastAdx.adx ?? 50))
  } catch {
    return 50
  }
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------
export function analyzeTrendlines(candles: OHLCVCandle[]): TrendlineResult {
  if (candles.length < 20) {
    return {
      trendlines: [],
      mainTrend: 'sideways',
      trendStrength: 0,
      signal: 'NEUTRAL',
      score: 50,
    }
  }

  const pivots = zigzag(candles, 0.004)
  const upTrendlines = buildTrendlines(pivots, candles, 'up')
  const downTrendlines = buildTrendlines(pivots, candles, 'down')
  const allTrendlines = [...upTrendlines, ...downTrendlines]

  // Main trend: EMA asosida
  const closes = candles.map((c) => c.close)
  const lastClose = closes[closes.length - 1]
  const ema50 = closes.slice(-50)
  const ema50Avg = ema50.reduce((s, v) => s + v, 0) / ema50.length
  const ema20 = closes.slice(-20)
  const ema20Avg = ema20.reduce((s, v) => s + v, 0) / ema20.length

  let mainTrend: 'up' | 'down' | 'sideways' = 'sideways'
  if (lastClose > ema50Avg * 1.002 && ema20Avg > ema50Avg) mainTrend = 'up'
  else if (lastClose < ema50Avg * 0.998 && ema20Avg < ema50Avg) mainTrend = 'down'

  const trendStrength = getTrendStrength(candles)

  // Signal
  let signal: SignalDirection = 'NEUTRAL'
  let score = 50

  const activeUpLines = upTrendlines.filter((t) => !t.broken)
  const activeDownLines = downTrendlines.filter((t) => !t.broken)

  if (mainTrend === 'up' && activeUpLines.length > 0) {
    signal = 'BUY'
    score = Math.round(50 + trendStrength * 0.4 + (activeUpLines[0]?.strength ?? 0) * 0.1)
  } else if (mainTrend === 'down' && activeDownLines.length > 0) {
    signal = 'SELL'
    score = Math.round(50 - trendStrength * 0.4 - (activeDownLines[0]?.strength ?? 0) * 0.1)
    score = Math.max(0, score)
  }

  score = Math.max(0, Math.min(100, score))

  return {
    trendlines: allTrendlines,
    mainTrend,
    trendStrength,
    signal,
    score,
  }
}

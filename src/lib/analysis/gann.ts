// ============================================================
// Faza 3.5 — Gann Analiz Engine
// Gann Fan (1x1, 1x2, 2x1...), Square of 9, Gann Angles
// ============================================================
import type { OHLCVCandle, GannResult, GannFanLine, SignalDirection } from './types'

// Gann Fan nisbatlari va ularning burchaklari (daraja)
const GANN_RATIOS: { ratio: string; angle: number; riseRun: number }[] = [
  { ratio: '4x1', angle: 75, riseRun: 4.0 },
  { ratio: '3x1', angle: 71.25, riseRun: 3.0 },
  { ratio: '2x1', angle: 63.75, riseRun: 2.0 },
  { ratio: '1x1', angle: 45, riseRun: 1.0 },  // asosiy Gann chizig'i
  { ratio: '1x2', angle: 26.25, riseRun: 0.5 },
  { ratio: '1x3', angle: 18.75, riseRun: 1 / 3 },
  { ratio: '1x4', angle: 15, riseRun: 0.25 },
]

// ------------------------------------------------------------------
// Gann Square of 9
// Spiral asosida narx darajalarini hisoblash
// Markaz = current price, har bir halqa = sqrt oddiy soni
// ------------------------------------------------------------------
export function gannSquareOf9(price: number, levels = 8): number[] {
  const result: number[] = []
  const root = Math.sqrt(price)

  for (let i = -levels; i <= levels; i++) {
    if (i === 0) continue
    const newRoot = root + i * 0.125 // 45° steplar
    const level = Math.pow(newRoot, 2)
    if (level > 0) result.push(parseFloat(level.toFixed(5)))
  }

  return result.sort((a, b) => a - b)
}

// ------------------------------------------------------------------
// Key Pivot topish: chart da eng muhim nuqta (swing high yoki low)
// Gann Fan shu pivot dan chiziladi
// ------------------------------------------------------------------
function findKeyPivot(candles: OHLCVCandle[]): {
  price: number; index: number; type: 'high' | 'low'
} {
  const lookback = Math.min(50, candles.length - 1)
  const slice = candles.slice(-lookback)

  let maxHigh = -Infinity
  let maxHighIdx = 0
  let minLow = Infinity
  let minLowIdx = 0

  for (let i = 0; i < slice.length; i++) {
    if (slice[i].high > maxHigh) { maxHigh = slice[i].high; maxHighIdx = i }
    if (slice[i].low < minLow) { minLow = slice[i].low; minLowIdx = i }
  }

  // Keyingi sham narxiga yaqin pivot
  const lastClose = candles[candles.length - 1].close
  const highDist = Math.abs(maxHigh - lastClose)
  const lowDist = Math.abs(minLow - lastClose)

  const globalIdx = candles.length - lookback
  if (lowDist < highDist) {
    return { price: minLow, index: globalIdx + minLowIdx, type: 'low' }
  }
  return { price: maxHigh, index: globalIdx + maxHighIdx, type: 'high' }
}

// ------------------------------------------------------------------
// Gann Fan Lines hisoblash
// ------------------------------------------------------------------
function calcGannFanLines(
  pivot: { price: number; index: number; type: 'high' | 'low' },
  currentCandleIndex: number,
  currentPrice: number
): GannFanLine[] {
  const lines: GannFanLine[] = []
  const priceRange = currentPrice * 0.01 // 1% — bir "Gann unit" narx qiymati
  const timeElapsed = currentCandleIndex - pivot.index

  if (timeElapsed <= 0) return lines

  for (const g of GANN_RATIOS) {
    // Gann fan: pivot dan (timeElapsed * g.riseRun) narx harakat
    let linePrice: number
    if (pivot.type === 'low') {
      // Pastdan yuqoriga: har bir vaqt birligida g.riseRun * priceRange ko'tariladi
      linePrice = pivot.price + timeElapsed * g.riseRun * priceRange
    } else {
      // Tepadan pastga: har bir vaqt birligida g.riseRun * priceRange tushadi
      linePrice = pivot.price - timeElapsed * g.riseRun * priceRange
    }

    const diff = linePrice - currentPrice
    const type: 'support' | 'resistance' =
      pivot.type === 'low'
        ? (linePrice < currentPrice ? 'support' : 'resistance')
        : (linePrice > currentPrice ? 'resistance' : 'support')

    lines.push({
      ratio: g.ratio,
      angle: g.angle,
      price: parseFloat(linePrice.toFixed(5)),
      type,
    })
  }

  return lines.sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice))
}

// ------------------------------------------------------------------
// Asosiy funksiya
// ------------------------------------------------------------------
export function analyzeGann(candles: OHLCVCandle[]): GannResult {
  if (candles.length < 20) {
    return {
      fanLines: [],
      squareOf9Levels: [],
      nearestSupport: null,
      nearestResistance: null,
      signal: 'NEUTRAL',
      score: 50,
    }
  }

  const currentPrice = candles[candles.length - 1].close
  const currentIdx = candles.length - 1

  const pivot = findKeyPivot(candles)
  const fanLines = calcGannFanLines(pivot, currentIdx, currentPrice)
  const squareOf9Levels = gannSquareOf9(currentPrice, 8)

  // Square of 9 dan eng yaqin darajalar
  const so9BelowPrice = squareOf9Levels.filter((l) => l < currentPrice)
  const so9AbovePrice = squareOf9Levels.filter((l) => l > currentPrice)

  // Fan lines dan yaqin support va resistance
  const supportLines = fanLines.filter((l) => l.type === 'support' && l.price < currentPrice)
  const resistanceLines = fanLines.filter((l) => l.type === 'resistance' && l.price > currentPrice)

  const nearestSupport = supportLines.length > 0
    ? Math.max(...supportLines.map((l) => l.price))
    : so9BelowPrice.length > 0 ? so9BelowPrice[so9BelowPrice.length - 1] : null

  const nearestResistance = resistanceLines.length > 0
    ? Math.min(...resistanceLines.map((l) => l.price))
    : so9AbovePrice.length > 0 ? so9AbovePrice[0] : null

  // Signal: narx 1x1 chiziq ustida va pastida
  const mainLine = fanLines.find((l) => l.ratio === '1x1')
  let signal: SignalDirection = 'NEUTRAL'
  let score = 50

  if (mainLine) {
    if (pivot.type === 'low') {
      // Yuqoriga fan: narx 1x1 ustida → BUY
      if (currentPrice > mainLine.price) {
        signal = 'BUY'
        score = Math.round(60 + (currentPrice - mainLine.price) / currentPrice * 500)
      } else {
        signal = 'SELL'
        score = Math.round(40 - (mainLine.price - currentPrice) / currentPrice * 300)
      }
    } else {
      // Pastga fan: narx 1x1 ostida → SELL
      if (currentPrice < mainLine.price) {
        signal = 'SELL'
        score = Math.round(40 - (mainLine.price - currentPrice) / currentPrice * 500)
      } else {
        signal = 'BUY'
        score = Math.round(60 + (currentPrice - mainLine.price) / currentPrice * 300)
      }
    }
  }

  score = Math.max(0, Math.min(100, score))

  return {
    fanLines: fanLines.slice(0, 7),
    squareOf9Levels: squareOf9Levels.slice(
      Math.max(0, squareOf9Levels.findIndex((l) => l >= currentPrice) - 4),
      squareOf9Levels.findIndex((l) => l >= currentPrice) + 4
    ),
    nearestSupport,
    nearestResistance,
    signal,
    score,
  }
}

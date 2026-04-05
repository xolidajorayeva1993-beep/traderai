// ============================================================
// Faza 3.3 — Klassik Chart Patterns & Candlestick Patterns
// Head & Shoulders, Double Top/Bottom, Triangle, Flag, Candlestick
// ============================================================
import type {
  OHLCVCandle, PatternResult, DetectedPattern, PatternType, SignalDirection
} from './types'

// Yordamchi: swing high/low topish (umumiy versiya)
function swingHighs(candles: OHLCVCandle[], lb = 3) {
  const res: { price: number; index: number }[] = []
  for (let i = lb; i < candles.length - lb; i++) {
    let ok = true
    for (let j = i - lb; j <= i + lb; j++) {
      if (j !== i && candles[j].high >= candles[i].high) { ok = false; break }
    }
    if (ok) res.push({ price: candles[i].high, index: i })
  }
  return res
}

function swingLows(candles: OHLCVCandle[], lb = 3) {
  const res: { price: number; index: number }[] = []
  for (let i = lb; i < candles.length - lb; i++) {
    let ok = true
    for (let j = i - lb; j <= i + lb; j++) {
      if (j !== i && candles[j].low <= candles[i].low) { ok = false; break }
    }
    if (ok) res.push({ price: candles[i].low, index: i })
  }
  return res
}

// ------------------------------------------------------------------
// Candlestick Patterns (so'nggi 3 sham)
// ------------------------------------------------------------------
function detectCandlestickPatterns(candles: OHLCVCandle[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = []
  const n = candles.length
  if (n < 3) return patterns

  const c0 = candles[n - 1] // hozirgi
  const c1 = candles[n - 2] // oldingi
  const c2 = candles[n - 3] // 2 oldin

  const body0 = Math.abs(c0.close - c0.open)
  const body1 = Math.abs(c1.close - c1.open)
  const range0 = c0.high - c0.low
  const range1 = c1.high - c1.low
  const upperWick0 = c0.high - Math.max(c0.open, c0.close)
  const lowerWick0 = Math.min(c0.open, c0.close) - c0.low

  // Doji: juda kichik bodya
  if (body0 < range0 * 0.1 && range0 > 0) {
    patterns.push({
      type: 'doji', direction: 'NEUTRAL', score: 55,
      startIndex: n - 1, endIndex: n - 1,
      targetPrice: null,
      description: 'Doji: bozor ikkilanmoqda, yo\'nalish noaniq',
    })
  }

  // Hammer (ta'minot zonasida)
  const isBull0 = c0.close > c0.open
  if (lowerWick0 > body0 * 2 && upperWick0 < body0 * 0.5 && body0 > 0) {
    patterns.push({
      type: 'hammer', direction: 'BUY', score: 70,
      startIndex: n - 1, endIndex: n - 1,
      targetPrice: c0.high + (c0.high - c0.low),
      description: 'Hammer: pastki soya uzun, yuqoriga burilish signali',
    })
  }

  // Shooting Star
  if (upperWick0 > body0 * 2 && lowerWick0 < body0 * 0.5 && body0 > 0) {
    patterns.push({
      type: 'shooting_star', direction: 'SELL', score: 70,
      startIndex: n - 1, endIndex: n - 1,
      targetPrice: c0.low - (c0.high - c0.low),
      description: 'Shooting Star: yuqori soya uzun, pastga burilish signali',
    })
  }

  // Bullish Pinbar
  if (lowerWick0 > range0 * 0.6 && body0 < range0 * 0.3) {
    patterns.push({
      type: 'pinbar_bull', direction: 'BUY', score: 72,
      startIndex: n - 1, endIndex: n - 1,
      targetPrice: c0.high + range0,
      description: 'Bullish Pinbar: rad etish signali, yuqoriga harakat kutilmoqda',
    })
  }

  // Bearish Pinbar
  if (upperWick0 > range0 * 0.6 && body0 < range0 * 0.3) {
    patterns.push({
      type: 'pinbar_bear', direction: 'SELL', score: 72,
      startIndex: n - 1, endIndex: n - 1,
      targetPrice: c0.low - range0,
      description: 'Bearish Pinbar: rad etish signali, pastga harakat kutilmoqda',
    })
  }

  // Bullish Engulfing
  if (c1.close < c1.open && c0.close > c0.open &&
      c0.open < c1.close && c0.close > c1.open) {
    patterns.push({
      type: 'bullish_engulfing', direction: 'BUY', score: 78,
      startIndex: n - 2, endIndex: n - 1,
      targetPrice: c0.close + (c1.open - c1.close),
      description: 'Bullish Engulfing: qizil shamni yutgan yashil sham, kuchli yuqoriga signal',
    })
  }

  // Bearish Engulfing
  if (c1.close > c1.open && c0.close < c0.open &&
      c0.open > c1.close && c0.close < c1.open) {
    patterns.push({
      type: 'bearish_engulfing', direction: 'SELL', score: 78,
      startIndex: n - 2, endIndex: n - 1,
      targetPrice: c0.close - (c1.close - c1.open),
      description: 'Bearish Engulfing: yashil shamni yutgan qizil sham, kuchli pastga signal',
    })
  }

  // Morning Star
  if (c2.close < c2.open && // 1: qizil
      Math.abs(c1.close - c1.open) < Math.abs(c2.close - c2.open) * 0.3 && // 2: kichik
      c0.close > c0.open && c0.close > (c2.close + c2.open) / 2) { // 3: yashil
    patterns.push({
      type: 'morning_star', direction: 'BUY', score: 82,
      startIndex: n - 3, endIndex: n - 1,
      targetPrice: c0.close + Math.abs(c2.close - c2.open),
      description: 'Morning Star: 3 shamli burilish formatsiyasi, kuchli BUY signali',
    })
  }

  // Evening Star
  if (c2.close > c2.open && // 1: yashil
      Math.abs(c1.close - c1.open) < Math.abs(c2.close - c2.open) * 0.3 && // 2: kichik
      c0.close < c0.open && c0.close < (c2.close + c2.open) / 2) { // 3: qizil
    patterns.push({
      type: 'evening_star', direction: 'SELL', score: 82,
      startIndex: n - 3, endIndex: n - 1,
      targetPrice: c0.close - Math.abs(c2.close - c2.open),
      description: 'Evening Star: 3 shamli burilish formatsiyasi, kuchli SELL signali',
    })
  }

  // Bullish Harami
  if (c1.close < c1.open && c0.close > c0.open &&
      c0.open > c1.close && c0.close < c1.open &&
      body0 < body1 * 0.5) {
    patterns.push({
      type: 'bullish_harami', direction: 'BUY', score: 62,
      startIndex: n - 2, endIndex: n - 1,
      targetPrice: null,
      description: 'Bullish Harami: ichki sham, ehtimoliy yuqoriga burilish',
    })
  }

  // Bearish Harami
  if (c1.close > c1.open && c0.close < c0.open &&
      c0.open < c1.close && c0.close > c1.open &&
      body0 < body1 * 0.5) {
    patterns.push({
      type: 'bearish_harami', direction: 'SELL', score: 62,
      startIndex: n - 2, endIndex: n - 1,
      targetPrice: null,
      description: 'Bearish Harami: ichki sham, ehtimoliy pastga burilish',
    })
  }

  // Three White Soldiers
  const c3 = candles[n - 4]
  if (n >= 4 && c3 && c2.close > c2.open && c1.close > c1.open && c0.close > c0.open &&
      c2.close > c3.close && c1.close > c2.close && c0.close > c1.close) {
    patterns.push({
      type: 'three_white_soldiers', direction: 'BUY', score: 85,
      startIndex: n - 3, endIndex: n - 1,
      targetPrice: c0.close + (c0.close - c2.open),
      description: '3 Oq Askar: kuchli bullish momentum, trend davom etish signali',
    })
  }

  // Three Black Crows
  if (n >= 4 && c3 && c2.close < c2.open && c1.close < c1.open && c0.close < c0.open &&
      c2.close < c3.close && c1.close < c2.close && c0.close < c1.close) {
    patterns.push({
      type: 'three_black_crows', direction: 'SELL', score: 85,
      startIndex: n - 3, endIndex: n - 1,
      targetPrice: c0.close - (c2.open - c0.close),
      description: '3 Qora Qarg\'a: kuchli bearish momentum, trend davom etish signali',
    })
  }

  return patterns
}

// ------------------------------------------------------------------
// Chart Patterns (swing high/low asosida)
// ------------------------------------------------------------------
function detectChartPatterns(candles: OHLCVCandle[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = []
  if (candles.length < 30) return patterns

  const highs = swingHighs(candles, 5).slice(-10)
  const lows = swingLows(candles, 5).slice(-10)
  const lastPrice = candles[candles.length - 1].close

  // Double Top
  if (highs.length >= 2) {
    const [h1, h2] = highs.slice(-2)
    const priceDiff = Math.abs(h1.price - h2.price) / h1.price
    if (priceDiff < 0.015 && h2.index - h1.index >= 5) {
      // Neckline: ikki high o'rtasidagi swing low
      const neckLows = lows.filter((l) => l.index > h1.index && l.index < h2.index)
      const neckline = neckLows.length > 0 ? neckLows[neckLows.length - 1].price : null
      if (neckline && lastPrice < neckline) {
        const target = neckline - (h1.price - neckline)
        patterns.push({
          type: 'double_top', direction: 'SELL', score: 80,
          startIndex: h1.index, endIndex: h2.index,
          targetPrice: target,
          description: `Double Top: ${h1.price.toFixed(5)} va ${h2.price.toFixed(5)} da tepalik, neckline: ${neckline.toFixed(5)}`,
        })
      }
    }
  }

  // Double Bottom
  if (lows.length >= 2) {
    const [l1, l2] = lows.slice(-2)
    const priceDiff = Math.abs(l1.price - l2.price) / l1.price
    if (priceDiff < 0.015 && l2.index - l1.index >= 5) {
      const neckHighs = highs.filter((h) => h.index > l1.index && h.index < l2.index)
      const neckline = neckHighs.length > 0 ? neckHighs[neckHighs.length - 1].price : null
      if (neckline && lastPrice > neckline) {
        const target = neckline + (neckline - l1.price)
        patterns.push({
          type: 'double_bottom', direction: 'BUY', score: 80,
          startIndex: l1.index, endIndex: l2.index,
          targetPrice: target,
          description: `Double Bottom: ${l1.price.toFixed(5)} va ${l2.price.toFixed(5)} da tubi, neckline: ${neckline.toFixed(5)}`,
        })
      }
    }
  }

  // Head & Shoulders (3 tepalik)
  if (highs.length >= 3) {
    const [left, head, right] = highs.slice(-3)
    if (
      head.price > left.price &&
      head.price > right.price &&
      Math.abs(left.price - right.price) / head.price < 0.02
    ) {
      const neckLows = lows.filter(
        (l) => l.index > left.index && l.index < right.index
      )
      if (neckLows.length >= 2) {
        const neckline = (neckLows[0].price + neckLows[neckLows.length - 1].price) / 2
        if (lastPrice < neckline) {
          patterns.push({
            type: 'head_and_shoulders', direction: 'SELL', score: 85,
            startIndex: left.index, endIndex: right.index,
            targetPrice: neckline - (head.price - neckline),
            description: `Head & Shoulders: bosh=${head.price.toFixed(5)}, neckline=${neckline.toFixed(5)}`,
          })
        }
      }
    }
  }

  // Inverse Head & Shoulders
  if (lows.length >= 3) {
    const [left, head, right] = lows.slice(-3)
    if (
      head.price < left.price &&
      head.price < right.price &&
      Math.abs(left.price - right.price) / head.price < 0.02
    ) {
      const neckHighs = highs.filter(
        (h) => h.index > left.index && h.index < right.index
      )
      if (neckHighs.length >= 2) {
        const neckline = (neckHighs[0].price + neckHighs[neckHighs.length - 1].price) / 2
        if (lastPrice > neckline) {
          patterns.push({
            type: 'inverse_head_and_shoulders', direction: 'BUY', score: 85,
            startIndex: left.index, endIndex: right.index,
            targetPrice: neckline + (neckline - head.price),
            description: `Inverse H&S: bosh=${head.price.toFixed(5)}, neckline=${neckline.toFixed(5)}`,
          })
        }
      }
    }
  }

  // Ascending Triangle: yuqori daraj bir hil, pastki daraj o'smoqda
  if (highs.length >= 3 && lows.length >= 3) {
    const recentHighs = highs.slice(-3)
    const recentLows = lows.slice(-3)
    const highSpread = Math.max(...recentHighs.map((h) => h.price)) - Math.min(...recentHighs.map((h) => h.price))
    const highAvg = recentHighs.reduce((s, h) => s + h.price, 0) / recentHighs.length
    const lowsRising = recentLows[recentLows.length - 1].price > recentLows[0].price

    if (highSpread / highAvg < 0.005 && lowsRising) {
      patterns.push({
        type: 'ascending_triangle', direction: 'BUY', score: 72,
        startIndex: recentLows[0].index, endIndex: candles.length - 1,
        targetPrice: highAvg + (highAvg - recentLows[0].price),
        description: `Ascending Triangle: tepalik direngasi ${highAvg.toFixed(5)}, pastki tomon ko'tarilmoqda`,
      })
    }

    // Descending Triangle
    const lowSpread = Math.max(...recentLows.map((l) => l.price)) - Math.min(...recentLows.map((l) => l.price))
    const lowAvg = recentLows.reduce((s, l) => s + l.price, 0) / recentLows.length
    const highsFalling = recentHighs[recentHighs.length - 1].price < recentHighs[0].price

    if (lowSpread / lowAvg < 0.005 && highsFalling) {
      patterns.push({
        type: 'descending_triangle', direction: 'SELL', score: 72,
        startIndex: recentHighs[0].index, endIndex: candles.length - 1,
        targetPrice: lowAvg - (recentHighs[0].price - lowAvg),
        description: `Descending Triangle: tub direngasi ${lowAvg.toFixed(5)}, yuqori tomon tushmoqda`,
      })
    }
  }

  return patterns
}

// ------------------------------------------------------------------
// Asosiy funksiya
// ------------------------------------------------------------------
export function detectPatterns(candles: OHLCVCandle[]): PatternResult {
  const candlestickPats = detectCandlestickPatterns(candles)
  const chartPats = detectChartPatterns(candles)
  const allPatterns = [...candlestickPats, ...chartPats]

  // Kuchliroq patternlarni oldinga qo'yish
  allPatterns.sort((a, b) => b.score - a.score)

  // Dominant direction
  let bullScore = 0, bearScore = 0
  for (const p of allPatterns) {
    if (p.direction === 'BUY') bullScore += p.score
    else if (p.direction === 'SELL') bearScore += p.score
  }
  const total = bullScore + bearScore || 1
  const bullRatio = bullScore / total
  const score = Math.round(bullRatio * 100)

  let dominantDirection: SignalDirection = 'NEUTRAL'
  if (bullRatio >= 0.6) dominantDirection = 'BUY'
  else if (bullRatio <= 0.4) dominantDirection = 'SELL'

  return {
    patterns: allPatterns.slice(0, 8),
    dominantDirection,
    score,
  }
}

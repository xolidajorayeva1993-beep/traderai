// ============================================================
// Faza 3.1 — Texnik Indikatorlar Engine
// SMA, EMA, MACD, Bollinger, RSI, Stochastic, ATR, ADX, OBV, VWAP
// ============================================================
import {
  SMA, EMA, MACD, BollingerBands, RSI,
  Stochastic, ATR, ADX, OBV,
} from 'technicalindicators'
import type { OHLCVCandle, IndicatorResult, SignalDirection } from './types'

// Helper: massivdan faqat so'nggi N ta qiymatni olish
function last(arr: (number | null | undefined)[], n = 1): number | null {
  for (let i = arr.length - n; i < arr.length; i++) {
    const v = arr[i]
    if (v !== null && v !== undefined && !isNaN(v as number)) return v as number
  }
  return null
}

function lastN(arr: (number | null | undefined)[], count: number): (number | null)[] {
  return arr.slice(-count).map((v) =>
    v !== null && v !== undefined && !isNaN(v as number) ? (v as number) : null
  )
}

export function calculateIndicators(candles: OHLCVCandle[]): IndicatorResult {
  if (candles.length < 50) {
    return emptyIndicatorResult()
  }

  const closes = candles.map((c) => c.close)
  const highs = candles.map((c) => c.high)
  const lows = candles.map((c) => c.low)
  const volumes = candles.map((c) => c.volume)

  // SMA 20, 50, 200
  const smaResult = [20, 50, 200].map((period) => {
    if (closes.length < period) return { period, value: null }
    const vals = SMA.calculate({ period, values: closes })
    return { period, value: last(vals) }
  })

  // EMA 9, 21, 50, 200
  const emaResult = [9, 21, 50, 200].map((period) => {
    if (closes.length < period) return { period, value: null }
    const vals = EMA.calculate({ period, values: closes })
    return { period, value: last(vals) }
  })

  // RSI 14
  let rsiValue: number | null = null
  if (closes.length >= 15) {
    const rsiVals = RSI.calculate({ period: 14, values: closes })
    rsiValue = last(rsiVals)
  }

  // MACD (12, 26, 9)
  let macdVal = { macd: null as number | null, signal: null as number | null, histogram: null as number | null }
  if (closes.length >= 35) {
    const macdVals = MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    })
    const lastMacd = macdVals[macdVals.length - 1]
    if (lastMacd) {
      macdVal = {
        macd: lastMacd.MACD ?? null,
        signal: lastMacd.signal ?? null,
        histogram: lastMacd.histogram ?? null,
      }
    }
  }

  // Bollinger Bands (20, 2)
  let bbResult = { upper: null as number | null, middle: null as number | null, lower: null as number | null, bandwidth: null as number | null }
  if (closes.length >= 20) {
    const bbVals = BollingerBands.calculate({ period: 20, values: closes, stdDev: 2 })
    const lastBB = bbVals[bbVals.length - 1]
    if (lastBB) {
      const bw = lastBB.upper && lastBB.lower && lastBB.middle
        ? ((lastBB.upper - lastBB.lower) / lastBB.middle) * 100
        : null
      bbResult = { upper: lastBB.upper, middle: lastBB.middle, lower: lastBB.lower, bandwidth: bw }
    }
  }

  // Stochastic (14, 3, 3)
  let stochResult = { k: null as number | null, d: null as number | null }
  if (candles.length >= 17) {
    const stochVals = Stochastic.calculate({
      high: highs, low: lows, close: closes,
      period: 14, signalPeriod: 3,
    })
    const lastStoch = stochVals[stochVals.length - 1]
    if (lastStoch) {
      stochResult = { k: lastStoch.k, d: lastStoch.d }
    }
  }

  // ATR 14
  let atrValue: number | null = null
  if (candles.length >= 15) {
    const atrVals = ATR.calculate({ period: 14, high: highs, low: lows, close: closes })
    atrValue = last(atrVals)
  }

  // ADX 14
  let adxResult = { adx: null as number | null, pdi: null as number | null, mdi: null as number | null }
  if (candles.length >= 28) {
    const adxVals = ADX.calculate({ period: 14, high: highs, low: lows, close: closes })
    const lastAdx = adxVals[adxVals.length - 1]
    if (lastAdx) {
      adxResult = { adx: lastAdx.adx, pdi: lastAdx.pdi, mdi: lastAdx.mdi }
    }
  }

  // OBV
  let obvValue: number | null = null
  if (closes.length >= 2) {
    const obvVals = OBV.calculate({ close: closes, volume: volumes })
    obvValue = last(obvVals)
  }

  // VWAP (hozirgi kun uchun oddiy hisob)
  let vwapValue: number | null = null
  const typicalPrices = candles.map((c) => (c.high + c.low + c.close) / 3)
  const tpvSum = typicalPrices.reduce((sum, tp, i) => sum + tp * candles[i].volume, 0)
  const volSum = candles.reduce((sum, c) => sum + c.volume, 0)
  if (volSum > 0) vwapValue = tpvSum / volSum

  // SIGNAL HISOBLASH
  const { signal, score } = computeIndicatorSignal({
    rsi: rsiValue,
    macd: macdVal,
    stoch: stochResult,
    ema9: emaResult.find((e) => e.period === 9)?.value ?? null,
    ema21: emaResult.find((e) => e.period === 21)?.value ?? null,
    ema50: emaResult.find((e) => e.period === 50)?.value ?? null,
    currentPrice: closes[closes.length - 1],
    adx: adxResult,
    bb: bbResult,
  })

  return {
    sma: smaResult,
    ema: emaResult,
    rsi: { period: 14, value: rsiValue },
    macd: macdVal,
    bollingerBands: bbResult,
    stochastic: stochResult,
    atr: { period: 14, value: atrValue },
    adx: adxResult,
    obv: obvValue,
    vwap: vwapValue,
    signal,
    score,
  }
}

// ------------------------------------------------------------------
// Signal hisoblash: har bir indikator uchun ball, keyin weighted avg
// ------------------------------------------------------------------
interface SignalInputs {
  rsi: number | null
  macd: { macd: number | null; signal: number | null; histogram: number | null }
  stoch: { k: number | null; d: number | null }
  ema9: number | null
  ema21: number | null
  ema50: number | null
  currentPrice: number
  adx: { adx: number | null; pdi: number | null; mdi: number | null }
  bb: { upper: number | null; middle: number | null; lower: number | null }
}

function computeIndicatorSignal(inp: SignalInputs): { signal: SignalDirection; score: number } {
  let bullPoints = 0
  let bearPoints = 0
  let total = 0

  // RSI
  if (inp.rsi !== null) {
    total += 20
    if (inp.rsi < 30) bullPoints += 20        // oversold → buy
    else if (inp.rsi > 70) bearPoints += 20   // overbought → sell
    else if (inp.rsi < 50) bearPoints += 8
    else bullPoints += 8
  }

  // MACD
  if (inp.macd.macd !== null && inp.macd.signal !== null) {
    total += 20
    if (inp.macd.macd > inp.macd.signal) bullPoints += 20
    else bearPoints += 20
    if (inp.macd.histogram !== null && inp.macd.histogram > 0) bullPoints += 5
    else if (inp.macd.histogram !== null) bearPoints += 5
  }

  // Stochastic
  if (inp.stoch.k !== null && inp.stoch.d !== null) {
    total += 15
    if (inp.stoch.k < 20 && inp.stoch.d < 20) bullPoints += 15
    else if (inp.stoch.k > 80 && inp.stoch.d > 80) bearPoints += 15
    else if (inp.stoch.k > inp.stoch.d) bullPoints += 8
    else bearPoints += 8
  }

  // EMA crossover: price vs EMA
  if (inp.ema21 !== null) {
    total += 15
    if (inp.currentPrice > inp.ema21) bullPoints += 15
    else bearPoints += 15
  }

  // EMA trend (EMA9 vs EMA50)
  if (inp.ema9 !== null && inp.ema50 !== null) {
    total += 15
    if (inp.ema9 > inp.ema50) bullPoints += 15
    else bearPoints += 15
  }

  // Bollinger Bands
  if (inp.bb.upper !== null && inp.bb.lower !== null) {
    total += 15
    if (inp.currentPrice <= inp.bb.lower!) bullPoints += 15
    else if (inp.currentPrice >= inp.bb.upper!) bearPoints += 15
    else if (inp.currentPrice < inp.bb.middle!) bullPoints += 7
    else bearPoints += 7
  }

  if (total === 0) return { signal: 'NEUTRAL', score: 50 }

  const ratio = bullPoints / (bullPoints + bearPoints || 1)
  const score = Math.round(ratio * 100)

  let signal: SignalDirection = 'NEUTRAL'
  if (ratio >= 0.65) signal = 'BUY'
  else if (ratio <= 0.35) signal = 'SELL'

  return { signal, score }
}

function emptyIndicatorResult(): IndicatorResult {
  return {
    sma: [20, 50, 200].map((p) => ({ period: p, value: null })),
    ema: [9, 21, 50, 200].map((p) => ({ period: p, value: null })),
    rsi: { period: 14, value: null },
    macd: { macd: null, signal: null, histogram: null },
    bollingerBands: { upper: null, middle: null, lower: null, bandwidth: null },
    stochastic: { k: null, d: null },
    atr: { period: 14, value: null },
    adx: { adx: null, pdi: null, mdi: null },
    obv: null,
    vwap: null,
    signal: 'NEUTRAL',
    score: 50,
  }
}

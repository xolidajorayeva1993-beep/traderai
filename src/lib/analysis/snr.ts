// ============================================================
// Faza 3.2 — SNR (Support & Resistance) Detection Engine
// Horizontal SNR, Dynamic SNR, Pivot Points, Order Blocks
// ============================================================
import type { OHLCVCandle, SNRResult, SNRZone, SignalDirection } from './types'

const ZONE_TOLERANCE = 0.002 // 0.2% narx farqi — bir zona deb hisoblash

// ------------------------------------------------------------------
// Swing High/Low topish
// ------------------------------------------------------------------
function findSwingHighs(candles: OHLCVCandle[], lookback = 5): { price: number; index: number }[] {
  const swings: { price: number; index: number }[] = []
  for (let i = lookback; i < candles.length - lookback; i++) {
    const high = candles[i].high
    let isSwing = true
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && candles[j].high >= high) { isSwing = false; break }
    }
    if (isSwing) swings.push({ price: high, index: i })
  }
  return swings
}

function findSwingLows(candles: OHLCVCandle[], lookback = 5): { price: number; index: number }[] {
  const swings: { price: number; index: number }[] = []
  for (let i = lookback; i < candles.length - lookback; i++) {
    const low = candles[i].low
    let isSwing = true
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && candles[j].low <= low) { isSwing = false; break }
    }
    if (isSwing) swings.push({ price: low, index: i })
  }
  return swings
}

// ------------------------------------------------------------------
// Narx darajalarini klasterlashtirib zona qilish
// ------------------------------------------------------------------
function clusterLevels(
  levels: { price: number; index: number }[],
  currentPrice: number,
  type: 'support' | 'resistance',
  candles: OHLCVCandle[]
): SNRZone[] {
  const zones: SNRZone[] = []
  const used = new Set<number>()

  for (let i = 0; i < levels.length; i++) {
    if (used.has(i)) continue
    const cluster: typeof levels = [levels[i]]
    used.add(i)

    for (let j = i + 1; j < levels.length; j++) {
      if (used.has(j)) continue
      const diff = Math.abs(levels[i].price - levels[j].price) / levels[i].price
      if (diff <= ZONE_TOLERANCE * 3) {
        cluster.push(levels[j])
        used.add(j)
      }
    }

    const avgPrice = cluster.reduce((s, c) => s + c.price, 0) / cluster.length
    const spread = avgPrice * ZONE_TOLERANCE
    const touchCount = cluster.length

    // Volume score — zonani test qilgan shamlar volume o'rtachasi
    const volScores = cluster.map((c) => candles[c.index]?.volume ?? 0)
    const avgVol = volScores.reduce((s, v) => s + v, 0) / (volScores.length || 1)
    const maxVol = Math.max(...candles.map((c) => c.volume), 1)
    const volumeScore = Math.min(100, Math.round((avgVol / maxVol) * 100))

    // Strength: touchCount * volume ta'sir
    const strength = Math.min(100, Math.round(
      touchCount * 20 + volumeScore * 0.5
    ))

    zones.push({
      type,
      priceTop: avgPrice + spread,
      priceBottom: avgPrice - spread,
      strength,
      touchCount,
      volumeScore,
    })
  }

  // Kuchli va hozirgi narxga yaqin zonalarni qaytarish
  return zones
    .filter((z) => {
      // Support → current price dan yuqori bo'lmasin
      if (type === 'support') return z.priceTop < currentPrice * 1.005
      // Resistance → current price dan past bo'lmasin
      return z.priceBottom > currentPrice * 0.995
    })
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 8)
}

// ------------------------------------------------------------------
// Pivot Points (Classic)
// ------------------------------------------------------------------
function calcPivotPoints(candles: OHLCVCandle[]): { price: number; type: 'support' | 'resistance' }[] {
  if (candles.length < 2) return []
  const prev = candles[candles.length - 2]
  const pp = (prev.high + prev.low + prev.close) / 3
  return [
    { price: pp * 2 - prev.low, type: 'resistance' },   // R1
    { price: pp + (prev.high - prev.low), type: 'resistance' }, // R2
    { price: pp, type: (pp > candles[candles.length - 1].close ? 'resistance' : 'support') },
    { price: pp * 2 - prev.high, type: 'support' },    // S1
    { price: pp - (prev.high - prev.low), type: 'support' }, // S2
  ]
}

// ------------------------------------------------------------------
// Round Number Levels (psixologik darajalar)
// ------------------------------------------------------------------
function getRoundLevels(currentPrice: number): { price: number; type: 'support' | 'resistance' }[] {
  const levels: { price: number; type: 'support' | 'resistance' }[] = []
  // Narxga qarab round step aniqlash
  const magnitude = Math.pow(10, Math.floor(Math.log10(currentPrice)) - 1)
  const step = magnitude * 5

  const base = Math.floor(currentPrice / step) * step
  for (let i = -3; i <= 3; i++) {
    const price = base + i * step
    if (price > 0 && Math.abs(price - currentPrice) / currentPrice < 0.05) {
      levels.push({
        price,
        type: price < currentPrice ? 'support' : 'resistance',
      })
    }
  }
  return levels
}

// ------------------------------------------------------------------
// Asosiy SNR funksiya
// ------------------------------------------------------------------
export function calculateSNR(candles: OHLCVCandle[]): SNRResult {
  if (candles.length < 20) {
    return { zones: [], nearestSupport: null, nearestResistance: null, signal: 'NEUTRAL', score: 50 }
  }

  const currentPrice = candles[candles.length - 1].close
  const lookback = Math.min(5, Math.floor(candles.length / 10))

  const swingHighs = findSwingHighs(candles, lookback)
  const swingLows = findSwingLows(candles, lookback)

  const resistanceZones = clusterLevels(swingHighs, currentPrice, 'resistance', candles)
  const supportZones = clusterLevels(swingLows, currentPrice, 'support', candles)

  // Pivot Points qo'shish
  const pivots = calcPivotPoints(candles)
  for (const pivot of pivots) {
    const spread = currentPrice * ZONE_TOLERANCE
    if (
      pivot.type === 'support' &&
      pivot.price < currentPrice &&
      !supportZones.some((z) => Math.abs(z.priceBottom - pivot.price) < spread * 2)
    ) {
      supportZones.push({
        type: 'support',
        priceTop: pivot.price + spread,
        priceBottom: pivot.price - spread,
        strength: 45,
        touchCount: 1,
        volumeScore: 0,
        pivotType: 'classic',
      })
    } else if (
      pivot.type === 'resistance' &&
      pivot.price > currentPrice &&
      !resistanceZones.some((z) => Math.abs(z.priceTop - pivot.price) < spread * 2)
    ) {
      resistanceZones.push({
        type: 'resistance',
        priceTop: pivot.price + spread,
        priceBottom: pivot.price - spread,
        strength: 45,
        touchCount: 1,
        volumeScore: 0,
        pivotType: 'classic',
      })
    }
  }

  // Round number levels
  const roundLevels = getRoundLevels(currentPrice)
  for (const rl of roundLevels) {
    const spread = currentPrice * ZONE_TOLERANCE
    const arr = rl.type === 'support' ? supportZones : resistanceZones
    if (!arr.some((z) => Math.abs((z.priceTop + z.priceBottom) / 2 - rl.price) < spread * 2)) {
      arr.push({
        type: rl.type,
        priceTop: rl.price + spread,
        priceBottom: rl.price - spread,
        strength: 30,
        touchCount: 1,
        volumeScore: 0,
      })
    }
  }

  const allZones = [...supportZones, ...resistanceZones].sort((a, b) => b.strength - a.strength)

  // Eng yaqin support va resistance
  const nearestSupport = supportZones
    .sort((a, b) => b.priceTop - a.priceTop)[0] ?? null

  const nearestResistance = resistanceZones
    .sort((a, b) => a.priceBottom - b.priceBottom)[0] ?? null

  // Signal: narx support ga yaqin → BUY, resistance ga yaqin → SELL
  let signal: SignalDirection = 'NEUTRAL'
  let score = 50

  if (nearestSupport && nearestResistance) {
    const distToSupport = currentPrice - nearestSupport.priceTop
    const distToResistance = nearestResistance.priceBottom - currentPrice
    const total = distToSupport + distToResistance

    if (total > 0) {
      const supportRatio = 1 - distToSupport / total // narx support ga yaqin = katta
      score = Math.round(supportRatio * 100)

      if (supportRatio > 0.65) signal = 'BUY'
      else if (supportRatio < 0.35) signal = 'SELL'
    }
  }

  return {
    zones: allZones.slice(0, 10),
    nearestSupport,
    nearestResistance,
    signal,
    score,
  }
}

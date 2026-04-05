// ============================================================
// Faza 3.8 — Multi-Strategiya Confluence Scoring Engine
// Barcha strategiya natijalarini birlashtirish
// ============================================================
import type {
  OHLCVCandle, FullAnalysisResult, ConfluenceResult,
  SignalDirection, SignalStrength, StrategyWeight, DEFAULT_WEIGHTS
} from './types'
import { DEFAULT_WEIGHTS as DW } from './types'
import { calculateIndicators } from './indicators'
import { calculateSNR } from './snr'
import { detectPatterns } from './patterns'
import { analyzeTrendlines } from './trendline'
import { analyzeGann } from './gann'
import { analyzeFibonacci } from './fibonacci'
import { analyzeSMC } from './smc'

// ------------------------------------------------------------------
// Score → SignalStrength konvertatsiya
// ------------------------------------------------------------------
function scoreToStrength(score: number, direction: SignalDirection): SignalStrength {
  if (direction === 'NEUTRAL') return 'NEUTRAL'
  if (direction === 'BUY') {
    if (score >= 80) return 'STRONG_BUY'
    return 'BUY'
  } else {
    if (score <= 20) return 'STRONG_SELL'
    return 'SELL'
  }
}

// ------------------------------------------------------------------
// Confluence hisoblash
// ------------------------------------------------------------------
function computeConfluence(
  components: {
    indicators: number
    snr: number
    patterns: number
    trendline: number
    gann: number
    fibonacci: number
    smc: number
  },
  weights: typeof DW
): ConfluenceResult {
  // Weighted average
  const weighted =
    components.indicators * weights.indicators +
    components.snr * weights.snr +
    components.patterns * weights.patterns +
    components.trendline * weights.trendline +
    components.gann * weights.gann +
    components.fibonacci * weights.fibonacci +
    components.smc * weights.smc

  // Strategiyalar bir xil yo'nalishda ekanligini tekshirish
  const scores = Object.values(components)
  const bullCount = scores.filter((s) => s >= 60).length
  const bearCount = scores.filter((s) => s <= 40).length
  const totalStrategies = scores.length

  // Conflict: ham bull ham bear strategiyalar bor
  const conflictFlag = bullCount >= 2 && bearCount >= 2

  // Alignment bonus: ≥5 strategiya bir yo'nalishda
  let alignmentBonus = 0
  if (bullCount >= 5) alignmentBonus = 15
  else if (bearCount >= 5) alignmentBonus = -15

  let finalScore = weighted + (alignmentBonus > 0 ? alignmentBonus : 0)
  if (alignmentBonus < 0) finalScore = Math.max(0, finalScore + alignmentBonus)
  finalScore = Math.max(0, Math.min(100, finalScore))

  // Yo'nalish
  let direction: SignalDirection = 'NEUTRAL'
  if (finalScore >= 62) direction = 'BUY'
  else if (finalScore <= 38) direction = 'SELL'

  const strength = scoreToStrength(finalScore, direction)

  // Summary matni
  const alignedStrategies: string[] = []
  if (components.indicators >= 60) alignedStrategies.push('Indikatorlar (BUY)')
  else if (components.indicators <= 40) alignedStrategies.push('Indikatorlar (SELL)')
  if (components.snr >= 60) alignedStrategies.push('SNR (BUY)')
  else if (components.snr <= 40) alignedStrategies.push('SNR (SELL)')
  if (components.patterns >= 60) alignedStrategies.push('Pattern (BUY)')
  else if (components.patterns <= 40) alignedStrategies.push('Pattern (SELL)')
  if (components.trendline >= 60) alignedStrategies.push('Trendline (BUY)')
  else if (components.trendline <= 40) alignedStrategies.push('Trendline (SELL)')
  if (components.fibonacci >= 60) alignedStrategies.push('Fibonacci (BUY)')
  else if (components.fibonacci <= 40) alignedStrategies.push('Fibonacci (SELL)')
  if (components.smc >= 60) alignedStrategies.push('SMC (BUY)')
  else if (components.smc <= 40) alignedStrategies.push('SMC (SELL)')

  const summary = alignedStrategies.length > 0
    ? `${alignedStrategies.join(', ')} bir yo\'nalishda`
    : 'Strategiyalar orasida noaniqlik mavjud'

  return {
    finalScore: Math.round(finalScore),
    direction,
    strength,
    components,
    conflictFlag,
    alignmentBonus: Math.abs(alignmentBonus),
    summary,
  }
}

// ------------------------------------------------------------------
// Entry, TP, SL hisoblash (ATR asosida)
// ------------------------------------------------------------------
export function calcEntryExitLevels(
  currentPrice: number,
  atr: number | null,
  direction: SignalDirection,
  riskReward = 2.5
): {
  entry: number
  tp1: number
  tp2: number
  tp3: number
  sl: number
  rr: number
} {
  const atrVal = atr ?? currentPrice * 0.005 // default: 0.5%
  const slDistance = atrVal * 1.5
  const tpUnit = slDistance * riskReward / 3

  if (direction === 'BUY') {
    return {
      entry: currentPrice,
      tp1: currentPrice + tpUnit,
      tp2: currentPrice + tpUnit * 2,
      tp3: currentPrice + tpUnit * 3,
      sl: currentPrice - slDistance,
      rr: riskReward,
    }
  } else if (direction === 'SELL') {
    return {
      entry: currentPrice,
      tp1: currentPrice - tpUnit,
      tp2: currentPrice - tpUnit * 2,
      tp3: currentPrice - tpUnit * 3,
      sl: currentPrice + slDistance,
      rr: riskReward,
    }
  }

  return {
    entry: currentPrice,
    tp1: currentPrice,
    tp2: currentPrice,
    tp3: currentPrice,
    sl: currentPrice,
    rr: 0,
  }
}

// ------------------------------------------------------------------
// TO'LIQ ANALIZ — barcha modullarni ishga tushirish
// ------------------------------------------------------------------
export async function runFullAnalysis(
  symbol: string,
  timeframe: string,
  candles: OHLCVCandle[],
  weights: typeof DW = DW
): Promise<FullAnalysisResult> {
  // Parallel hisoblash
  const [indicators, snr, patterns, trendline, gann, fibonacci, smc] = await Promise.all([
    Promise.resolve(calculateIndicators(candles)),
    Promise.resolve(calculateSNR(candles)),
    Promise.resolve(detectPatterns(candles)),
    Promise.resolve(analyzeTrendlines(candles)),
    Promise.resolve(analyzeGann(candles)),
    Promise.resolve(analyzeFibonacci(candles)),
    Promise.resolve(analyzeSMC(candles)),
  ])

  const components = {
    indicators: indicators.score,
    snr: snr.score,
    patterns: patterns.score,
    trendline: trendline.score,
    gann: gann.score,
    fibonacci: fibonacci.score,
    smc: smc.score,
  }

  const confluence = computeConfluence(components, weights)

  return {
    symbol,
    timeframe,
    timestamp: Date.now(),
    indicators,
    snr,
    patterns,
    trendline,
    gann,
    fibonacci,
    smc,
    confluence,
  }
}

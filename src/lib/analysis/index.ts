// ============================================================
// src/lib/analysis/index.ts — Faza 3 Analysis Engine exports
// ============================================================
export { calculateIndicators } from './indicators'
export { calculateSNR } from './snr'
export { detectPatterns } from './patterns'
export { analyzeTrendlines } from './trendline'
export { analyzeGann, gannSquareOf9 } from './gann'
export { analyzeFibonacci } from './fibonacci'
export { analyzeSMC } from './smc'
export { runFullAnalysis, calcEntryExitLevels } from './confluence'
export type {
  OHLCVCandle, SignalDirection, SignalStrength,
  IndicatorResult, SNRResult, SNRZone,
  PatternResult, DetectedPattern, PatternType,
  TrendlineResult, Trendline,
  GannResult, GannFanLine,
  FibResult, FibLevel,
  SMCResult, MarketStructurePoint, FairValueGap, LiquiditySweep,
  ConfluenceResult, FullAnalysisResult, StrategyWeight,
} from './types'
export { DEFAULT_WEIGHTS } from './types'

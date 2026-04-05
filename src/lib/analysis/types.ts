// ============================================================
// Faza 3 — Texnik Analiz Tizimlari: Umumiy Tiplar
// ============================================================

export interface OHLCVCandle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type SignalDirection = 'BUY' | 'SELL' | 'NEUTRAL'
export type SignalStrength = 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL'

// ------------------------------------------------------------------
// 3.1 Texnik Indikatorlar
// ------------------------------------------------------------------
export interface IndicatorResult {
  sma: { period: number; value: number | null }[]
  ema: { period: number; value: number | null }[]
  rsi: { period: number; value: number | null }
  macd: {
    macd: number | null
    signal: number | null
    histogram: number | null
  }
  bollingerBands: {
    upper: number | null
    middle: number | null
    lower: number | null
    bandwidth: number | null
  }
  stochastic: {
    k: number | null
    d: number | null
  }
  atr: { period: number; value: number | null }
  adx: {
    adx: number | null
    pdi: number | null
    mdi: number | null
  }
  obv: number | null
  vwap: number | null
  signal: SignalDirection
  score: number // 0-100
}

// ------------------------------------------------------------------
// 3.2 SNR — Support & Resistance
// ------------------------------------------------------------------
export interface SNRZone {
  type: 'support' | 'resistance'
  priceTop: number
  priceBottom: number
  strength: number // 0-100
  touchCount: number
  volumeScore: number
  pivotType?: 'classic' | 'fib' | 'camarilla'
}

export interface SNRResult {
  zones: SNRZone[]
  nearestSupport: SNRZone | null
  nearestResistance: SNRZone | null
  signal: SignalDirection
  score: number
}

// ------------------------------------------------------------------
// 3.3 Chart Patterns
// ------------------------------------------------------------------
export type PatternType =
  | 'head_and_shoulders' | 'inverse_head_and_shoulders'
  | 'double_top' | 'double_bottom'
  | 'triple_top' | 'triple_bottom'
  | 'ascending_triangle' | 'descending_triangle' | 'symmetrical_triangle'
  | 'bull_flag' | 'bear_flag'
  | 'bull_pennant' | 'bear_pennant'
  | 'rising_wedge' | 'falling_wedge'
  | 'cup_and_handle'
  // Candlestick
  | 'doji' | 'hammer' | 'shooting_star' | 'hanging_man'
  | 'bullish_engulfing' | 'bearish_engulfing'
  | 'morning_star' | 'evening_star'
  | 'bullish_harami' | 'bearish_harami'
  | 'pinbar_bull' | 'pinbar_bear'
  | 'three_white_soldiers' | 'three_black_crows'

export interface DetectedPattern {
  type: PatternType
  direction: SignalDirection
  score: number // 0-100 (sifat va ishonchlilik)
  startIndex: number
  endIndex: number
  targetPrice: number | null
  description: string
}

export interface PatternResult {
  patterns: DetectedPattern[]
  dominantDirection: SignalDirection
  score: number
}

// ------------------------------------------------------------------
// 3.4 Trendline
// ------------------------------------------------------------------
export interface Trendline {
  direction: 'up' | 'down' | 'sideways'
  startIndex: number
  endIndex: number
  startPrice: number
  endPrice: number
  slope: number
  strength: number // 0-100
  touchCount: number
  broken: boolean
  projectedPrice: number // keyingi shamda kutilayotgan narx
}

export interface TrendlineResult {
  trendlines: Trendline[]
  mainTrend: 'up' | 'down' | 'sideways'
  trendStrength: number // 0-100
  signal: SignalDirection
  score: number
}

// ------------------------------------------------------------------
// 3.5 Gann
// ------------------------------------------------------------------
export interface GannFanLine {
  ratio: string // '1x1', '1x2', '2x1', '1x3', '3x1', '1x4', '4x1'
  angle: number // daraja
  price: number // hozirgi shamda qiymat
  type: 'support' | 'resistance'
}

export interface GannResult {
  fanLines: GannFanLine[]
  squareOf9Levels: number[]
  nearestSupport: number | null
  nearestResistance: number | null
  signal: SignalDirection
  score: number
}

// ------------------------------------------------------------------
// 3.6 Fibonacci
// ------------------------------------------------------------------
export interface FibLevel {
  ratio: number // 0.236, 0.382, 0.5, 0.618, 0.786, 1.272, 1.618, 2.618
  price: number
  type: 'retracement' | 'extension'
  label: string // '23.6%', '61.8%', etc.
  isActive: boolean // narx yaqinda bo'lgan daraja
}

export interface FibResult {
  swingHigh: number
  swingLow: number
  swingHighIndex: number
  swingLowIndex: number
  retracementLevels: FibLevel[]
  extensionLevels: FibLevel[]
  nearestLevel: FibLevel | null
  signal: SignalDirection
  score: number
}

// ------------------------------------------------------------------
// 3.7 Price Action / SMC
// ------------------------------------------------------------------
export interface MarketStructurePoint {
  type: 'HH' | 'HL' | 'LH' | 'LL' // Higher High/Low, Lower High/Low
  price: number
  index: number
}

export interface FairValueGap {
  direction: 'bullish' | 'bearish'
  top: number
  bottom: number
  midpoint: number
  startIndex: number
  filled: boolean
}

export interface LiquiditySweep {
  direction: 'buy_side' | 'sell_side'
  level: number
  index: number
  swept: boolean
}

export interface SMCResult {
  marketStructure: MarketStructurePoint[]
  trend: 'bullish' | 'bearish' | 'ranging'
  lastBOS: { price: number; direction: 'bullish' | 'bearish' } | null
  lastCHoCH: { price: number; direction: 'bullish' | 'bearish' } | null
  fvgZones: FairValueGap[]
  liquiditySweeps: LiquiditySweep[]
  signal: SignalDirection
  score: number
}

// ------------------------------------------------------------------
// 3.8 Confluence Scoring
// ------------------------------------------------------------------
export interface StrategyWeight {
  indicators: number  // 3.1
  snr: number         // 3.2
  patterns: number    // 3.3
  trendline: number   // 3.4
  gann: number        // 3.5
  fibonacci: number   // 3.6
  smc: number         // 3.7
}

export const DEFAULT_WEIGHTS: StrategyWeight = {
  indicators: 0.20,
  snr: 0.25,
  patterns: 0.15,
  trendline: 0.15,
  gann: 0.10,
  fibonacci: 0.10,
  smc: 0.05,
}

export interface ConfluenceResult {
  finalScore: number       // 0-100
  direction: SignalDirection
  strength: SignalStrength
  components: {
    indicators: number
    snr: number
    patterns: number
    trendline: number
    gann: number
    fibonacci: number
    smc: number
  }
  conflictFlag: boolean    // strategiyalar to'qnash kelayapti
  alignmentBonus: number   // ikkalasi bir yo'nalishda → +15
  summary: string          // "SNR + Fibonacci + RSI bir joyda mos kelmoqda"
}

// Full analysis result
export interface FullAnalysisResult {
  symbol: string
  timeframe: string
  timestamp: number
  indicators: IndicatorResult
  snr: SNRResult
  patterns: PatternResult
  trendline: TrendlineResult
  gann: GannResult
  fibonacci: FibResult
  smc: SMCResult
  confluence: ConfluenceResult
}

// ============================================================
// AI Trading Engine — Type Definitions
// ============================================================

export interface AIVerdictRaw {
  direction: 'BUY' | 'SELL' | 'NEUTRAL'
  scenario?: 'BUY LIMIT' | 'SELL LIMIT' | 'NEUTRAL'   // Malaysia SNR pending order
  condition?: string                                     // "narx X darajasiga yetganda kirish"
  confidence: number          // 0-100
  entry: number
  stopLoss: number
  takeProfit1: number
  takeProfit2: number
  takeProfit3: number
  riskReward: string          // e.g. "1:2.5"
  reasoning: string           // AI explanation (Uzbek or English)
  keyLevels: string[]         // important price levels mentioned
  watchout: string            // risk warning
}

export interface GPTVerdict extends AIVerdictRaw {
  model: string               // 'gpt-4o-mini' | 'gpt-4o'
  tokensUsed: number
  latencyMs: number
}

export interface GeminiVerdict extends AIVerdictRaw {
  model: string               // 'gemini-2.0-flash'
  latencyMs: number
}

export type ConsensusType =
  | 'STRONG_BUY'
  | 'STRONG_SELL'
  | 'WEAK_BUY'
  | 'WEAK_SELL'
  | 'NEUTRAL'
  | 'CONFLICT'

export interface ConsensusResult {
  consensus: ConsensusType
  confidence: number          // 0-100
  direction: 'BUY' | 'SELL' | 'NEUTRAL'
  entry: number
  stopLoss: number
  takeProfit1: number
  takeProfit2: number
  takeProfit3: number
  riskReward: string
  combinedReasoning: string   // merged from both AIs
  watchout: string
  gptDirection: string
  geminiDirection: string
  conflict: boolean
}

export interface AIAnalysisResult {
  symbol: string
  timeframe: string
  gpt: GPTVerdict | null
  gemini: GeminiVerdict | null
  consensus: ConsensusResult
  analyzedAt: string          // ISO timestamp
  error?: string
}

// ─── FATH AI (3-manba konsensus) ─────────────────────────────
export interface MathAnalysis {
  direction: 'BUY' | 'SELL' | 'NEUTRAL'
  score: number                // confluence score 0-100
  components: Record<string, number>
}

export interface FathAISignal {
  direction: 'BUY' | 'SELL' | 'NEUTRAL'
  confidence: number           // 0-100
  consensus: string            // 'STRONG_BUY' | 'WEAK_BUY' | ...
  entry: number
  stopLoss: number
  takeProfit1: number
  takeProfit2: number
  takeProfit3: number
  riskReward: string
  reasoning: string            // FATH AI birlashgan tahlil
  gptReasoning: string | null
  geminiReasoning: string | null
  mathReasoning: string
  conflict: boolean
  sources: string[]            // e.g. ['GPT-4o', 'Gemini', 'Matematik']
}

export interface FathAIResult {
  symbol: string
  timeframe: string
  gpt: GPTVerdict | null       // Trendline + Pattern mutaxassisi
  gemini: GeminiVerdict | null // SNR + SMC mutaxassisi
  math: MathAnalysis           // Matematik tahlil
  fathAI: FathAISignal         // Yakuniy FATH AI signali
  analyzedAt: string
  error?: string
}

// Admin tomonidan saqlangan AI prompt
export interface AIStrategyPrompt {
  id: 'gpt_strategy' | 'gemini_strategy'
  label: string
  systemPrompt: string
  strategyFocus: string[]      // e.g. ['trendline', 'patterns']
  updatedAt: string
  updatedBy?: string
}

// ─── Signal Holati Tizimi (ACTIVE / PENDING / NO_TRADE) ───────────

export type SignalStatus = 'ACTIVE' | 'PENDING' | 'NO_TRADE'

export interface DeepMarketAnalysis {
  marketCondition: {
    trend: 'bullish' | 'bearish' | 'sideways'
    pricePosition: 'in_resistance' | 'in_support' | 'in_range' | 'no_mans_land'
    momentum: 'strengthening' | 'weakening' | 'reversing' | 'neutral'
  }
  technicalSummary: {
    rsi: { value: number; state: 'overbought' | 'oversold' | 'neutral' }
    macd: { bullishCross: boolean; histogramGrowing: boolean; state: string }
    emaOrder: 'bullish' | 'bearish' | 'mixed'
    atr: { value: number; level: 'low' | 'medium' | 'high' }
    adx: { value: number; strength: 'weak' | 'trend' | 'strong' }
  }
  smcSummary: {
    nearestBullishOB: number | null
    nearestBearishOB: number | null
    activeFVG: boolean
    lastBOSDirection: 'bullish' | 'bearish' | null
  }
  scenarios: {
    bull: string
    bear: string
  }
  confluenceScore: number
  confluenceComponents: Record<string, number>
}

export interface FathAISignalExtended extends FathAISignal {
  status: SignalStatus
  // PENDING signal uchun qo'shimcha maydonlar
  triggerZone?: { from: number; to: number }
  triggerCondition?: string
  validUntil?: string          // ISO datetime
  invalidateAbove?: number
  invalidateBelow?: number
  // NO_TRADE holati uchun
  noTradeReason?: string
  nextCheckTime?: string
  // Chuqur tahlil
  deepAnalysis?: DeepMarketAnalysis
  // Engine ballari (UI uchun — model nomlari ko'rsatilmaydi)
  engineScores: {
    visionEngine: number  // FATH AI Vision Engine
    marketEngine: number  // FATH AI Market Engine
    mathEngine: number    // FATH AI Math Engine
  }
}

// API dan qaytuvchi signal ma'lumoti (frontend uchun)
export interface ChatSignalData {
  status: SignalStatus
  symbol: string
  timeframe: string
  direction: 'BUY' | 'SELL' | 'NEUTRAL'
  confidence: number
  entry: number
  sl: number
  tp1: number
  tp2: number
  tp3: number
  rr: number
  // PENDING uchun
  triggerZone?: { from: number; to: number }
  triggerCondition?: string
  validHours: number
  invalidateAbove?: number
  invalidateBelow?: number
  // NO_TRADE uchun
  noTradeReason?: string
  nextCheckTime?: string
  // Engine ballari (model nomlari ko'rsatilmaydi)
  engineScores: {
    visionEngine: number
    marketEngine: number
    mathEngine: number
  }
  // Chuqur tahlil
  deepAnalysis: {
    trend: 'bullish' | 'bearish' | 'sideways'
    pricePosition: string
    momentum: string
    rsi: { value: number; state: string }
    macd: { state: string }
    emaOrder: string
    atr: { level: string }
    adx: { value: number; strength: string }
    lastBOSDirection: string | null
    activeFVG: boolean
    confluenceScore: number
    scenarios: { bull: string; bear: string }
  }
}

// Context passed to AI models
export interface AnalysisContext {
  symbol: string
  timeframe: string
  currentPrice: number
  indicators: {
    rsi: number
    macd: { value: number; signal: number; histogram: number }
    ema20: number
    ema50: number
    ema200: number
    atr: number
  }
  confluence: {
    score: number
    direction: string
    strategies: Array<{ name: string; score: number; direction: string }>
  }
  snr: {
    nearestSupport: number | null
    nearestResistance: number | null
    supportStrength: number
    resistanceStrength: number
  }
  fibonacci: {
    retracements: Array<{ level: string; price: number }>
    trend: string
  }
  patterns: Array<{ type: string; direction: string; score: number }>
  trend: string               // 'bullish' | 'bearish' | 'sideways'
  fundamental?: {
    score: number
    direction: string
    highlights: string[]
    signalBlocked: boolean
    blockedReason?: string
  }
}

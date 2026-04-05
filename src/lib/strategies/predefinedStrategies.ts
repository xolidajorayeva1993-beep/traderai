// ============================================================
// Predefined Strategy Library — Faza 4.4
// 12 ready-made trading strategies for FATH AI engine
// ============================================================

import type { Strategy } from '@/types'

const NOW = Date.now()

export const PREDEFINED_STRATEGIES: Strategy[] = [
  // ─── Strategy 1: SNR Bounce ───────────────────────────────────
  {
    id: 'snr-bounce',
    name: 'Support & Resistance Bounce',
    description:
      'Price bounces from a strong S/R zone confirmed by volume spike and candlestick reversal pattern.',
    type: 'technical',
    rules: [
      {
        type: 'snr',
        name: 'Strong S/R Zone Proximity',
        params: { distancePct: 0.3, minTouches: 2, minStrength: 70 },
        weight: 0.40,
        condition: 'price within 0.3% of S/R zone AND zone strength >= 70',
      },
      {
        type: 'pattern',
        name: 'Reversal Candlestick',
        params: { patterns: ['hammer', 'shootingstar', 'engulfing', 'pinbar'] },
        weight: 0.35,
        condition: 'at least one reversal candlestick pattern present',
      },
      {
        type: 'indicator',
        name: 'Volume Confirmation',
        params: { multiplier: 1.5 },
        weight: 0.25,
        condition: 'current volume >= 1.5x average volume',
      },
    ],
    weight: 0.85,
    winRate: 0,
    totalSignals: 0,
    profitFactor: 0,
    isActive: true,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // ─── Strategy 2: RSI Oversold Reversal ───────────────────────
  {
    id: 'rsi-oversold-reversal',
    name: 'RSI Oversold Reversal',
    description:
      'RSI drops below 30 and crosses back up, signaling buyer exhaustion reversal.',
    type: 'technical',
    rules: [
      {
        type: 'indicator',
        name: 'RSI Oversold',
        params: { period: 14, threshold: 30 },
        weight: 0.50,
        condition: 'RSI(14) < 30 and now crossing above 30',
      },
      {
        type: 'indicator',
        name: 'Bullish MACD',
        params: { fast: 12, slow: 26, signal: 9 },
        weight: 0.30,
        condition: 'MACD histogram turning positive',
      },
      {
        type: 'snr',
        name: 'Near Support',
        params: { distancePct: 1.0, minStrength: 50 },
        weight: 0.20,
        condition: 'price near support zone',
      },
    ],
    weight: 0.80,
    winRate: 0,
    totalSignals: 0,
    profitFactor: 0,
    isActive: true,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // ─── Strategy 3: RSI Overbought Reversal ─────────────────────
  {
    id: 'rsi-overbought-reversal',
    name: 'RSI Overbought Reversal',
    description:
      'RSI above 70 then crosses back below, signaling seller exhaustion reversal.',
    type: 'technical',
    rules: [
      {
        type: 'indicator',
        name: 'RSI Overbought',
        params: { period: 14, threshold: 70 },
        weight: 0.50,
        condition: 'RSI(14) > 70 and now crossing below 70',
      },
      {
        type: 'indicator',
        name: 'Bearish MACD',
        params: { fast: 12, slow: 26, signal: 9 },
        weight: 0.30,
        condition: 'MACD histogram turning negative',
      },
      {
        type: 'snr',
        name: 'Near Resistance',
        params: { distancePct: 1.0, minStrength: 50 },
        weight: 0.20,
        condition: 'price near resistance zone',
      },
    ],
    weight: 0.80,
    winRate: 0,
    totalSignals: 0,
    profitFactor: 0,
    isActive: true,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // ─── Strategy 4: MACD Crossover Momentum ─────────────────────
  {
    id: 'macd-crossover',
    name: 'MACD Signal Line Crossover',
    description:
      'MACD line crosses signal line in direction of higher-timeframe trend.',
    type: 'technical',
    rules: [
      {
        type: 'indicator',
        name: 'MACD Crossover',
        params: { fast: 12, slow: 26, signal: 9 },
        weight: 0.50,
        condition: 'MACD line crosses above/below signal line',
      },
      {
        type: 'indicator',
        name: 'EMA Trend Filter',
        params: { period: 50 },
        weight: 0.30,
        condition: 'price above EMA50 for BUY, below EMA50 for SELL',
      },
      {
        type: 'indicator',
        name: 'Volume Rising',
        params: { multiplier: 1.2 },
        weight: 0.20,
        condition: 'volume rising over last 3 candles',
      },
    ],
    weight: 0.75,
    winRate: 0,
    totalSignals: 0,
    profitFactor: 0,
    isActive: true,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // ─── Strategy 5: Fibonacci 61.8% Retracement ─────────────────
  {
    id: 'fibonacci-618-retracement',
    name: 'Fibonacci 61.8% Retracement',
    description:
      'Price retraces to the 61.8% Fibonacci level within an established trend and resumes.',
    type: 'technical',
    rules: [
      {
        type: 'fibonacci',
        name: 'Fib 61.8 Zone',
        params: { level: 0.618, tolerance: 0.005 },
        weight: 0.45,
        condition: 'price within 0.5% of 61.8% Fib retracement',
      },
      {
        type: 'indicator',
        name: 'Trend Intact',
        params: { ema: 21 },
        weight: 0.30,
        condition: 'EMA21 slope aligns with original trend direction',
      },
      {
        type: 'pattern',
        name: 'Reversal Pattern at Fib',
        params: { patterns: ['pinbar', 'engulfing', 'doji'] },
        weight: 0.25,
        condition: 'reversal pattern forms at Fib zone',
      },
    ],
    weight: 0.80,
    winRate: 0,
    totalSignals: 0,
    profitFactor: 0,
    isActive: true,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // ─── Strategy 6: Trendline Breakout ──────────────────────────
  {
    id: 'trendline-breakout',
    name: 'Trendline Breakout',
    description:
      'Price breaks and closes beyond a validated trendline with volume confirmation.',
    type: 'technical',
    rules: [
      {
        type: 'trendline',
        name: 'Trendline Break',
        params: { minTouches: 3, breakoutClosing: true },
        weight: 0.50,
        condition: 'candle closes beyond trendline (not just wicks)',
      },
      {
        type: 'indicator',
        name: 'Volume Spike on Break',
        params: { multiplier: 2.0 },
        weight: 0.30,
        condition: 'breakout volume >= 2x average',
      },
      {
        type: 'indicator',
        name: 'Momentum Confirmation',
        params: { period: 14 },
        weight: 0.20,
        condition: 'RSI momentum above 50 for BUY, below 50 for SELL',
      },
    ],
    weight: 0.78,
    winRate: 0,
    totalSignals: 0,
    profitFactor: 0,
    isActive: true,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // ─── Strategy 7: Bullish Engulfing Setup ─────────────────────
  {
    id: 'bullish-engulfing',
    name: 'Bullish Engulfing at Support',
    description:
      'Bullish engulfing candlestick pattern forms at a key support level.',
    type: 'technical',
    rules: [
      {
        type: 'pattern',
        name: 'Bullish Engulfing Pattern',
        params: { minBodyRatio: 1.2 },
        weight: 0.45,
        condition: 'bullish candle body fully engulfs prior bearish candle',
      },
      {
        type: 'snr',
        name: 'At Support Zone',
        params: { distancePct: 0.5, minStrength: 60 },
        weight: 0.35,
        condition: 'pattern at or near support zone',
      },
      {
        type: 'indicator',
        name: 'RSI Not Overbought',
        params: { maxRsi: 65 },
        weight: 0.20,
        condition: 'RSI < 65 (room to move up)',
      },
    ],
    weight: 0.82,
    winRate: 0,
    totalSignals: 0,
    profitFactor: 0,
    isActive: true,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // ─── Strategy 8: Bearish Engulfing Setup ─────────────────────
  {
    id: 'bearish-engulfing',
    name: 'Bearish Engulfing at Resistance',
    description:
      'Bearish engulfing candlestick pattern forms at a key resistance level.',
    type: 'technical',
    rules: [
      {
        type: 'pattern',
        name: 'Bearish Engulfing Pattern',
        params: { minBodyRatio: 1.2 },
        weight: 0.45,
        condition: 'bearish candle body fully engulfs prior bullish candle',
      },
      {
        type: 'snr',
        name: 'At Resistance Zone',
        params: { distancePct: 0.5, minStrength: 60 },
        weight: 0.35,
        condition: 'pattern at or near resistance zone',
      },
      {
        type: 'indicator',
        name: 'RSI Not Oversold',
        params: { minRsi: 35 },
        weight: 0.20,
        condition: 'RSI > 35 (room to move down)',
      },
    ],
    weight: 0.82,
    winRate: 0,
    totalSignals: 0,
    profitFactor: 0,
    isActive: true,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // ─── Strategy 9: SMC Break of Structure ──────────────────────
  {
    id: 'smc-bos',
    name: 'SMC Break of Structure',
    description:
      'Smart Money Concept break of structure (BOS) confirming directional bias shift.',
    type: 'technical',
    rules: [
      {
        type: 'smc',
        name: 'Break of Structure',
        params: { type: 'BOS' },
        weight: 0.50,
        condition: 'price breaks prior swing high (BUY) or swing low (SELL)',
      },
      {
        type: 'smc',
        name: 'Order Block',
        params: { type: 'OB', lookback: 20 },
        weight: 0.30,
        condition: 'recent order block not mitigated',
      },
      {
        type: 'indicator',
        name: 'Volume Confirmation',
        params: { multiplier: 1.3 },
        weight: 0.20,
        condition: 'BOS candle volume >= 1.3x average',
      },
    ],
    weight: 0.87,
    winRate: 0,
    totalSignals: 0,
    profitFactor: 0,
    isActive: true,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // ─── Strategy 10: Bollinger Band Squeeze ─────────────────────
  {
    id: 'bb-squeeze-breakout',
    name: 'Bollinger Band Squeeze Breakout',
    description:
      'Bands contract indicating low volatility, then price breaks out with expansion.',
    type: 'technical',
    rules: [
      {
        type: 'indicator',
        name: 'BB Squeeze',
        params: { period: 20, stdDev: 2, squeezePct: 30 },
        weight: 0.40,
        condition: 'BB width in bottom 30% of last 50 candles',
      },
      {
        type: 'indicator',
        name: 'BB Breakout Candle',
        params: { direction: 'any' },
        weight: 0.40,
        condition: 'candle closes outside Bollinger Band',
      },
      {
        type: 'indicator',
        name: 'Momentum',
        params: { rsiMin: 50 },
        weight: 0.20,
        condition: 'RSI confirms direction of break',
      },
    ],
    weight: 0.75,
    winRate: 0,
    totalSignals: 0,
    profitFactor: 0,
    isActive: true,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // ─── Strategy 11: EMA Cross ───────────────────────────────────
  {
    id: 'ema-cross-21-50',
    name: 'EMA 21/50 Golden / Death Cross',
    description:
      'EMA 21 crosses EMA 50 signaling trend change. Golden cross = BUY, Death cross = SELL.',
    type: 'technical',
    rules: [
      {
        type: 'indicator',
        name: 'EMA 21/50 Crossover',
        params: { fast: 21, slow: 50 },
        weight: 0.55,
        condition: 'EMA21 crosses EMA50 in signal direction',
      },
      {
        type: 'indicator',
        name: 'Price Above/Below Both EMAs',
        params: {},
        weight: 0.25,
        condition: 'price on same side as the cross direction',
      },
      {
        type: 'indicator',
        name: 'ADX Trend Strength',
        params: { period: 14, minAdx: 20 },
        weight: 0.20,
        condition: 'ADX > 20 (trending market)',
      },
    ],
    weight: 0.73,
    winRate: 0,
    totalSignals: 0,
    profitFactor: 0,
    isActive: true,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  },

  // ─── Strategy 12: Gann 1x1 Trend Following ───────────────────
  {
    id: 'gann-1x1-trend',
    name: 'Gann 1×1 Trend Following',
    description:
      'Price respects the Gann 1×1 (45-degree) angle and continues in trend direction.',
    type: 'technical',
    rules: [
      {
        type: 'gann',
        name: 'Price Above/Below 1x1',
        params: { angle: '1x1' },
        weight: 0.50,
        condition: 'price above 1x1 for BUY, below 1x1 for SELL',
      },
      {
        type: 'gann',
        name: 'Gann Fan Not Broken',
        params: { lookback: 10 },
        weight: 0.30,
        condition: 'no Gann angle violated in last 10 candles',
      },
      {
        type: 'indicator',
        name: 'MA Alignment',
        params: { fast: 20, slow: 50, smoothing: 200 },
        weight: 0.20,
        condition: 'MA20 > MA50 for BUY trend',
      },
    ],
    weight: 0.70,
    winRate: 0,
    totalSignals: 0,
    profitFactor: 0,
    isActive: true,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  },
]

/** Get only active strategies */
export function getActiveStrategies(): Strategy[] {
  return PREDEFINED_STRATEGIES.filter((s) => s.isActive)
}

/** Get strategy by id */
export function getStrategyById(id: string): Strategy | undefined {
  return PREDEFINED_STRATEGIES.find((s) => s.id === id)
}

/** Get strategies by type */
export function getStrategiesByType(type: Strategy['type']): Strategy[] {
  return PREDEFINED_STRATEGIES.filter((s) => s.type === type && s.isActive)
}

export default PREDEFINED_STRATEGIES

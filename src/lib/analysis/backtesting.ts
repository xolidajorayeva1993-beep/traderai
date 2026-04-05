// ============================================================
// Backtesting Engine — Faza 4.7
// Walk-forward backtest using historical candle data
// ============================================================

import { runFullAnalysis, DEFAULT_WEIGHTS } from '@/lib/analysis'
import type { OHLCVCandle } from '@/lib/analysis/types'

export interface TradeResult {
  entryIndex: number
  entryPrice: number
  direction: 'BUY' | 'SELL'
  tp1: number
  sl: number
  exitPrice: number
  exitIndex: number
  outcome: 'TP' | 'SL' | 'OPEN'
  pnlPct: number          // percent profit/loss on trade
  holdCandles: number     // how many candles held
}

export interface BacktestResult {
  symbol: string
  timeframe: string
  totalTrades: number
  wins: number
  losses: number
  winRate: number         // 0-1
  profitFactor: number    // gross profit / gross loss
  maxDrawdownPct: number  // worst peak-to-trough %
  sharpeRatio: number     // annualised Sharpe (approx)
  avgHoldCandles: number
  trades: TradeResult[]
  analyzedAt: string
}

const TP_PCT_DEFAULT  = 0.015   // 1.5%
const SL_PCT_DEFAULT  = 0.008   // 0.8%
const RISK_FREE_RATE  = 0.04    // 4% annual
const CANDLES_PER_YEAR = 8760   // for 1h candles (adjust externally)
const MIN_SIGNAL_CONFIDENCE = 55

function calcRiskReward(direction: 'BUY' | 'SELL', entry: number, tpPct: number, slPct: number) {
  if (direction === 'BUY') {
    return { tp1: entry * (1 + tpPct), sl: entry * (1 - slPct) }
  }
  return { tp1: entry * (1 - tpPct), sl: entry * (1 + slPct) }
}

function simulateTrade(
  candles: OHLCVCandle[],
  entryIndex: number,
  direction: 'BUY' | 'SELL',
  tp1: number,
  sl: number,
  maxHold = 50
): Omit<TradeResult, 'entryIndex' | 'entryPrice' | 'direction' | 'tp1' | 'sl'> {
  const entryPrice = candles[entryIndex].close

  for (let i = entryIndex + 1; i < candles.length && i <= entryIndex + maxHold; i++) {
    const { high, low, close } = candles[i]

    if (direction === 'BUY') {
      if (high >= tp1) {
        const pnlPct = (tp1 - entryPrice) / entryPrice
        return { exitPrice: tp1, exitIndex: i, outcome: 'TP', pnlPct, holdCandles: i - entryIndex }
      }
      if (low <= sl) {
        const pnlPct = (sl - entryPrice) / entryPrice
        return { exitPrice: sl, exitIndex: i, outcome: 'SL', pnlPct, holdCandles: i - entryIndex }
      }
    } else {
      if (low <= tp1) {
        const pnlPct = (entryPrice - tp1) / entryPrice
        return { exitPrice: tp1, exitIndex: i, outcome: 'TP', pnlPct, holdCandles: i - entryIndex }
      }
      if (high >= sl) {
        const pnlPct = (entryPrice - sl) / entryPrice * -1
        return { exitPrice: sl, exitIndex: i, outcome: 'SL', pnlPct, holdCandles: i - entryIndex }
      }
    }

    // Last candle: close at market
    if (i === entryIndex + maxHold || i === candles.length - 1) {
      const pnlPct = direction === 'BUY'
        ? (close - entryPrice) / entryPrice
        : (entryPrice - close) / entryPrice
      return { exitPrice: close, exitIndex: i, outcome: 'OPEN', pnlPct, holdCandles: i - entryIndex }
    }
  }

  return {
    exitPrice: candles[entryIndex].close,
    exitIndex: entryIndex,
    outcome: 'OPEN',
    pnlPct: 0,
    holdCandles: 0,
  }
}

/** 
 * Walk-forward backtest.
 * Uses first `trainWindow` candles for analysis, then evaluates on next `evalWindow`.
 * Slides forward by `stepSize` candles each iteration.
 */
export async function runBacktest(
  symbol: string,
  timeframe: string,
  candles: OHLCVCandle[],
  options?: {
    trainWindow?: number
    evalWindow?: number
    stepSize?: number
    tpPct?: number
    slPct?: number
  }
): Promise<BacktestResult> {
  const {
    trainWindow = 150,
    evalWindow  = 50,
    stepSize    = 25,
    tpPct       = TP_PCT_DEFAULT,
    slPct       = SL_PCT_DEFAULT,
  } = options ?? {}

  const trades: TradeResult[] = []

  const totalCandles = candles.length
  let pos = trainWindow

  while (pos + evalWindow <= totalCandles) {
    const trainSlice = candles.slice(pos - trainWindow, pos)

    // Analyze the training window
    let analysis
    try {
      analysis = await runFullAnalysis(symbol, timeframe, trainSlice, DEFAULT_WEIGHTS)
    } catch {
      pos += stepSize
      continue
    }

    const { direction, finalScore } = analysis.confluence

    if (direction === 'NEUTRAL' || finalScore < MIN_SIGNAL_CONFIDENCE) {
      pos += stepSize
      continue
    }

    // Entry is the first candle in eval window
    const entryIndex = pos  // absolute index in full candles array
    const entryPrice = candles[entryIndex].close
    const { tp1, sl } = calcRiskReward(direction, entryPrice, tpPct, slPct)

    // Evaluate over next evalWindow candles (in full candle array)
    const evalSlice = candles // use full array for simulation (sliced internally)
    const sim = simulateTrade(evalSlice, entryIndex, direction, tp1, sl, evalWindow)

    trades.push({
      entryIndex,
      entryPrice,
      direction,
      tp1,
      sl,
      ...sim,
    })

    pos += stepSize
  }

  // ─── Stats computation ───────────────────────────────────────
  const wins   = trades.filter((t) => t.outcome === 'TP').length
  const losses = trades.filter((t) => t.outcome === 'SL').length
  const total  = trades.length

  const grossProfit = trades.filter((t) => t.pnlPct > 0).reduce((s, t) => s + t.pnlPct, 0)
  const grossLoss   = Math.abs(trades.filter((t) => t.pnlPct < 0).reduce((s, t) => s + t.pnlPct, 0))
  const profitFactor = grossLoss === 0 ? grossProfit > 0 ? 999 : 0 : grossProfit / grossLoss

  // Max drawdown (consecutive PnL stream)
  let peak = 0
  let equity = 0
  let maxDrawdownPct = 0
  for (const t of trades) {
    equity += t.pnlPct
    if (equity > peak) peak = equity
    const dd = peak - equity
    if (dd > maxDrawdownPct) maxDrawdownPct = dd
  }

  // Sharpe ratio (simplified: mean / stdev of returns × sqrt(N per year))
  const returns = trades.map((t) => t.pnlPct)
  const meanReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0
  const variance   = returns.length > 1
    ? returns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) / (returns.length - 1)
    : 0
  const stdDev = Math.sqrt(variance)
  const rfPerTrade = RISK_FREE_RATE / CANDLES_PER_YEAR * (evalWindow / 2)
  const sharpeRatio = stdDev === 0 ? 0 : Math.round(((meanReturn - rfPerTrade) / stdDev) * Math.sqrt(CANDLES_PER_YEAR) * 100) / 100

  const avgHoldCandles = total > 0
    ? Math.round(trades.reduce((s, t) => s + t.holdCandles, 0) / total)
    : 0

  return {
    symbol,
    timeframe,
    totalTrades: total,
    wins,
    losses,
    winRate: total > 0 ? Math.round((wins / total) * 1000) / 1000 : 0,
    profitFactor: Math.round(profitFactor * 100) / 100,
    maxDrawdownPct: Math.round(maxDrawdownPct * 10000) / 100,  // percent
    sharpeRatio,
    avgHoldCandles,
    trades,
    analyzedAt: new Date().toISOString(),
  }
}

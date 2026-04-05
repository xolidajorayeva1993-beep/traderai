// ============================================================
// FATH AI — Fundamental Score Calculator
// Combines calendar + news + crypto into one score
// ============================================================
import type {
  FundamentalScore,
  CalendarResult,
  NewsSentimentResult,
  CryptoFundamental,
} from './types'
import { extractCurrencies } from './economicCalendar'
import { interpretFearGreed, interpretFundingRate } from './cryptoFundamental'

function isCryptoPair(symbol: string): boolean {
  const s = symbol.toUpperCase()
  return s.includes('BTC') || s.includes('ETH') || s.includes('BNB') ||
    s.includes('SOL') || s.endsWith('USDT') || s.endsWith('BUSD')
}

function directionFromScore(score: number): 'bullish' | 'bearish' | 'neutral' {
  return score > 15 ? 'bullish' : score < -15 ? 'bearish' : 'neutral'
}

export function calculateFundamentalScore(
  symbol: string,
  calendar: CalendarResult,
  news: NewsSentimentResult,
  crypto?: CryptoFundamental,
): FundamentalScore {
  const currencies = extractCurrencies(symbol)
  const isCrypto = isCryptoPair(symbol)

  // ---- 1. Calendar score ----
  let calendarScore = 0
  const sentFromCal = currencies.map(c => calendar.sentiment[c] ?? 0)
  calendarScore = sentFromCal.length > 0
    ? sentFromCal.reduce((a,b) => a+b, 0) / sentFromCal.length
    : 0
  // For pairs like EURUSD: EUR positive + USD negative → bullish for EURUSD
  // We take first currency positive minus second negative
  if (currencies.length >= 2) {
    const base = calendar.sentiment[currencies[0]] ?? 0   // EUR
    const quote = calendar.sentiment[currencies[1]] ?? 0  // USD
    calendarScore = base - quote * 0.5
  }
  calendarScore = Math.round(Math.max(-100, Math.min(100, calendarScore)))

  // ---- 2. News score ----
  let newsScore = 0
  const sentFromNews = currencies.map(c => news.currencySentiment[c] ?? 0)
  newsScore = sentFromNews.length > 0
    ? sentFromNews.reduce((a,b) => a+b, 0) / sentFromNews.length
    : 0
  if (currencies.length >= 2) {
    const base = news.currencySentiment[currencies[0]] ?? 0
    const quote = news.currencySentiment[currencies[1]] ?? 0
    newsScore = base - quote * 0.5
  }
  newsScore = Math.round(Math.max(-100, Math.min(100, newsScore)))

  // ---- 3. Central Bank score (fixed simple heuristics from news) ----
  // We derive CB stance from newsScore directionally
  const cbScore = Math.round(newsScore * 0.6)

  // ---- 4. Crypto score ----
  let cryptoScore = 0
  if (isCrypto && crypto) {
    const fgInterp = interpretFearGreed(crypto.fearGreedIndex)
    const fgScore = fgInterp.signal === 'bullish' ? 40 : fgInterp.signal === 'bearish' ? -40 : 0

    // Funding rate for the symbol
    const fr = crypto.fundingRates[symbol] ?? 0
    const frSignal = interpretFundingRate(fr)
    const frScore = frSignal === 'bullish' ? 30 : frSignal === 'bearish' ? -30 : 0

    // BTC dominance: high dom = bitcoin season (good for BTC, bad for alts)
    const domScore = symbol.includes('BTC')
      ? (crypto.btcDominance > 55 ? 15 : -10)
      : crypto.btcDominance > 60 ? -20 : 10

    cryptoScore = Math.round((fgScore + frScore + domScore) / 3)
  }

  // ---- Weighted combination ----
  // Forex: cal(30%) + news(40%) + cb(30%)
  // Crypto: cal(15%) + news(35%) + cb(15%) + crypto(35%)
  let overallScore: number
  const components = {
    calendar: calendarScore,
    news: newsScore,
    centralBank: cbScore,
    crypto: cryptoScore,
  }

  if (isCrypto) {
    overallScore =
      calendarScore * 0.15 +
      newsScore * 0.35 +
      cbScore * 0.15 +
      cryptoScore * 0.35
  } else {
    overallScore =
      calendarScore * 0.30 +
      newsScore * 0.40 +
      cbScore * 0.30
  }
  overallScore = Math.round(Math.max(-100, Math.min(100, overallScore)))

  // Confidence based on data availability and consistency
  const scoreMix = Object.values(components).filter(v => v !== 0)
  const variance = scoreMix.length > 1
    ? scoreMix.map(v => Math.abs(v - overallScore)).reduce((a,b) => a+b,0) / scoreMix.length
    : 50
  const confidence = Math.round(Math.max(20, Math.min(85, 70 - variance * 0.3)))

  // ---- Highlights ----
  const highlights: string[] = []
  if (calendar.signalBlocked) {
    highlights.push(`⚠️ ${calendar.blockedReason ?? 'Muhim voqea yaqin'}`)
  }
  if (calendar.highImpactToday.length > 0) {
    const e = calendar.highImpactToday[0]
    highlights.push(`📅 Bugun: ${e.title} (${e.currency}) — ${e.time} UTC`)
  }
  if (isCrypto && crypto) {
    const fgInterp = interpretFearGreed(crypto.fearGreedIndex)
    highlights.push(`😱 Fear & Greed: ${crypto.fearGreedIndex} — ${fgInterp.note}`)
  }
  if (news.overallSentiment !== 'neutral') {
    const top = news.overallSentiment === 'bullish' ? news.topBullish[0] : news.topBearish[0]
    if (top) highlights.push(`📰 ${top.source}: ${top.title.slice(0, 80)}`)
  }
  if (highlights.length === 0) {
    highlights.push('📊 Fundamental holat neytral — yangi muhim yangilik yo\'q')
  }

  return {
    overallScore,
    direction: directionFromScore(overallScore),
    confidence,
    components,
    signalBlocked: calendar.signalBlocked,
    blockedReason: calendar.blockedReason,
    highlights: highlights.slice(0, 3),
    fetchedAt: Date.now(),
  }
}

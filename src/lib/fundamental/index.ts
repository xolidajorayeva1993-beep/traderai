// ============================================================
// FATH AI — Fundamental Analysis Module (public exports)
// ============================================================
export type {
  EconomicEvent,
  CalendarResult,
  NewsItem,
  NewsSentimentResult,
  CentralBankStance,
  CryptoFundamental,
  FundamentalScore,
  FullFundamentalResult,
  ImpactLevel,
} from './types'

export { getEconomicCalendar, fetchEconomicCalendar, getEventsForPair, extractCurrencies } from './economicCalendar'
export { getNewsSentiment, fetchNewsSentiment } from './newsFeed'
export { getCryptoFundamental, fetchCryptoFundamental, interpretFearGreed, interpretFundingRate } from './cryptoFundamental'
export { calculateFundamentalScore } from './fundamentalScore'
export { scoreSentiment, scoreCurrencySentiment, scoreToLabel } from './sentimentEngine'
export { getRedditSentiment, redditScoreForSymbol } from './redditSentiment'
export { getCentralBankStance, getAllBankStances } from './centralBankMonitor'

// ----- Convenience: run full fundamental analysis for a symbol -----
import { getEconomicCalendar } from './economicCalendar'
import { getNewsSentiment } from './newsFeed'
import { getCryptoFundamental } from './cryptoFundamental'
import { calculateFundamentalScore } from './fundamentalScore'
import type { FullFundamentalResult } from './types'

export async function runFundamentalAnalysis(symbol: string): Promise<FullFundamentalResult> {
  const isCrypto = symbol.toUpperCase().includes('BTC') ||
    symbol.toUpperCase().includes('ETH') ||
    symbol.toUpperCase().endsWith('USDT')

  const [calendar, news, crypto] = await Promise.allSettled([
    getEconomicCalendar(),
    getNewsSentiment(),
    isCrypto ? getCryptoFundamental([symbol]) : Promise.resolve(undefined),
  ])

  const calData = calendar.status === 'fulfilled' ? calendar.value : {
    events: [], highImpactToday: [], upcomingHigh: [],
    signalBlocked: false, blockedReason: null, sentiment: {}, fetchedAt: Date.now(),
  }
  const newsData = news.status === 'fulfilled' ? news.value : {
    items: [], currencySentiment: {}, overallSentiment: 'neutral' as const,
    topBullish: [], topBearish: [], fetchedAt: Date.now(),
  }
  const cryptoData = isCrypto && crypto.status === 'fulfilled' ? crypto.value : undefined

  const fundamentalScore = calculateFundamentalScore(symbol, calData, newsData, cryptoData)

  return {
    calendar: calData,
    news: newsData,
    fundamentalScore,
    ...(cryptoData ? { cryptoFundamental: cryptoData } : {}),
  }
}

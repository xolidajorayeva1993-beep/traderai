// ============================================================
// FATH AI — Fundamental Analysis Types
// ============================================================

// ----- Economic Calendar -----
export type ImpactLevel = 'High' | 'Medium' | 'Low' | 'Holiday'

export interface EconomicEvent {
  id: string
  title: string
  country: string
  currency: string     // USD, EUR, GBP, JPY, AUD, ...
  date: string         // ISO date "2026-04-04"
  time: string         // "08:30" UTC
  impact: ImpactLevel
  forecast: string | null
  previous: string | null
  actual: string | null
  surprise: number | null   // (actual - forecast) / |forecast| * 100
  isUpcoming: boolean       // still in future
}

export interface CalendarResult {
  events: EconomicEvent[]
  highImpactToday: EconomicEvent[]
  upcomingHigh: EconomicEvent[]   // next 4 hours
  signalBlocked: boolean           // true if high impact within 30 min
  blockedReason: string | null
  sentiment: Record<string, number> // currency → score (-100..100)
  fetchedAt: number
}

// ----- News & Sentiment -----
export interface NewsItem {
  id: string
  source: string
  title: string
  summary: string
  url: string
  publishedAt: string   // ISO datetime
  currencies: string[]  // affected currencies ["EUR", "USD"]
  sentiment: 'bullish' | 'bearish' | 'neutral'
  sentimentScore: number  // -100..100
  impact: 'high' | 'medium' | 'low'
}

export interface NewsSentimentResult {
  items: NewsItem[]
  currencySentiment: Record<string, number>  // EUR → +35
  overallSentiment: 'bullish' | 'bearish' | 'neutral'
  topBullish: NewsItem[]
  topBearish: NewsItem[]
  fetchedAt: number
}

// ----- Central Bank -----
export interface CentralBankStance {
  bank: string          // 'Fed' | 'ECB' | 'BOE' | 'BOJ'
  currency: string      // 'USD' | 'EUR' | 'GBP' | 'JPY'
  stance: 'hawkish' | 'dovish' | 'neutral'
  score: number         // -100 (very dovish) .. +100 (very hawkish)
  latestStatement: string
  nextMeeting: string | null   // ISO date
  fetchedAt: number
}

// ----- Crypto Fundamental -----
export interface CryptoFundamental {
  fearGreedIndex: number           // 0-100
  fearGreedLabel: string           // 'Extreme Fear'...'Extreme Greed'
  btcDominance: number             // percentage
  fundingRates: Record<string, number>  // 'BTCUSDT' → 0.01%
  openInterest: Record<string, number>  // 'BTCUSDT' → USD value
  fetchedAt: number
}

// ----- Combined Fundamental Score -----
export interface FundamentalScore {
  overallScore: number            // -100..100 (bearish..bullish)
  direction: 'bullish' | 'bearish' | 'neutral'
  confidence: number              // 0-100
  components: {
    calendar: number              // economic events impact
    news: number                  // news sentiment
    centralBank: number           // CB stance
    crypto: number                // crypto specific (or 0 for forex)
  }
  signalBlocked: boolean          // don't trade now
  blockedReason: string | null
  highlights: string[]            // max 3 key facts for UI
  fetchedAt: number
}

// ----- Full Fundamental Result -----
export interface FullFundamentalResult {
  calendar: CalendarResult
  news: NewsSentimentResult
  fundamentalScore: FundamentalScore
  cryptoFundamental?: CryptoFundamental   // only for crypto pairs
}

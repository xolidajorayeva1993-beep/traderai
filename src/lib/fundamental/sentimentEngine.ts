// ============================================================
// FATH AI — Keyword-Based Sentiment Engine
// (GPT API kalit shart emas — keyword scoring bilan ishlaydi)
// ============================================================

type Direction = 'bullish' | 'bearish' | 'neutral'

interface SentimentResult {
  score: number        // -100..100
  direction: Direction
  keywords: string[]
}

// Bullish keywords (en/uz mix)
const BULLISH_KEYWORDS = [
  // English
  'surge', 'rally', 'gain', 'rise', 'climb', 'strong', 'bullish', 'positive',
  'growth', 'increase', 'beat', 'better', 'improve', 'recovery', 'optimism',
  'hawkish', 'rate hike', 'buy', 'long', 'upside', 'breakout', 'support',
  'higher', 'outperform', 'upturn', 'advance', 'momentum', 'uptrend',
  'robust', 'solid', 'tight labor', 'inflation above', 'exceeded', 'upbeat',
  'stimulus', 'expansion', 'record high', 'boost',
  // Forex specific
  'dollar strength', 'fed rate', 'ecb hike', 'boe raises',
  // Crypto
  'adoption', 'institutional', 'etf approval', 'accumulation',
]

// Bearish keywords
const BEARISH_KEYWORDS = [
  // English
  'fall', 'drop', 'decline', 'crash', 'sell', 'short', 'weak', 'bearish',
  'negative', 'decrease', 'miss', 'worse', 'worsen', 'recession', 'fear',
  'dovish', 'rate cut', 'downside', 'breakdown', 'resistance', 'lower',
  'underperform', 'downturn', 'slump', 'retreat', 'concern', 'downtrend',
  'slowdown', 'contraction', 'miss expectations', 'disappointing', 'below forecast',
  'inflation below', 'layoffs', 'unemployment rise', 'deficit', 'loss',
  'debt ceiling', 'default', 'sanctions', 'conflict', 'war', 'crisis',
  // Forex specific
  'dollar weakness', 'fed pause', 'ecb cut', 'boe holds',
  // Crypto
  'hack', 'regulatory crackdown', 'ban', 'scam', 'liquidation',
]

// High-weight keywords (positive)
const STRONG_BULLISH = [
  'record high', 'all-time high', 'massive rally', 'breakthrough', 'surge',
  'exceeded expectations', 'beat forecast', 'strong gdp', 'nfp beat',
]

// High-weight keywords (negative)
const STRONG_BEARISH = [
  'crash', 'collapse', 'crisis', 'recession confirmed', 'massive sell-off',
  'missed forecast by', 'severe contraction', 'bank failure',
]

// Currency-specific sentiment modifiers
// If text says "USD stronger" for EURUSD → bearish for EUR
const CURRENCY_CORRELATION: Record<string, string[]> = {
  USD:  ['dollar', 'usd', 'federal reserve', 'fed ', 'fomc', 'nfp', 'cpi usa'],
  EUR:  ['euro', 'eur', 'ecb', 'european central', 'eurozone', 'eu gdp'],
  GBP:  ['pound', 'gbp', 'sterling', 'boe', 'bank of england', 'uk gdp', 'uk cpi'],
  JPY:  ['yen', 'jpy', 'boj', 'bank of japan', 'japan', 'tankan'],
  AUD:  ['aussie', 'aud', 'rba', 'reserve bank of australia', 'australia'],
  NZD:  ['kiwi', 'nzd', 'rbnz', 'new zealand'],
  CAD:  ['loonie', 'cad', 'boc', 'bank of canada', 'oil prices', 'canada'],
  CHF:  ['franc', 'chf', 'snb', 'swiss'],
  BTC:  ['bitcoin', 'btc', 'crypto', 'cryptocurrency', 'blockchain'],
  ETH:  ['ethereum', 'eth', 'defi', 'smart contract'],
  XAU:  ['gold', 'xau', 'safe haven', 'precious metals', 'inflation hedge'],
}

// Count keyword hits
function countHits(text: string, keywords: string[]): { count: number; found: string[] } {
  const t = text.toLowerCase()
  const found: string[] = []
  for (const kw of keywords) {
    if (t.includes(kw.toLowerCase())) found.push(kw)
  }
  return { count: found.length, found }
}

export function scoreSentiment(text: string, currencies: string[] = []): SentimentResult {
  const { count: bullCount, found: bullFound } = countHits(text, BULLISH_KEYWORDS)
  const { count: bearCount, found: bearFound } = countHits(text, BEARISH_KEYWORDS)
  const { count: strongBull } = countHits(text, STRONG_BULLISH)
  const { count: strongBear } = countHits(text, STRONG_BEARISH)

  let score = (bullCount * 10) - (bearCount * 10)
  score += (strongBull * 20) - (strongBear * 20)

  // Cap at ±100
  score = Math.max(-100, Math.min(100, score))

  const direction: Direction = score > 15 ? 'bullish' : score < -15 ? 'bearish' : 'neutral'
  const keywords = [...bullFound, ...bearFound].slice(0, 5)

  return { score, direction, keywords }
}

// Score for a specific currency in context
export function scoreCurrencySentiment(
  text: string,
  currency: string,
): SentimentResult {
  const base = scoreSentiment(text, [currency])

  // Check if text is specifically about this currency
  const correlationTerms = CURRENCY_CORRELATION[currency.toUpperCase()] ?? []
  const t = text.toLowerCase()
  const isRelevant = correlationTerms.some(term => t.includes(term))

  // If not relevant to this currency, dampen the score
  return isRelevant ? base : { ...base, score: Math.round(base.score * 0.4) }
}

// Aggregate multiple texts into one score
export function aggregateScores(scores: number[]): number {
  if (scores.length === 0) return 0
  const avg = scores.reduce((a,b) => a+b, 0) / scores.length
  return Math.round(Math.max(-100, Math.min(100, avg)))
}

// Convert score to label  
export function scoreToLabel(score: number): string {
  if (score >= 60) return 'Kuchli ijobiy'
  if (score >= 25) return 'Ijobiy'
  if (score <= -60) return 'Kuchli salbiy'
  if (score <= -25) return 'Salbiy'
  return 'Neytral'
}

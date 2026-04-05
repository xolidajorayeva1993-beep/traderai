// ============================================================
// Reddit Sentiment Adapter
// r/Forex va r/CryptoCurrency dan sentiment o'qish
// Auth talab qilmaydi — public JSON API
// ============================================================

interface RedditPost {
  title: string
  selftext: string
  score: number
  upvote_ratio: number
  created_utc: number
  url: string
}

interface RedditListing {
  data: {
    children: Array<{ data: RedditPost }>
  }
}

/** Symbol → keywords xaritalash */
const SYMBOL_KEYWORDS: Record<string, string[]> = {
  EURUSD:  ['EUR', 'EURUSD', 'euro', 'eurozone', 'ECB'],
  GBPUSD:  ['GBP', 'GBPUSD', 'pound', 'sterling', 'BOE', 'Bank of England'],
  USDJPY:  ['JPY', 'USDJPY', 'yen', 'BOJ', 'Bank of Japan'],
  XAUUSD:  ['gold', 'XAU', 'XAUUSD', 'bullion'],
  AUDUSD:  ['AUD', 'AUDUSD', 'aussie', 'RBA'],
  GBPJPY:  ['GBPJPY', 'GBP', 'JPY'],
  BTCUSDT: ['BTC', 'bitcoin', 'Bitcoin', 'BTCUSDT'],
  ETHUSDT: ['ETH', 'ethereum', 'Ethereum', 'ETHUSDT'],
}

const BULLISH_WORDS = ['bullish', 'buy', 'long', 'rise', 'rally', 'moon', 'breakout', 'up', 'higher', 'strong', 'bull']
const BEARISH_WORDS = ['bearish', 'sell', 'short', 'drop', 'fall', 'crash', 'dump', 'lower', 'weak', 'bear', 'decline']

async function fetchSubreddit(sub: string, limit = 25, sort: 'new' | 'hot' = 'hot'): Promise<RedditPost[]> {
  const url = `https://www.reddit.com/r/${sub}/${sort}.json?limit=${limit}&raw_json=1`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'FATH-AI-Trader/1.0' },
      next: { revalidate: 600 }, // 10 daqiqa cache
    })
    if (!res.ok) return []
    const json = (await res.json()) as RedditListing
    return json.data.children.map(c => c.data)
  } catch {
    return []
  }
}

function scorePost(post: RedditPost): number {
  const text = `${post.title} ${post.selftext}`.toLowerCase()
  let score = 0
  for (const w of BULLISH_WORDS) if (text.includes(w)) score += 1
  for (const w of BEARISH_WORDS) if (text.includes(w)) score -= 1
  // Upvote weight: high ratio = more consensus
  const weight = 1 + post.upvote_ratio * 0.5
  return score * weight
}

function postMatchesSymbol(post: RedditPost, symbol: string): boolean {
  const text = `${post.title} ${post.selftext}`.toLowerCase()
  const keywords = SYMBOL_KEYWORDS[symbol] ?? [symbol]
  return keywords.some(kw => text.toLowerCase().includes(kw.toLowerCase()))
}

export interface RedditSentimentResult {
  symbol: string
  score: number          // -1 to +1
  bullishCount: number
  bearishCount: number
  neutralCount: number
  totalPosts: number
  topPosts: string[]
  fetchedAt: number
}

export async function getRedditSentiment(symbol: string): Promise<RedditSentimentResult> {
  const isCrypto = ['BTCUSDT', 'ETHUSDT'].includes(symbol)
  const subs = isCrypto
    ? ['CryptoCurrency', 'Bitcoin', 'ethereum']
    : ['Forex', 'investing', 'wallstreetbets']

  const posts = (
    await Promise.all(subs.map(sub => fetchSubreddit(sub, 25, 'hot')))
  ).flat()

  const relevant = posts.filter(p => postMatchesSymbol(p, symbol))

  let bullish = 0, bearish = 0, neutral = 0, rawScore = 0
  const topTitles: string[] = []

  for (const post of relevant) {
    const s = scorePost(post)
    rawScore += s
    if (s > 0.3)       bullish++
    else if (s < -0.3) bearish++
    else                neutral++

    if (post.score > 10) topTitles.push(post.title)
  }

  const total = bullish + bearish + neutral
  const normalised = total > 0 ? Math.max(-1, Math.min(1, rawScore / total)) : 0

  return {
    symbol,
    score:        normalised,
    bullishCount: bullish,
    bearishCount: bearish,
    neutralCount: neutral,
    totalPosts:   total,
    topPosts:     topTitles.slice(0, 3),
    fetchedAt:    Date.now(),
  }
}

/** sentimentEngine.ts bilan integratsiya: Reddit natijasini raw score sifatida qaytaradi */
export function redditScoreForSymbol(result: RedditSentimentResult): { score: number; sentiment: 'bullish' | 'bearish' | 'neutral' } {
  const sentiment: 'bullish' | 'bearish' | 'neutral' =
    result.score > 0.1 ? 'bullish' : result.score < -0.1 ? 'bearish' : 'neutral'
  return { score: result.score, sentiment }
}

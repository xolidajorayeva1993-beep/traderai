// ============================================================
// FATH AI — News Feed Aggregator (RSS — no API key needed)
// ============================================================
import Parser from 'rss-parser'
import type { NewsSentimentResult, NewsItem } from './types'
import { scoreSentiment } from './sentimentEngine'

const parser = new Parser({ timeout: 8000, maxRedirects: 3 })

interface Feed { name: string; url: string; currencies: string[] }

const FEEDS: Feed[] = [
  {
    name: 'Reuters Business',
    url: 'https://feeds.reuters.com/reuters/businessNews',
    currencies: ['USD','EUR','GBP','JPY'],
  },
  {
    name: 'ForexLive',
    url: 'https://www.forexlive.com/feed/news',
    currencies: ['USD','EUR','GBP','JPY','AUD','NZD','CAD','CHF'],
  },
  {
    name: 'CoinDesk',
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    currencies: ['BTC','ETH','USD'],
  },
  {
    name: 'BBC Business',
    url: 'https://feeds.bbci.co.uk/news/business/rss.xml',
    currencies: ['USD','EUR','GBP'],
  },
  {
    name: 'CryptoPanic',
    url: `https://cryptopanic.com/api/free/v1/posts/?auth_token=${process.env.CRYPTOPANIC_API_TOKEN ?? 'free'}&currencies=BTC,ETH&kind=news&format=rss`,
    currencies: ['BTC','ETH','USD'],
  },
  {
    name: 'Investing.com Forex',
    url: 'https://www.investing.com/rss/news_25.rss',
    currencies: ['USD','EUR','GBP','JPY','AUD'],
  },
]

// Fetch one RSS feed — returns items or []
async function fetchFeed(feed: Feed): Promise<NewsItem[]> {
  try {
    const result = await parser.parseURL(feed.url)
    return (result.items || []).slice(0, 10).map((item, i) => {
      const title = item.title ?? ''
      const summary = (item.contentSnippet ?? item.summary ?? '').slice(0, 300)
      const text = `${title} ${summary}`
      const { score, direction } = scoreSentiment(text, feed.currencies)

      return {
        id: `news-${feed.name}-${i}-${Date.now()}`,
        source: feed.name,
        title,
        summary,
        url: item.link ?? '',
        publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        currencies: findMentionedCurrencies(text, feed.currencies),
        sentiment: direction,
        sentimentScore: score,
        impact: Math.abs(score) > 60 ? 'high' : Math.abs(score) > 30 ? 'medium' : 'low',
      } satisfies NewsItem
    })
  } catch {
    return []
  }
}

function findMentionedCurrencies(text: string, defaultCurrencies: string[]): string[] {
  const found: string[] = []
  const t = text.toUpperCase()
  const ALL = ['USD','EUR','GBP','JPY','AUD','NZD','CAD','CHF','BTC','ETH','XAU']
  for (const c of ALL) {
    if (t.includes(c)) found.push(c)
  }
  return found.length > 0 ? found : defaultCurrencies
}

// Aggregate sentiment per currency
function buildCurrencySentiment(items: NewsItem[]): Record<string, number> {
  const map: Record<string, number[]> = {}
  for (const item of items) {
    for (const cur of item.currencies) {
      if (!map[cur]) map[cur] = []
      map[cur].push(item.sentimentScore)
    }
  }
  const result: Record<string, number> = {}
  for (const [cur, scores] of Object.entries(map)) {
    result[cur] = Math.round(scores.reduce((a,b) => a+b, 0) / scores.length)
  }
  return result
}

// ----- Main fetch function -----
export async function fetchNewsSentiment(): Promise<NewsSentimentResult> {
  const results = await Promise.allSettled(FEEDS.map(f => fetchFeed(f)))
  const allItems: NewsItem[] = []

  for (const r of results) {
    if (r.status === 'fulfilled') allItems.push(...r.value)
  }

  // Sort by date desc
  allItems.sort((a,b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())

  const currencySentiment = buildCurrencySentiment(allItems)
  const scores = Object.values(currencySentiment)
  const avg = scores.length > 0 ? scores.reduce((a,b) => a+b,0) / scores.length : 0
  const overallSentiment = avg > 15 ? 'bullish' : avg < -15 ? 'bearish' : 'neutral'

  const topBullish = allItems
    .filter(i => i.sentiment === 'bullish')
    .sort((a,b) => b.sentimentScore - a.sentimentScore)
    .slice(0, 3)

  const topBearish = allItems
    .filter(i => i.sentiment === 'bearish')
    .sort((a,b) => a.sentimentScore - b.sentimentScore)
    .slice(0, 3)

  return {
    items: allItems.slice(0, 30),
    currencySentiment,
    overallSentiment,
    topBullish,
    topBearish,
    fetchedAt: Date.now(),
  }
}

// ----- Cache -----
let _cache: { data: NewsSentimentResult; ts: number } | null = null
const CACHE_TTL = 15 * 60 * 1000  // 15 min

export async function getNewsSentiment(): Promise<NewsSentimentResult> {
  if (_cache && Date.now() - _cache.ts < CACHE_TTL) return _cache.data
  const data = await fetchNewsSentiment()
  _cache = { data, ts: Date.now() }
  return data
}

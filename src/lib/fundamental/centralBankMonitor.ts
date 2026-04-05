// ============================================================
// Central Bank RSS Monitor
// Fed, ECB, BOE, BOJ rasmiy RSS lentalarini kuzatadi
// Bayonotlarni hawkish/dovish/neutral deb baholaydi
// ============================================================

import type { CentralBankStance } from './types'

interface BankConfig {
  name: string
  currency: string
  rssUrl: string
  hawkishWords: string[]
  dovishWords: string[]
}

const BANKS: BankConfig[] = [
  {
    name: 'Fed',
    currency: 'USD',
    rssUrl: 'https://www.federalreserve.gov/feeds/press_monetary.xml',
    hawkishWords: ['rate hike', 'tighten', 'inflation concern', 'restrict', 'increase rates', 'higher for longer'],
    dovishWords:  ['cut rates', 'rate cut', 'easing', 'stimulus', 'accommodative', 'lower rates', 'pause'],
  },
  {
    name: 'ECB',
    currency: 'EUR',
    rssUrl: 'https://www.ecb.europa.eu/rss/press.html',
    hawkishWords: ['raise rates', 'tighten', 'inflation', 'restrictive', 'deposit rate increase'],
    dovishWords:  ['cut rates', 'easing', 'stimulus', 'lower', 'accommodative', 'rate cut'],
  },
  {
    name: 'BOE',
    currency: 'GBP',
    rssUrl: 'https://www.bankofengland.co.uk/rss/publications',
    hawkishWords: ['raise bank rate', 'tighten', 'inflation overshoot', 'restrictive'],
    dovishWords:  ['cut bank rate', 'easing', 'support', 'lower rates', 'stimulus'],
  },
  {
    name: 'BOJ',
    currency: 'JPY',
    rssUrl: 'https://www.boj.or.jp/en/rss/index.xml',
    hawkishWords: ['rate hike', 'normalise', 'normalize', 'tighten', 'policy adjustment', 'exit'],
    dovishWords:  ['yield curve control', 'QE', 'easing', 'negative rate', 'accommodative', 'stimulus'],
  },
]

interface RssItem {
  title: string
  description: string
  pubDate: string
  link: string
}

async function parseRssFeed(url: string): Promise<RssItem[]> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'FATH-AI-Trader/1.0' },
      next: { revalidate: 1800 }, // 30 daqiqa cache
    })
    if (!res.ok) return []
    const text = await res.text()

    // Basic XML parsing without rss-parser library (server-safe)
    const items: RssItem[] = []
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    const matches = text.matchAll(itemRegex)

    for (const match of matches) {
      const xml = match[1]
      const title       = stripCdata(extract(xml, 'title'))
      const description = stripCdata(extract(xml, 'description'))
      const pubDate     = extract(xml, 'pubDate')
      const link        = stripCdata(extract(xml, 'link'))
      if (title) items.push({ title, description, pubDate, link })
    }

    return items.slice(0, 10)
  } catch {
    return []
  }
}

function extract(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return m ? m[1].trim() : ''
}

function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()
}

function scoreText(text: string, hawkish: string[], dovish: string[]): number {
  const lower = text.toLowerCase()
  let score = 0
  for (const w of hawkish) if (lower.includes(w)) score += 1
  for (const w of dovish)  if (lower.includes(w)) score -= 1
  return score
}

export async function getCentralBankStance(bankName?: string): Promise<CentralBankStance[]> {
  const banks = bankName
    ? BANKS.filter(b => b.name.toLowerCase() === bankName.toLowerCase())
    : BANKS

  const results = await Promise.allSettled(
    banks.map(async (bank): Promise<CentralBankStance> => {
      const items = await parseRssFeed(bank.rssUrl)

      let totalScore = 0
      const recentStatements: string[] = []

      for (const item of items) {
        const s = scoreText(`${item.title} ${item.description}`, bank.hawkishWords, bank.dovishWords)
        totalScore += s
        if (item.title) recentStatements.push(item.title)
      }

      const stance: 'hawkish' | 'dovish' | 'neutral' =
        totalScore > 0 ? 'hawkish' : totalScore < 0 ? 'dovish' : 'neutral'

      return {
        bank:            bank.name,
        currency:        bank.currency,
        stance,
        score:           Math.max(-100, Math.min(100, totalScore * 20)),
        latestStatement: recentStatements[0] ?? '',
        nextMeeting:     null,
        fetchedAt:       Date.now(),
      }
    })
  )

  return results
    .filter((r): r is PromiseFulfilledResult<CentralBankStance> => r.status === 'fulfilled')
    .map(r => r.value)
}

/** Joriy stances ni Firestore ga saqlash uchun raw data */
export async function getAllBankStances(): Promise<CentralBankStance[]> {
  return getCentralBankStance()
}

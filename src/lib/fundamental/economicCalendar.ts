// ============================================================
// FATH AI — Economic Calendar (FairEconomy / ForexFactory JSON)
// ============================================================
import type { CalendarResult, EconomicEvent, ImpactLevel } from './types'

const FF_URL_THIS_WEEK = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json'
const FF_URL_NEXT_WEEK = 'https://nfs.faireconomy.media/ff_calendar_nextweek.json'

// Raw FairEconomy JSON shape
interface FFEvent {
  title: string
  country: string
  date: string    // "04-04-2026" or ISO
  time: string    // "08:30am" or "00:00am" holiday
  impact: string  // "High" | "Medium" | "Low" | "Holiday" | "Non-Economic"
  forecast: string
  previous: string
  actual: string
}

// Map country → currency
const COUNTRY_CURRENCY: Record<string, string> = {
  USD: 'USD', EUR: 'EUR', GBP: 'GBP', JPY: 'JPY',
  AUD: 'AUD', NZD: 'NZD', CAD: 'CAD', CHF: 'CHF',
  CNY: 'CNY', ALL: 'ALL',
}

function parseDatetime(date: string, time: string): Date {
  // FairEconomy gives "04-04-2026" and "08:30am"
  try {
    // Try ISO first
    if (date.includes('T') || date.match(/^\d{4}-\d{2}-\d{2}/)) {
      const d = new Date(`${date}T${time || '00:00'}Z`)
      if (!isNaN(d.getTime())) return d
    }
    // "MM-DD-YYYY" format
    const [m, d, y] = date.split('-')
    const t = time.replace(/am$/i, ' AM').replace(/pm$/i, ' PM')
    return new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T${convertTime12(t)}:00Z`)
  } catch {
    return new Date()
  }
}

function convertTime12(t: string): string {
  // "08:30am" → "08:30" or "01:30pm" → "13:30"
  const cleaned = t.trim().toLowerCase()
  const pm = cleaned.endsWith('pm')
  const am = cleaned.endsWith('am')
  const base = cleaned.replace(/[ap]m/,'').trim()
  if (!pm && !am) return base.padStart(5,'0')
  const [hh, mm] = base.split(':')
  let h = parseInt(hh)
  if (pm && h < 12) h += 12
  if (am && h === 12) h = 0
  return `${String(h).padStart(2,'0')}:${(mm||'00').padStart(2,'00')}`
}

function calcSurprise(actual: string, forecast: string): number | null {
  const a = parseFloat(actual.replace(/[%KMBk]/g,''))
  const f = parseFloat(forecast.replace(/[%KMBk]/g,''))
  if (isNaN(a) || isNaN(f) || f === 0) return null
  return Math.round(((a - f) / Math.abs(f)) * 100)
}

function mapEvent(raw: FFEvent, idx: number): EconomicEvent {
  const dt = parseDatetime(raw.date, raw.time)
  const now = Date.now()
  const impact = (['High','Medium','Low','Holiday'] as ImpactLevel[])
    .includes(raw.impact as ImpactLevel) ? raw.impact as ImpactLevel : 'Low'
  return {
    id: `ff-${idx}-${raw.country}-${raw.title.slice(0,8)}`,
    title: raw.title,
    country: raw.country,
    currency: COUNTRY_CURRENCY[raw.country] ?? raw.country,
    date: dt.toISOString().slice(0,10),
    time: dt.toISOString().slice(11,16),
    impact,
    forecast: raw.forecast || null,
    previous: raw.previous || null,
    actual: raw.actual || null,
    surprise: raw.actual ? calcSurprise(raw.actual, raw.forecast) : null,
    isUpcoming: dt.getTime() > now,
  }
}

// Sentiment from calendar events
function calcCurrencySentiment(events: EconomicEvent[]): Record<string, number> {
  const scores: Record<string, number[]> = {}

  for (const e of events) {
    if (!e.actual || e.isUpcoming) continue
    if (!e.surprise) continue
    const w = e.impact === 'High' ? 1.0 : e.impact === 'Medium' ? 0.5 : 0.2
    const s = Math.max(-100, Math.min(100, e.surprise * w))
    if (!scores[e.currency]) scores[e.currency] = []
    scores[e.currency].push(s)
  }

  const result: Record<string, number> = {}
  for (const [cur, arr] of Object.entries(scores)) {
    result[cur] = Math.round(arr.reduce((a,b) => a+b, 0) / arr.length)
  }
  return result
}

// ----- Main fetch function -----
export async function fetchEconomicCalendar(): Promise<CalendarResult> {
  const now = Date.now()
  let events: EconomicEvent[] = []

  try {
    const [thisRes, nextRes] = await Promise.allSettled([
      fetch(FF_URL_THIS_WEEK, { next: { revalidate: 3600 } }),
      fetch(FF_URL_NEXT_WEEK, { next: { revalidate: 3600 } }),
    ])

    const raw: FFEvent[] = []
    if (thisRes.status === 'fulfilled' && thisRes.value.ok) {
      const d = await thisRes.value.json() as FFEvent[]
      raw.push(...(Array.isArray(d) ? d : []))
    }
    if (nextRes.status === 'fulfilled' && nextRes.value.ok) {
      const d = await nextRes.value.json() as FFEvent[]
      raw.push(...(Array.isArray(d) ? d : []))
    }

    events = raw
      .filter(e => e.impact === 'High' || e.impact === 'Medium' || e.impact === 'Low')
      .map((e, i) => mapEvent(e, i))
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  } catch {
    events = []
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const highImpactToday = events.filter(
    e => e.date === todayStr && e.impact === 'High'
  )

  const in4h = now + 4 * 60 * 60 * 1000
  const upcomingHigh = events.filter(
    e => e.impact === 'High' && e.isUpcoming &&
         new Date(`${e.date}T${e.time}:00Z`).getTime() <= in4h
  )

  // Block signal 30 min before/after High Impact
  const in30m = now + 30 * 60 * 1000
  const blockingEvent = events.find(e => {
    if (e.impact !== 'High') return false
    const t = new Date(`${e.date}T${e.time}:00Z`).getTime()
    return (t > now && t < in30m) || (t < now && now - t < 30 * 60 * 1000)
  })

  return {
    events,
    highImpactToday,
    upcomingHigh,
    signalBlocked: !!blockingEvent,
    blockedReason: blockingEvent
      ? `${blockingEvent.title} (${blockingEvent.currency}) — ${blockingEvent.time} UTC`
      : null,
    sentiment: calcCurrencySentiment(events),
    fetchedAt: now,
  }
}

// ----- Cache wrapper -----
let _cache: { data: CalendarResult; ts: number } | null = null
const CACHE_TTL = 30 * 60 * 1000  // 30 min

export async function getEconomicCalendar(): Promise<CalendarResult> {
  if (_cache && Date.now() - _cache.ts < CACHE_TTL) return _cache.data
  const data = await fetchEconomicCalendar()
  _cache = { data, ts: Date.now() }
  return data
}

// Helper: events for a specific currency pair
export function getEventsForPair(calendar: CalendarResult, symbol: string): EconomicEvent[] {
  const currencies = extractCurrencies(symbol)
  return calendar.events.filter(
    e => currencies.includes(e.currency) && (e.impact === 'High' || e.impact === 'Medium')
  )
}

export function extractCurrencies(symbol: string): string[] {
  const s = symbol.toUpperCase()
  // Common crypto
  if (s.includes('BTC') || s.includes('ETH') || s.endsWith('USDT')) return ['USD']
  if (s.includes('XAU')) return ['USD']
  // Forex pair: EURUSD → ['EUR','USD']
  if (s.length >= 6) return [s.slice(0,3), s.slice(3,6)]
  return []
}

// ============================================================
// FATH AI — Crypto Fundamental Data
// (Binance public API + Alternative.me — no API key needed)
// ============================================================
import type { CryptoFundamental } from './types'

// ----- Fear & Greed Index -----
async function fetchFearGreed(): Promise<{ value: number; label: string }> {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1', {
      next: { revalidate: 3600 },
    })
    const data = await res.json() as {
      data: Array<{ value: string; value_classification: string }>
    }
    const item = data.data?.[0]
    return {
      value: parseInt(item?.value ?? '50'),
      label: item?.value_classification ?? 'Neutral',
    }
  } catch {
    return { value: 50, label: 'Neutral' }
  }
}

// ----- BTC Dominance (CoinGecko) -----
async function fetchBtcDominance(): Promise<number> {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/global', {
      next: { revalidate: 3600 },
    })
    const data = await res.json() as {
      data: { market_cap_percentage: { btc: number } }
    }
    return Math.round((data.data?.market_cap_percentage?.btc ?? 50) * 100) / 100
  } catch {
    return 50
  }
}

// ----- Funding Rates (Binance Futures) -----
async function fetchFundingRates(symbols: string[]): Promise<Record<string, number>> {
  const rates: Record<string, number> = {}
  try {
    // Batch fetch
    const syms = symbols.filter(s => s.endsWith('USDT') || s.endsWith('BUSD'))
    if (syms.length === 0) return rates

    const res = await fetch(
      `https://fapi.binance.com/fapi/v1/fundingRate?limit=1`,
      { next: { revalidate: 1800 } }
    )
    if (!res.ok) return rates
    const allRates = await res.json() as Array<{ symbol: string; fundingRate: string }>

    for (const sym of syms) {
      const found = allRates.find(r => r.symbol === sym)
      if (found) rates[sym] = parseFloat(found.fundingRate) * 100
    }
  } catch {
    // silent fail
  }
  return rates
}

// ----- Open Interest (Binance Futures) -----
async function fetchOpenInterest(symbol: string): Promise<number> {
  try {
    const sym = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`
    const res = await fetch(
      `https://fapi.binance.com/fapi/v1/openInterest?symbol=${sym}`,
      { next: { revalidate: 1800 } }
    )
    if (!res.ok) return 0
    const data = await res.json() as { openInterest: string }
    return parseFloat(data.openInterest ?? '0')
  } catch {
    return 0
  }
}

// ----- Main fetch -----
export async function fetchCryptoFundamental(
  symbols: string[] = ['BTCUSDT', 'ETHUSDT']
): Promise<CryptoFundamental> {
  const [fearGreed, btcDom, fundingRates] = await Promise.allSettled([
    fetchFearGreed(),
    fetchBtcDominance(),
    fetchFundingRates(symbols),
  ])

  const fg = fearGreed.status === 'fulfilled' ? fearGreed.value : { value: 50, label: 'Neutral' }
  const dom = btcDom.status === 'fulfilled' ? btcDom.value : 50
  const rates = fundingRates.status === 'fulfilled' ? fundingRates.value : {}

  // Open interest for primary symbols
  const oiResults = await Promise.allSettled(
    symbols.slice(0, 3).map(s => fetchOpenInterest(s).then(v => ({ sym: s, v })))
  )
  const openInterest: Record<string, number> = {}
  for (const r of oiResults) {
    if (r.status === 'fulfilled') openInterest[r.value.sym] = r.value.v
  }

  return {
    fearGreedIndex: fg.value,
    fearGreedLabel: fg.label,
    btcDominance: dom,
    fundingRates: rates,
    openInterest,
    fetchedAt: Date.now(),
  }
}

// ----- Cache -----
let _cache: { data: CryptoFundamental; ts: number } | null = null
const CACHE_TTL = 30 * 60 * 1000

export async function getCryptoFundamental(symbols?: string[]): Promise<CryptoFundamental> {
  if (_cache && Date.now() - _cache.ts < CACHE_TTL) return _cache.data
  const data = await fetchCryptoFundamental(symbols)
  _cache = { data, ts: Date.now() }
  return data
}

// Interpret fear-greed for trading
export function interpretFearGreed(value: number): { signal: 'bullish' | 'bearish' | 'neutral'; note: string } {
  if (value <= 20) return { signal: 'bullish', note: 'Extreme Fear — potensial dip buying imkoniyati' }
  if (value <= 40) return { signal: 'bullish', note: 'Fear — investorlar ehtiyotkor, sotilyapti' }
  if (value <= 60) return { signal: 'neutral', note: 'Neutral — bozor muvozanatda' }
  if (value <= 80) return { signal: 'bearish', note: 'Greed — bozor qizib ketyapti, ehtiyot bo\'ling' }
  return { signal: 'bearish', note: 'Extreme Greed — to\'satdan tushish xavfi yuqori' }
}

// Funding rate interpretation
export function interpretFundingRate(rate: number): 'bullish' | 'bearish' | 'neutral' {
  if (rate > 0.05) return 'bearish'  // ko'p long, chiqim yuqori
  if (rate < -0.05) return 'bullish' // ko'p short, squeeze ehtimoli
  return 'neutral'
}

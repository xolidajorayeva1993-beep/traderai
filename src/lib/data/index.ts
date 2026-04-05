// ============================================================
// Market data providers — singleton instances
// ============================================================
import { FailoverDataProvider } from './DataProvider';
import { YahooFinanceAdapter } from './YahooFinanceAdapter';
import { TwelveDataAdapter } from './TwelveDataAdapter';
import { AlphaVantageAdapter } from './AlphaVantageAdapter';
import { BinanceAdapter } from './BinanceAdapter';
import { CoinGeckoAdapter } from './CoinGeckoAdapter';

// Forex: Yahoo first → TwelveData → AlphaVantage
export const forexProvider = new FailoverDataProvider([
  new YahooFinanceAdapter(),
  new TwelveDataAdapter(),
  new AlphaVantageAdapter(),
]);

// Crypto: Binance first → CoinGecko fallback
export const cryptoProvider = new FailoverDataProvider([
  new BinanceAdapter(),
  new CoinGeckoAdapter(),
]);

// ─── Client-side helpers (browser → API route) ───────────────
export async function getForexOHLCV(symbol: string, timeframe: string, limit: number) {
  const res = await fetch(
    `/api/market/forex?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&limit=${limit}`
  );
  if (!res.ok) throw new Error(`Forex data fetch failed: ${res.status}`);
  return res.json();
}

export async function getForexPrice(symbol: string) {
  const res = await fetch(`/api/market/forex/price?symbol=${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error(`Forex price fetch failed: ${res.status}`);
  return res.json();
}

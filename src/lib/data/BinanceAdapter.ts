// ============================================================
// Binance Public REST Adapter (no auth required)
// ============================================================
import type { OHLCVCandle, LivePrice } from '@/types';
import type { DataProvider } from './DataProvider';

const BASE_URL = 'https://api.binance.com/api/v3';

const TIMEFRAME_MAP: Record<string, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '4h': '4h',
  '1d': '1d',
  '1w': '1w',
};

export class BinanceAdapter implements DataProvider {
  name = 'binance';

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/time`, { cache: 'no-store' });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getOHLCV(symbol: string, timeframe: string, limit: number): Promise<OHLCVCandle[]> {
    const interval = TIMEFRAME_MAP[timeframe] ?? '1h';
    const binanceSymbol = symbol.replace('/', '').toUpperCase();

    const url = `${BASE_URL}/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`;
    const res = await fetch(url, { cache: 'no-store' });

    if (!res.ok) throw new Error(`Binance API error: ${res.status}`);

    const raw: unknown[][] = await res.json();
    return raw.map((k) => ({
      timestamp: Number(k[0]),
      open: parseFloat(String(k[1])),
      high: parseFloat(String(k[2])),
      low: parseFloat(String(k[3])),
      close: parseFloat(String(k[4])),
      volume: parseFloat(String(k[5])),
    }));
  }

  async getPrice(symbol: string): Promise<LivePrice> {
    const binanceSymbol = symbol.replace('/', '').toUpperCase();
    const [tickerRes, bookRes] = await Promise.all([
      fetch(`${BASE_URL}/ticker/24hr?symbol=${binanceSymbol}`, { cache: 'no-store' }),
      fetch(`${BASE_URL}/ticker/bookTicker?symbol=${binanceSymbol}`, { cache: 'no-store' }),
    ]);

    if (!tickerRes.ok || !bookRes.ok) throw new Error(`Binance price error for ${symbol}`);

    const ticker = await tickerRes.json();
    const book = await bookRes.json();

    return {
      symbol,
      bid: parseFloat(book.bidPrice),
      ask: parseFloat(book.askPrice),
      price: parseFloat(ticker.lastPrice),
      change: parseFloat(ticker.priceChange),
      changePercent: parseFloat(ticker.priceChangePercent),
      volume: parseFloat(ticker.volume),
      updatedAt: Date.now(),
    };
  }
}

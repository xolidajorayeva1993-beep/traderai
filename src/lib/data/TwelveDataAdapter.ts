// ============================================================
// Twelve Data Adapter — Forex OHLCV + Real-time (free tier)
// Free: 800 req/day, 8 req/min
// Env: TWELVE_DATA_API_KEY
// ============================================================
import type { OHLCVCandle, LivePrice } from '@/types';
import type { DataProvider } from './DataProvider';

const BASE_URL = 'https://api.twelvedata.com';

const TIMEFRAME_MAP: Record<string, string> = {
  '1m':  '1min',
  '5m':  '5min',
  '15m': '15min',
  '30m': '30min',
  '1h':  '1h',
  '4h':  '4h',
  '1d':  '1day',
  '1w':  '1week',
};

// Twelve Data symbol mapping
const SYMBOL_MAP: Record<string, string> = {
  EURUSD: 'EUR/USD',
  GBPUSD: 'GBP/USD',
  USDJPY: 'USD/JPY',
  USDCHF: 'USD/CHF',
  AUDUSD: 'AUD/USD',
  USDCAD: 'USD/CAD',
  NZDUSD: 'NZD/USD',
  EURGBP: 'EUR/GBP',
  EURJPY: 'EUR/JPY',
  GBPJPY: 'GBP/JPY',
  XAUUSD: 'XAU/USD',
  XAGUSD: 'XAG/USD',
  USOIL:  'USO',
  BTCUSDT:'BTC/USDT',
  ETHUSDT:'ETH/USDT',
};

export class TwelveDataAdapter implements DataProvider {
  name = 'twelve-data';

  private get apiKey(): string {
    return process.env.TWELVE_DATA_API_KEY ?? '';
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const res = await fetch(`${BASE_URL}/api_usage?apikey=${this.apiKey}`, {
        cache: 'no-store',
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getOHLCV(symbol: string, timeframe: string, limit: number): Promise<OHLCVCandle[]> {
    if (!this.apiKey) throw new Error('TWELVE_DATA_API_KEY not set');

    const tdSymbol   = SYMBOL_MAP[symbol.toUpperCase()] ?? symbol;
    const tdInterval = TIMEFRAME_MAP[timeframe] ?? '1h';

    const url = `${BASE_URL}/time_series?symbol=${encodeURIComponent(tdSymbol)}&interval=${tdInterval}&outputsize=${limit}&apikey=${this.apiKey}&timezone=UTC&format=JSON`;
    const res = await fetch(url, { cache: 'no-store' });

    if (res.status === 429) throw new Error('Twelve Data rate limit (429)');
    if (!res.ok) throw new Error(`Twelve Data API error: ${res.status}`);

    const json = await res.json() as {
      status?: string;
      code?: number;
      values?: Array<{ datetime: string; open: string; high: string; low: string; close: string; volume: string }>;
    };

    if (json.code === 429) throw new Error('Twelve Data rate limit');
    if (json.status === 'error' || !json.values) {
      throw new Error(`Twelve Data: no data for ${symbol}`);
    }

    // Data comes newest-first — reverse for chronological order
    return json.values.reverse().map((v) => ({
      timestamp: new Date(v.datetime).getTime(),
      open:   parseFloat(v.open),
      high:   parseFloat(v.high),
      low:    parseFloat(v.low),
      close:  parseFloat(v.close),
      volume: parseFloat(v.volume ?? '0'),
    }));
  }

  async getPrice(symbol: string): Promise<LivePrice> {
    if (!this.apiKey) throw new Error('TWELVE_DATA_API_KEY not set');

    const tdSymbol = SYMBOL_MAP[symbol.toUpperCase()] ?? symbol;
    const url = `${BASE_URL}/quote?symbol=${encodeURIComponent(tdSymbol)}&apikey=${this.apiKey}&format=JSON`;
    const res = await fetch(url, { cache: 'no-store' });

    if (res.status === 429) throw new Error('Twelve Data rate limit (429)');
    if (!res.ok) throw new Error(`Twelve Data quote error: ${res.status}`);

    const json = await res.json() as {
      code?: number;
      close?: string;
      open?: string;
      change?: string;
      percent_change?: string;
      volume?: string;
    };

    if (json.code === 429) throw new Error('Twelve Data rate limit');
    if (!json.close) throw new Error(`Twelve Data: no quote for ${symbol}`);

    const price  = parseFloat(json.close);
    const change = parseFloat(json.change ?? '0');

    return {
      symbol,
      bid:           price - 0.00001,
      ask:           price + 0.00001,
      price,
      change,
      changePercent: parseFloat(json.percent_change ?? '0'),
      volume:        parseFloat(json.volume ?? '0'),
      updatedAt:     Date.now(),
    };
  }
}

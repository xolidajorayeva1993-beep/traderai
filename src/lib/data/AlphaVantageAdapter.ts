// ============================================================
// Alpha Vantage Adapter — Forex OHLCV (free: 25 req/day)
// Env: ALPHA_VANTAGE_API_KEY
// ============================================================
import type { OHLCVCandle, LivePrice } from '@/types';
import type { DataProvider } from './DataProvider';

const BASE_URL = 'https://www.alphavantage.co/query';

// Alpha Vantage forex symbols (FROM currency / TO currency)
const SYMBOL_PARTS: Record<string, [string, string]> = {
  EURUSD: ['EUR', 'USD'],
  GBPUSD: ['GBP', 'USD'],
  USDJPY: ['USD', 'JPY'],
  USDCHF: ['USD', 'CHF'],
  AUDUSD: ['AUD', 'USD'],
  USDCAD: ['USD', 'CAD'],
  NZDUSD: ['NZD', 'USD'],
  EURGBP: ['EUR', 'GBP'],
  EURJPY: ['EUR', 'JPY'],
  GBPJPY: ['GBP', 'JPY'],
  XAUUSD: ['XAU', 'USD'],
  XAGUSD: ['XAG', 'USD'],
};

// Alpha Vantage function names per timeframe
const FUNCTION_MAP: Record<string, string> = {
  '1m':  'FX_INTRADAY',
  '5m':  'FX_INTRADAY',
  '15m': 'FX_INTRADAY',
  '30m': 'FX_INTRADAY',
  '1h':  'FX_INTRADAY',
  '4h':  'FX_INTRADAY',
  '1d':  'FX_DAILY',
  '1w':  'FX_WEEKLY',
};

const INTERVAL_PARAM: Record<string, string> = {
  '1m':  '1min',
  '5m':  '5min',
  '15m': '15min',
  '30m': '30min',
  '1h':  '60min',
  '4h':  '60min', // Resample from 1h
};

export class AlphaVantageAdapter implements DataProvider {
  name = 'alpha-vantage';

  private get apiKey(): string {
    return process.env.ALPHA_VANTAGE_API_KEY ?? '';
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async getOHLCV(symbol: string, timeframe: string, limit: number): Promise<OHLCVCandle[]> {
    if (!this.apiKey) throw new Error('ALPHA_VANTAGE_API_KEY not set');

    const parts = SYMBOL_PARTS[symbol.toUpperCase()];
    if (!parts) throw new Error(`Alpha Vantage: unsupported symbol ${symbol}`);

    const [from_symbol, to_symbol] = parts;
    const func = FUNCTION_MAP[timeframe] ?? 'FX_DAILY';
    const intervalParam = INTERVAL_PARAM[timeframe];

    let url = `${BASE_URL}?function=${func}&from_symbol=${from_symbol}&to_symbol=${to_symbol}&apikey=${this.apiKey}&datatype=json&outputsize=full`;
    if (intervalParam) url += `&interval=${intervalParam}`;

    const res = await fetch(url, { cache: 'no-store' });
    if (res.status === 429) throw new Error('Alpha Vantage rate limit (429)');
    if (!res.ok) throw new Error(`Alpha Vantage error: ${res.status}`);

    const json = await res.json() as Record<string, unknown>;

    // Detect rate limit note in response
    if (json['Note'] || json['Information']) {
      throw new Error('Alpha Vantage rate limit reached');
    }

    // Find the time series key
    const timeKey = Object.keys(json).find((k) => k.startsWith('Time Series'));
    if (!timeKey) throw new Error(`Alpha Vantage: no data for ${symbol}`);

    const rawSeries = json[timeKey] as Record<string, Record<string, string>>;
    const entries = Object.entries(rawSeries)
      .map(([date, v]) => ({
        timestamp: new Date(date).getTime(),
        open:   parseFloat(v['1. open']),
        high:   parseFloat(v['2. high']),
        low:    parseFloat(v['3. low']),
        close:  parseFloat(v['4. close']),
        volume: parseFloat(v['5. volume'] ?? '0'),
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    // Resample 1h → 4h if needed
    if (timeframe === '4h') {
      return resample4h(entries).slice(-limit);
    }

    return entries.slice(-limit);
  }

  async getPrice(symbol: string): Promise<LivePrice> {
    if (!this.apiKey) throw new Error('ALPHA_VANTAGE_API_KEY not set');

    const parts = SYMBOL_PARTS[symbol.toUpperCase()];
    if (!parts) throw new Error(`Alpha Vantage: unsupported symbol ${symbol}`);

    const [from_currency, to_currency] = parts;
    const url = `${BASE_URL}?function=CURRENCY_EXCHANGE_RATE&from_currency=${from_currency}&to_currency=${to_currency}&apikey=${this.apiKey}`;

    const res = await fetch(url, { cache: 'no-store' });
    if (res.status === 429) throw new Error('Alpha Vantage rate limit (429)');
    if (!res.ok) throw new Error(`Alpha Vantage exchange rate error: ${res.status}`);

    const json = await res.json() as Record<string, unknown>;
    if (json['Note'] || json['Information']) throw new Error('Alpha Vantage rate limit reached');

    const rate = (json['Realtime Currency Exchange Rate'] ?? {}) as Record<string, string>;
    const price = parseFloat(rate['5. Exchange Rate'] ?? '0');
    if (!price) throw new Error(`Alpha Vantage: no rate for ${symbol}`);

    const bid = parseFloat(rate['8. Bid Price'] ?? String(price));
    const ask = parseFloat(rate['9. Ask Price'] ?? String(price));

    return {
      symbol,
      bid,
      ask,
      price,
      change:        0,
      changePercent: 0,
      volume:        0,
      updatedAt:     Date.now(),
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────
function resample4h(candles: OHLCVCandle[]): OHLCVCandle[] {
  const result: OHLCVCandle[] = [];
  let i = 0;
  while (i < candles.length) {
    const group = candles.slice(i, i + 4);
    result.push({
      timestamp: group[0].timestamp,
      open:   group[0].open,
      high:   Math.max(...group.map((c) => c.high)),
      low:    Math.min(...group.map((c) => c.low)),
      close:  group[group.length - 1].close,
      volume: group.reduce((s, c) => s + c.volume, 0),
    });
    i += 4;
  }
  return result;
}

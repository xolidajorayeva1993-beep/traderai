// ============================================================
// Yahoo Finance Adapter — Forex OHLCV (server-side only)
// ============================================================
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — yahoo-finance2 v3: default export is the YahooFinance class
import YFClass from 'yahoo-finance2';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yahooFinance: any = new (YFClass as any)();
import type { OHLCVCandle, LivePrice } from '@/types';
import type { DataProvider } from './DataProvider';

// Yahoo Finance symbol mapping
export const YAHOO_SYMBOL_MAP: Record<string, string> = {
  // Forex majors
  EURUSD: 'EURUSD=X',
  GBPUSD: 'GBPUSD=X',
  USDJPY: 'JPY=X',
  USDCHF: 'CHF=X',
  AUDUSD: 'AUDUSD=X',
  USDCAD: 'CAD=X',
  NZDUSD: 'NZDUSD=X',
  // Forex crosses
  EURGBP: 'EURGBP=X',
  EURJPY: 'EURJPY=X',
  GBPJPY: 'GBPJPY=X',
  // Commodities
  XAUUSD: 'GC=F',   // Gold
  XAGUSD: 'SI=F',   // Silver
  USOIL:  'CL=F',   // Crude Oil
  // Indices
  US30:   'YM=F',   // Dow Jones
  SPX500: 'ES=F',   // S&P 500
  NAS100: 'NQ=F',   // NASDAQ
  // Crypto (basic)
  BTCUSD: 'BTC-USD',
  ETHUSD: 'ETH-USD',
  BNBUSD: 'BNB-USD',
};

// Yahoo Finance interval mapping
const INTERVAL_MAP: Record<string, string> = {
  '1m':  '1m',
  '5m':  '5m',
  '15m': '15m',
  '30m': '30m',
  '1h':  '1h',
  '4h':  '4h', // Yahoo doesn't support 4h natively — use 1h and resample
  '1d':  '1d',
  '1w':  '1wk',
  '1M':  '1mo',
};

export class YahooFinanceAdapter implements DataProvider {
  name = 'yahoo-finance';

  async isAvailable(): Promise<boolean> {
    try {
      await yahooFinance.quote('EURUSD=X');
      return true;
    } catch {
      return false;
    }
  }

  async getOHLCV(symbol: string, timeframe: string, limit: number): Promise<OHLCVCandle[]> {
    const yahooSymbol = YAHOO_SYMBOL_MAP[symbol.toUpperCase()] ?? symbol;
    const interval = INTERVAL_MAP[timeframe] ?? '1h';

    // 4h: fetch 1h and resample
    const fetchInterval = timeframe === '4h' ? '1h' : interval;
    const fetchLimit    = timeframe === '4h' ? limit * 4 : limit;

    // Intraday (≤1h): multiply lookback by 4 to cover weekends + market-closed gaps.
    // e.g. 200 × 15min × 4 = 50h × 4 = 200h ≈ 8 calendar days → always enough candles.
    const gapMultiplier = ['1m', '5m', '15m', '30m', '1h'].includes(fetchInterval) ? 4 : 1;
    const period1 = new Date(Date.now() - fetchLimit * intervalToMs(fetchInterval) * gapMultiplier);
    const period1Str = period1.toISOString().split('T')[0];

    const result = await yahooFinance.chart(yahooSymbol, {
      period1: period1Str,
      interval: fetchInterval,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quotes: any[] = result?.quotes ?? [];
    const candles: OHLCVCandle[] = quotes
      .filter((q) => q.open != null && q.close != null)
      .map((q) => ({
        timestamp: new Date(q.date).getTime(),
        open:   Number(q.open)   || 0,
        high:   Number(q.high)   || 0,
        low:    Number(q.low)    || 0,
        close:  Number(q.close)  || 0,
        volume: Number(q.volume) || 0,
      }));

    // Resample to 4h if needed
    if (timeframe === '4h') return resampleTo4H(candles).slice(-limit);

    return candles.slice(-limit);
  }

  async getPrice(symbol: string): Promise<LivePrice> {
    const yahooSymbol = YAHOO_SYMBOL_MAP[symbol.toUpperCase()] ?? symbol;
    const result = await yahooFinance.quote(yahooSymbol);

    return {
      symbol,
      bid:           Number(result?.bid)                       || Number(result?.regularMarketPrice) || 0,
      ask:           Number(result?.ask)                       || Number(result?.regularMarketPrice) || 0,
      price:         Number(result?.regularMarketPrice)        || 0,
      change:        Number(result?.regularMarketChange)       || 0,
      changePercent: Number(result?.regularMarketChangePercent)|| 0,
      volume:        Number(result?.regularMarketVolume)       || 0,
      updatedAt:     Date.now(),
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────
function intervalToMs(interval: string): number {
  const map: Record<string, number> = {
    '1m':  60_000,
    '5m':  300_000,
    '15m': 900_000,
    '30m': 1_800_000,
    '1h':  3_600_000,
    '1d':  86_400_000,
    '1wk': 604_800_000,
    '1mo': 2_592_000_000,
  };
  return map[interval] ?? 3_600_000;
}

function resampleTo4H(candles: OHLCVCandle[]): OHLCVCandle[] {
  const result: OHLCVCandle[] = [];
  for (let i = 0; i + 3 < candles.length; i += 4) {
    const chunk = candles.slice(i, i + 4);
    result.push({
      timestamp: chunk[0].timestamp,
      open:   chunk[0].open,
      high:   Math.max(...chunk.map((c) => c.high)),
      low:    Math.min(...chunk.map((c) => c.low)),
      close:  chunk[3].close,
      volume: chunk.reduce((s, c) => s + c.volume, 0),
    });
  }
  return result;
}

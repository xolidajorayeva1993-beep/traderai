// ============================================================
// Yahoo Finance Adapter — Forex OHLCV (server-side only)
// Direct HTTP fetch — no library caching, cache: 'no-store'
//
// MUHIM FARQ:
//   OHLCV_MAP  — tarixiy 1h/4h ma'lumot uchun (futures = ko'p vaqt oralig'i bor)
//   PRICE_MAP  — joriy narx uchun (spot OTC = rollover muammosiz)
// GC=F (gold futures) 1h OHLCV → teknik tahlil uchun yetarli
// XAUUSD=X (spot OTC) live narx uchun ishlatiladi
// ============================================================
import type { OHLCVCandle, LivePrice } from '@/types';
import type { DataProvider } from './DataProvider';

// OHLCV uchun Yahoo symbol — intraday (1h/4h) qoplaydigan symbollar
export const YAHOO_OHLCV_MAP: Record<string, string> = {
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
  // Commodities — OHLCV uchun FUTURES (1h historical bor)
  // Spot (XAUUSD=X) Yahoo da 1h intraday data bermaydi
  XAUUSD: 'GC=F',    // Gold Futures — 1h historical OHLCV mavjud
  XAGUSD: 'SI=F',    // Silver Futures — 1h historical OHLCV mavjud
  USOIL:  'CL=F',    // Crude Oil Futures
  // Indices
  US30:   'YM=F',
  SPX500: 'ES=F',
  NAS100: 'NQ=F',
  // Crypto (basic)
  BTCUSD: 'BTC-USD',
  ETHUSD: 'ETH-USD',
  BNBUSD: 'BNB-USD',
};

// Live narx uchun Yahoo symbol — spot OTC (rollover muammosiz, joriy narx aniq)
export const YAHOO_PRICE_MAP: Record<string, string> = {
  ...YAHOO_OHLCV_MAP,
  // Override: metals live narx uchun spot OTC ishlatamiz
  XAUUSD: 'XAUUSD=X', // Gold spot OTC — live narx uchun
  XAGUSD: 'XAGUSD=X', // Silver spot OTC — live narx uchun
};

// Eski nom — orqaga moslik uchun saqlaymiz
export const YAHOO_SYMBOL_MAP = YAHOO_OHLCV_MAP;

// Yahoo Finance interval mapping
const INTERVAL_MAP: Record<string, string> = {
  '1m':  '1m',
  '5m':  '5m',
  '15m': '15m',
  '30m': '30m',
  '1h':  '1h',
  '4h':  '1h', // resample 1h → 4h
  '1d':  '1d',
  '1w':  '1wk',
  '1M':  '1mo',
};

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
};

// Direct YouTube Finance chart call (no library cache)
async function yahooChart(
  yahooSymbol: string,
  interval: string,
  period1: number,
  period2: number,
): Promise<{ timestamp: number[]; quote: { open: number[]; high: number[]; low: number[]; close: number[] } } | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}` +
    `?interval=${interval}&period1=${period1}&period2=${period2}`
  try {
    const res = await fetch(url, {
      headers: YF_HEADERS,
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const data = await res.json() as {
      chart: { result?: Array<{
        timestamp: number[]
        indicators: { quote: Array<{ open: number[]; high: number[]; low: number[]; close: number[] }> }
      }> }
    }
    const result = data.chart.result?.[0]
    if (!result?.timestamp?.length) return null
    return { timestamp: result.timestamp, quote: result.indicators.quote[0] }
  } catch { return null }
}

export class YahooFinanceAdapter implements DataProvider {
  name = 'yahoo-finance';

  async isAvailable(): Promise<boolean> {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/EURUSD=X?interval=1d&range=1d`
      const res = await fetch(url, { headers: YF_HEADERS, cache: 'no-store', signal: AbortSignal.timeout(5000) })
      return res.ok
    } catch {
      return false;
    }
  }

  async getOHLCV(symbol: string, timeframe: string, limit: number): Promise<OHLCVCandle[]> {
    // OHLCV uchun futures symbol → 1h intraday tarixi mavjud
    const yahooSymbol = YAHOO_OHLCV_MAP[symbol.toUpperCase()] ?? (symbol + '=X');
    const fetchInterval = timeframe === '4h' ? '1h' : (INTERVAL_MAP[timeframe] ?? '1h');
    const fetchLimit    = timeframe === '4h' ? limit * 4 : limit;
    const gapMultiplier = ['1m', '5m', '15m', '30m', '1h'].includes(fetchInterval) ? 4 : 1;
    const period1Ms = Date.now() - fetchLimit * intervalToMs(fetchInterval) * gapMultiplier;
    const period1   = Math.floor(period1Ms / 1000);
    const period2   = Math.floor(Date.now() / 1000);

    const raw = await yahooChart(yahooSymbol, fetchInterval, period1, period2);
    if (!raw) throw new Error(`Yahoo Finance: no OHLCV data for ${symbol}`);

    const candles: OHLCVCandle[] = raw.timestamp
      .map((t, i) => ({
        timestamp: t * 1000,
        open:   raw.quote.open[i]  ?? 0,
        high:   raw.quote.high[i]  ?? 0,
        low:    raw.quote.low[i]   ?? 0,
        close:  raw.quote.close[i] ?? 0,
        volume: 0,
      }))
      .filter(c => isFinite(c.open) && isFinite(c.close) && c.open > 0 && c.close > 0);

    if (candles.length === 0) throw new Error(`Yahoo Finance: empty candles for ${symbol}`);
    if (timeframe === '4h') return resampleTo4H(candles).slice(-limit);
    return candles.slice(-limit);
  }

  async getPrice(symbol: string): Promise<LivePrice> {
    // Narx uchun spot symbol → rollover muammosiz aniq narx
    const yahooSymbol = YAHOO_PRICE_MAP[symbol.toUpperCase()] ?? (symbol + '=X');
    // Use chart endpoint for real-time price — always cache-free
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}` +
      `?interval=1d&range=1d`
    const res = await fetch(url, {
      headers: YF_HEADERS,
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new Error(`Yahoo Finance price error: ${res.status}`)
    const data = await res.json() as {
      chart: { result?: Array<{ meta: { regularMarketPrice?: number; chartPreviousClose?: number } }> }
    }
    const meta  = data.chart.result?.[0]?.meta
    const price = meta?.regularMarketPrice ?? meta?.chartPreviousClose
    if (!price || !isFinite(price)) throw new Error(`Yahoo Finance: no price for ${symbol}`)
    return {
      symbol,
      bid:           price,
      ask:           price,
      price,
      change:        0,
      changePercent: 0,
      volume:        0,
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

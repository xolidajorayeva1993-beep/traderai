// ============================================================
// Stooq Adapter — Metals + Forex OHLCV (bepul, API key shart emas)
// Asosan XAUUSD, XAGUSD uchun fallback sifatida
// URL: https://stooq.com/q/d/l/?s=xauusd&i=h
// CSV format: Date,Time,Open,High,Low,Close,Volume
// ============================================================
import type { OHLCVCandle, LivePrice } from '@/types';
import type { DataProvider } from './DataProvider';

// Stooq symbol mapping (lowercase)
const STOOQ_SYMBOL_MAP: Record<string, string> = {
  // Metals (spot)
  XAUUSD: 'xauusd',
  XAGUSD: 'xagusd',
  // Forex majors
  EURUSD: 'eurusd',
  GBPUSD: 'gbpusd',
  USDJPY: 'usdjpy',
  USDCHF: 'usdchf',
  AUDUSD: 'audusd',
  USDCAD: 'usdcad',
  NZDUSD: 'nzdusd',
  EURGBP: 'eurgbp',
  EURJPY: 'eurjpy',
  GBPJPY: 'gbpjpy',
};

// Stooq interval param
const INTERVAL_MAP: Record<string, string> = {
  '1m':  'm',
  '5m':  '5m',
  '15m': 'q',  // quarter-hour
  '30m': 'h',  // Stooq'da 30m yo'q → 1h dan foydalamiz
  '1h':  'h',
  '4h':  'h',  // resample 1h → 4h
  '1d':  'd',
  '1w':  'w',
};

function parseStooqCSV(csv: string): Array<{
  date: string; time: string;
  open: number; high: number; low: number; close: number;
}> {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < 5) continue;
    const [date, time, open, high, low, close] = parts;
    const o = parseFloat(open);
    const h = parseFloat(high);
    const l = parseFloat(low);
    const c = parseFloat(close);
    if (!isFinite(o) || !isFinite(c) || o <= 0) continue;
    result.push({ date: date.trim(), time: time?.trim() ?? '00:00:00', open: o, high: h, low: l, close: c });
  }
  return result;
}

function toTimestamp(date: string, time: string): number {
  // date: "2026-04-06", time: "09:00:00"
  return new Date(`${date}T${time}Z`).getTime();
}

function resampleTo4H(candles: OHLCVCandle[]): OHLCVCandle[] {
  const result: OHLCVCandle[] = [];
  for (let i = 0; i + 3 < candles.length; i += 4) {
    const chunk = candles.slice(i, i + 4);
    result.push({
      timestamp: chunk[0].timestamp,
      open:   chunk[0].open,
      high:   Math.max(...chunk.map(c => c.high)),
      low:    Math.min(...chunk.map(c => c.low)),
      close:  chunk[3].close,
      volume: chunk.reduce((s, c) => s + c.volume, 0),
    });
  }
  return result;
}

export class StooqAdapter implements DataProvider {
  name = 'stooq';

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch('https://stooq.com/q/d/l/?s=xauusd&i=d&l=1', {
        cache: 'no-store',
        signal: AbortSignal.timeout(6000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getOHLCV(symbol: string, timeframe: string, limit: number): Promise<OHLCVCandle[]> {
    const stooqSym = STOOQ_SYMBOL_MAP[symbol.toUpperCase()];
    if (!stooqSym) throw new Error(`Stooq: unsupported symbol ${symbol}`);

    const interval = INTERVAL_MAP[timeframe] ?? 'h';
    const fetchLimit = timeframe === '4h' ? limit * 4 : limit;

    // Date oralig'ini hisoblaymiz
    const now = new Date();
    const d2 = now.toISOString().slice(0, 10).replace(/-/g, '');
    const daysBack = timeframe === '1d' ? limit * 2
      : timeframe === '1h' || timeframe === '4h' ? Math.ceil(fetchLimit / 16) + 5
      : Math.ceil(fetchLimit / 100) + 3;
    const fromDate = new Date(now.getTime() - daysBack * 86_400_000);
    const d1 = fromDate.toISOString().slice(0, 10).replace(/-/g, '');

    const url = `https://stooq.com/q/d/l/?s=${stooqSym}&d1=${d1}&d2=${d2}&i=${interval}`;

    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) throw new Error(`Stooq error: ${res.status} for ${symbol}`);

    const csv = await res.text();
    if (!csv || csv.includes('No data') || csv.trim().length < 20) {
      throw new Error(`Stooq: no data for ${symbol} ${timeframe}`);
    }

    const rows = parseStooqCSV(csv);
    if (rows.length === 0) throw new Error(`Stooq: empty parsed data for ${symbol}`);

    let candles: OHLCVCandle[] = rows.map(r => ({
      timestamp: toTimestamp(r.date, r.time),
      open:   r.open,
      high:   r.high,
      low:    r.low,
      close:  r.close,
      volume: 0,
    })).sort((a, b) => a.timestamp - b.timestamp);

    if (timeframe === '4h') candles = resampleTo4H(candles);

    return candles.slice(-limit);
  }

  async getPrice(symbol: string): Promise<LivePrice> {
    const stooqSym = STOOQ_SYMBOL_MAP[symbol.toUpperCase()];
    if (!stooqSym) throw new Error(`Stooq: unsupported symbol ${symbol}`);

    const res = await fetch(
      `https://stooq.com/q/d/l/?s=${stooqSym}&i=d`,
      { cache: 'no-store', signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) throw new Error(`Stooq price error: ${res.status}`);

    const csv = await res.text();
    const rows = parseStooqCSV(csv);
    if (rows.length === 0) throw new Error(`Stooq: no price data for ${symbol}`);

    const last = rows[rows.length - 1];
    return {
      symbol,
      bid:           last.close,
      ask:           last.close,
      price:         last.close,
      change:        0,
      changePercent: 0,
      volume:        0,
      updatedAt:     Date.now(),
    };
  }
}

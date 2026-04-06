// ============================================================
// Market Update Cron — barcha forex va kripto uchun OHLCV cache
// GET /api/cron/market-update
//
// Manbalar:
//   Forex/Metals: Deriv Binary WebSocket (bepul, SPOT narxlar)
//   Kripto:       Binance REST API (bepul, limit yo'q)
//
// Google Cloud Scheduler: har 5 daqiqada shu endpointni chaqiradi.
// Muvaffaqiyatli bo'lsa Firestore market_cache ga yozadi.
// AI chat shu cacheni o'qiydi → hech qachon API limitiga urilmaydi.
//
// Xavfsizlik: X-Cron-Secret header = CRON_SECRET env
// .env.local: CRON_SECRET=istalgan_qiymat_yozing
// Cloud Scheduler: Custom Headers → X-Cron-Secret: <shu_qiymat>
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { setCachedOHLCVAsync } from '@/lib/ohlcvCache';
import { fetchDerivMultiTF, isDerivSymbol } from '@/lib/data/DerivFetcher';
import type { OHLCVCandle } from '@/types';

// ─── Yahoo spot narx (API key shart emas, faqat daily regularMarketPrice) ───
// XAUUSD=X, XAGUSD=X → interbank spot narx (OANDA/Dukascopy bilan mos)
const YAHOO_SPOT_SYMBOLS: Record<string, string> = {
  XAUUSD: 'XAUUSD=X',
  XAGUSD: 'XAGUSD=X',
};

async function fetchYahooSpotPrice(symbol: string): Promise<number | null> {
  const yahooSym = YAHOO_SPOT_SYMBOLS[symbol.toUpperCase()];
  if (!yahooSym) return null;
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=1d&range=1d`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return null;
    const data = await res.json() as {
      chart: { result?: Array<{ meta: { regularMarketPrice?: number } }> }
    };
    const price = data.chart.result?.[0]?.meta?.regularMarketPrice;
    return (price && isFinite(price) && price > 0) ? price : null;
  } catch {
    return null;
  }
}

/**
 * Deriv OTC narxini Yahoo spot narxiga moslashtiradi.
 * basis = deriv_last_close - yahoo_spot
 * Barcha candlelardan basis ayiriladi → real bozor narxlari.
 * Sanity check: |basis| < 2% → anomaliyada normalizatsiya qilinmaydi.
 */
function normalizeToSpot(
  candles: OHLCVCandle[],
  spotPrice: number,
  symbol: string,
): OHLCVCandle[] {
  if (candles.length === 0) return candles;
  const lastClose = candles[candles.length - 1].close;
  const basis = lastClose - spotPrice;
  const basisPct = Math.abs(basis) / spotPrice;
  if (basisPct > 0.02) {
    // 2% dan ortiq farq → anomaliya, normalizatsiya qilinmaydi
    console.warn(`[cron] ⚠️ ${symbol}: basis ${basis.toFixed(2)} (${(basisPct*100).toFixed(2)}%) juda katta, normalizatsiya o'tkazib yuborildi`);
    return candles;
  }
  if (Math.abs(basis) < 0.1) return candles; // farq ahamiyatsiz
  console.log(`[cron] 📐 ${symbol}: Deriv basis adj = ${basis > 0 ? '-' : '+'}${Math.abs(basis).toFixed(2)} (Deriv ${lastClose.toFixed(2)} → spot ${spotPrice.toFixed(2)})`);
  return candles.map(c => ({
    ...c,
    open:  parseFloat((c.open  - basis).toFixed(3)),
    high:  parseFloat((c.high  - basis).toFixed(3)),
    low:   parseFloat((c.low   - basis).toFixed(3)),
    close: parseFloat((c.close - basis).toFixed(3)),
  }));
}

// ─── Keshlanadigan barcha symbollar ─────────────────────────
const FOREX_PAIRS = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF',
  'AUDUSD', 'USDCAD', 'NZDUSD',
  'EURGBP', 'EURJPY', 'GBPJPY',
  'XAUUSD', 'XAGUSD',   // Spot oltin va kumush (GC=F emas!)
];

const CRYPTO_PAIRS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT',
  'SOLUSDT', 'ADAUSDT', 'DOGEUSDT',
];

// Barcha timeframelar: M5 dan D1 gacha
const ALL_TIMEFRAMES = ['5m', '15m', '30m', '1h', '4h', '1d'];

// Binance timeframe mapping
const BINANCE_TF: Record<string, string> = {
  '5m': '5m', '15m': '15m', '30m': '30m',
  '1h': '1h', '4h': '4h',  '1d': '1d',
};

// ─── Xavfsizlik tekshiruvi ───────────────────────────────────
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Agar CRON_SECRET o'rnatilmagan bo'lsa, localhost'dan ruxsat
    const host = req.headers.get('host') ?? '';
    return host.includes('localhost') || host.includes('127.0.0.1');
  }
  return req.headers.get('x-cron-secret') === secret;
}

// ─── Binance klines (kripto OHLCV) ───────────────────────────
// Binance.com Cloud Run (Google IP) dan bloklanishi mumkin (HTTP 451).
// Bunday holda binance.us yoki api4 (EU) ishlatamiz.
async function fetchBinanceOHLCV(
  symbol: string,
  interval: string,
  limit = 200,
): Promise<OHLCVCandle[]> {
  // Endpointlar ketma-ket sinab ko'ramiz
  const endpoints = [
    `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
    `https://api4.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
    `https://api-gcp.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(12_000) });
      if (res.status === 451 || res.status === 403) continue; // geo-block → keyingisini sinal
      if (!res.ok) throw new Error(`Binance ${symbol} ${interval}: HTTP ${res.status}`);
      const raw: unknown[][] = await res.json();
      return raw.map(k => ({
        timestamp: Number(k[0]),
        open:      parseFloat(String(k[1])),
        high:      parseFloat(String(k[2])),
        low:       parseFloat(String(k[3])),
        close:     parseFloat(String(k[4])),
        volume:    parseFloat(String(k[5])),
      }));
    } catch {
      continue;
    }
  }
  throw new Error(`Binance ${symbol} ${interval}: barcha endpointlar blok`);
}

// ─── Asinxron batch runner — N ta parallel ───────────────────
async function batchRun<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    chunks.push(items.slice(i, i + concurrency));
  }
  for (const chunk of chunks) {
    await Promise.allSettled(chunk.map(fn));
  }
}

// ─── Asosiy handler ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Ruxsat yo\'q' }, { status: 401 });
  }

  const startMs = Date.now();
  const summary = {
    forex:  { ok: 0, fail: 0, pairs: [] as string[] },
    crypto: { ok: 0, fail: 0, pairs: [] as string[] },
    errors: [] as string[],
  };

  // ── 1. FOREX/METALS: Deriv WebSocket ───────────────────────
  // Har bir symbol uchun bitta WS ulanish → 6 ta timeframe parallel
  // Metals (XAUUSD, XAGUSD) uchun Yahoo spot narxi olinib normalizatsiya qilinadi
  const derivPairs = FOREX_PAIRS.filter(isDerivSymbol);

  // Metals uchun Yahoo spot narxlarini oldindan olamiz (parallel)
  const spotPrices: Record<string, number> = {};
  await Promise.allSettled(
    Object.keys(YAHOO_SPOT_SYMBOLS).map(async (sym) => {
      const price = await fetchYahooSpotPrice(sym);
      if (price) {
        spotPrices[sym] = price;
        console.log(`[cron] 💰 ${sym} Yahoo spot narx: ${price}`);
      }
    }),
  );

  await batchRun(derivPairs, 4, async (symbol) => {
    try {
      let results = await fetchDerivMultiTF(symbol, ALL_TIMEFRAMES, 200);

      // Agar hech narsa kelmasa — bir marta qayta urinib ko'ramiz
      if (Object.keys(results).length === 0) {
        console.warn(`[cron] ⚠️ ${symbol}: Deriv bo'sh qaytdi, qayta urinish...`);
        await new Promise(r => setTimeout(r, 2000));
        results = await fetchDerivMultiTF(symbol, ALL_TIMEFRAMES, 200);
      }

      const tfs = Object.keys(results);

      if (tfs.length === 0) {
        summary.forex.fail++;
        summary.errors.push(`${symbol}: Deriv — hech qanday timeframe kelmadi`);
        return;
      }

      // Yahoo spot narxi mavjud bo'lsa → normalizatsiya qilamiz
      const spotPrice = spotPrices[symbol.toUpperCase()];

      // Har bir timeframe uchun Firestore ga yozamiz
      await Promise.allSettled(
        tfs.map(async (tf) => {
          let candles = results[tf];
          if (candles.length < 10) return;
          // Metals uchun Deriv OTC → Yahoo interbank spot normalizatsiya
          if (spotPrice) candles = normalizeToSpot(candles, spotPrice, symbol);
          await setCachedOHLCVAsync(symbol, tf, candles);
        }),
      );

      summary.forex.ok++;
      summary.forex.pairs.push(`${symbol}(${tfs.join(',')})`);
      console.log(`[cron] ✅ ${symbol} Deriv: ${tfs.length} timeframe, ${tfs.map(tf => `${tf}:${results[tf].length}`).join(' ')}`);
    } catch (err) {
      summary.forex.fail++;
      const msg = err instanceof Error ? err.message : String(err);
      summary.errors.push(`${symbol}: ${msg}`);
      console.error(`[cron] ❌ ${symbol} Deriv xato: ${msg}`);
    }
  });

  // ── 2. KRIPTO: Binance REST ─────────────────────────────────
  // Har bir symbol × timeframe uchun alohida HTTP so'rov
  type CryptoTask = { symbol: string; tf: string };
  const cryptoTasks: CryptoTask[] = CRYPTO_PAIRS.flatMap(sym =>
    ALL_TIMEFRAMES.map(tf => ({ symbol: sym, tf })),
  );

  await batchRun(cryptoTasks, 8, async ({ symbol, tf }) => {
    const binanceInterval = BINANCE_TF[tf] ?? tf;
    try {
      const candles = await fetchBinanceOHLCV(symbol, binanceInterval, 200);
      if (candles.length >= 10) {
        await setCachedOHLCVAsync(symbol, tf, candles);
        if (!summary.crypto.pairs.includes(symbol)) {
          summary.crypto.ok++;
          summary.crypto.pairs.push(symbol);
        }
      }
    } catch (err) {
      summary.crypto.fail++;
      const msg = err instanceof Error ? err.message : String(err);
      summary.errors.push(`${symbol}/${tf}: ${msg}`);
      console.error(`[cron] ❌ ${symbol}/${tf} Binance xato: ${msg}`);
    }
  });

  const durationMs = Date.now() - startMs;
  const totalDocs = summary.forex.ok * ALL_TIMEFRAMES.length + summary.crypto.ok * ALL_TIMEFRAMES.length;

  console.log(`[cron] Tugadi ${durationMs}ms — Firestore yozuvlar: ~${totalDocs}`);

  return NextResponse.json({
    ok:         true,
    durationMs,
    totalDocs,
    forex:      summary.forex,
    crypto:     summary.crypto,
    errors:     summary.errors,
    timestamp:  new Date().toISOString(),
  });
}

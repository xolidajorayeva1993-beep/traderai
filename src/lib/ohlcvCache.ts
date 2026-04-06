// ============================================================
// Firestore OHLCV Cache — server-side
// Caches OHLCV data per (symbol, timeframe) with TTL
// Collection: /market_cache/{symbol}_{timeframe}
// ============================================================
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/lib/firebase/admin';
import type { OHLCVCandle } from '@/types';

const TTL_MS: Record<string, number> = {
  '1m':   5  * 60_000,         // 5 min
  '5m':   10 * 60_000,         // 10 min (cron 5 daqiqada bir yangilaydi)
  '15m':  25 * 60_000,         // 25 min
  '30m':  40 * 60_000,         // 40 min
  '1h':   80 * 60_000,         // 80 min
  '4h':   5  * 60 * 60_000,    // 5 soat
  '1d':   26 * 60 * 60_000,    // 26 soat
  '1w':   8  * 24 * 60 * 60_000, // 8 kun
};

// ─── Candle timestamp freshness (CRITICAL for stale cache detection) ──────────
// Oxirgi candle timestamp bozor yopiq bo'lsa ham qabul qilinadigan maksimal yosh.
// Bu 3760 vs 4683 narx tafovutini oldini oladi.
const CANDLE_MAX_AGE_MS: Record<string, number> = {
  '1m':   60 * 60_000,         // 1 soat
  '5m':   3 * 60 * 60_000,     // 3 soat
  '15m':  6 * 60 * 60_000,     // 6 soat
  '30m':  12 * 60 * 60_000,    // 12 soat
  '1h':   72 * 60 * 60_000,    // 3 kun (forex/altın hafta soni qoplaydi)
  '4h':   7 * 24 * 60 * 60_000, // 7 kun
  '1d':   10 * 24 * 60 * 60_000,// 10 kun
  '1w':   21 * 24 * 60 * 60_000,// 21 kun
};

function areCandlesFresh(candles: OHLCVCandle[], timeframe: string): boolean {
  if (!candles.length) return false;
  const lastTs = candles[candles.length - 1].timestamp;
  const ageMs  = Date.now() - lastTs;
  const maxAge = CANDLE_MAX_AGE_MS[timeframe] ?? (72 * 60 * 60_000);
  const fresh  = ageMs <= maxAge;
  if (!fresh) {
    const lastDate = new Date(lastTs).toISOString();
    const ageDays  = (ageMs / 86_400_000).toFixed(1);
    console.warn(`[ohlcvCache] ⚠️ STALE candles! Last candle: ${lastDate} (${ageDays} kun oldin), timeframe=${timeframe}`);
  }
  return fresh;
}

function cacheKey(symbol: string, timeframe: string): string {
  return `${symbol.toUpperCase()}_${timeframe}`;
}

function getDb() {
  initAdmin();
  return getFirestore();
}

export async function getCachedOHLCV(
  symbol: string,
  timeframe: string
): Promise<OHLCVCandle[] | null> {
  try {
    const db  = getDb();
    const key = cacheKey(symbol, timeframe);
    const doc = await db.collection('market_cache').doc(key).get();

    if (!doc.exists) return null;

    const data = doc.data();
    if (!data) return null;

    const ttl = TTL_MS[timeframe] ?? TTL_MS['1h'];
    if (Date.now() - data.updatedAt > ttl) return null;

    return data.candles as OHLCVCandle[];
  } catch {
    return null;
  }
}

export function setCachedOHLCV(
  symbol: string,
  timeframe: string,
  candles: OHLCVCandle[]
): void {
  (async () => {
    try {
      const db  = getDb();
      const key = cacheKey(symbol, timeframe);
      await db.collection('market_cache').doc(key).set({
        symbol,
        timeframe,
        candles,
        updatedAt: Date.now(),
        count:     candles.length,
      });
    } catch {
      // Cache write failure is non-fatal
    }
  })();
}

/** Awaitable version — cron job uchun (muvaffaqiyatni kutish kerak) */
export async function setCachedOHLCVAsync(
  symbol: string,
  timeframe: string,
  candles: OHLCVCandle[]
): Promise<void> {
  const db  = getDb();
  const key = cacheKey(symbol, timeframe);
  await db.collection('market_cache').doc(key).set({
    symbol,
    timeframe,
    candles,
    updatedAt: Date.now(),
    count:     candles.length,
  });
}

/** Firestore cache ni o'chirish (stale ma'lumot aniqlanganda) */
export function deleteCachedOHLCV(symbol: string, timeframe: string): void {
  (async () => {
    try {
      const db  = getDb();
      const key = cacheKey(symbol, timeframe);
      await db.collection('market_cache').doc(key).delete();
      console.log(`[ohlcvCache] Stale cache deleted: ${key}`);
    } catch { /* non-fatal */ }
  })();
}

/**
 * Wrapper: try cache first, then fetch fresh and update cache.
 * YANGI: candle timestamp-ni ham tekshiradi — stale cache avtomatik o'chiriladi.
 */
export async function withOHLCVCache(
  symbol: string,
  timeframe: string,
  fetcher: () => Promise<OHLCVCandle[]>
): Promise<OHLCVCandle[]> {
  const cached = await getCachedOHLCV(symbol, timeframe)
  if (cached && cached.length >= 150) {
    // updatedAt fresh bo'lsa ham candle timestamp-ni tekshiramiz!
    if (areCandlesFresh(cached, timeframe)) return cached;
    // Stale candle data — Firestore cache ni o'chiramiz
    deleteCachedOHLCV(symbol, timeframe);
    console.log(`[ohlcvCache] Cache invalidated for ${symbol} ${timeframe}, fetching fresh...`);
  }

  const fresh = await fetcher()
  if (fresh.length > 0) {
    if (!areCandlesFresh(fresh, timeframe)) {
      console.error(`[ohlcvCache] Provider ham stale data qaytardi! ${symbol} ${timeframe}, last=${new Date(fresh[fresh.length-1].timestamp).toISOString()}`);
      // Stale data ni cache ga yozmaylik
    } else {
      setCachedOHLCV(symbol, timeframe, fresh)
    }
  }
  return fresh
}

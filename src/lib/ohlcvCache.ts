// ============================================================
// Firestore OHLCV Cache — server-side
// Caches OHLCV data per (symbol, timeframe) with TTL
// Collection: /market_cache/{symbol}_{timeframe}
// ============================================================
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/lib/firebase/admin';
import type { OHLCVCandle } from '@/types';

const TTL_MS: Record<string, number> = {
  '1m':   60_000,           // 1 min
  '5m':   2 * 60_000,       // 2 min (was 5)
  '15m':  3 * 60_000,       // 3 min (was 15)
  '30m':  5 * 60_000,       // 5 min (was 30)
  '1h':   5 * 60_000,       // 5 min (was 1 HOUR → stale price bug)
  '4h':   10 * 60_000,      // 10 min (was 4 hours)
  '1d':   30 * 60_000,      // 30 min (was 24 hours)
  '1w':   60 * 60_000,      // 1 hour (was 7 days)
};

function cacheKey(symbol: string, timeframe: string): string {
  return `${symbol.toUpperCase()}_${timeframe}`;
}

function getDb() {
  initAdmin();
  return getFirestore();
}

/**
 * Fetch OHLCV candles from Firestore cache.
 * Returns null if cache is missing or expired.
 */
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
    return null; // Cache miss on error — fetch fresh
  }
}

/**
 * Save OHLCV candles to Firestore cache.
 * Non-blocking — fire and forget.
 */
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

/**
 * Wrapper: try cache first, then fetch fresh and update cache.
 */
export async function withOHLCVCache(
  symbol: string,
  timeframe: string,
  fetcher: () => Promise<OHLCVCandle[]>
): Promise<OHLCVCandle[]> {
  const cached = await getCachedOHLCV(symbol, timeframe)
  // Cache-dan faqat yetarli sham bo'lsa foydalanamiz (≥150)
  if (cached && cached.length >= 150) return cached

  const fresh = await fetcher()
  if (fresh.length > 0) setCachedOHLCV(symbol, timeframe, fresh)
  return fresh
}

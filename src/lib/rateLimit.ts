// ============================================================
// Simple In-Memory Rate Limiter
// Works in Next.js API routes (not edge runtime)
// ============================================================

interface RateLimitEntry {
  count:   number;
  resetAt: number;
}

// Global in-process store (survives across requests in same process)
const store = new Map<string, RateLimitEntry>();

/**
 * Check if the given key has exceeded its limit within the window.
 * @param key     - unique key, e.g. "twelve-data:EURUSD" or "ip:1.2.3.4"
 * @param limit   - max requests allowed
 * @param windowMs - window duration in ms
 * @returns true if request is allowed, false if rate-limited
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;

  entry.count += 1;
  return true;
}

/**
 * Returns remaining requests and reset time for a key.
 */
export function getRateLimitInfo(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    return { remaining: limit, resetAt: now + windowMs };
  }

  return {
    remaining: Math.max(0, limit - entry.count),
    resetAt:   entry.resetAt,
  };
}

// Clean expired entries periodically (every 5 min)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now >= entry.resetAt) store.delete(key);
    }
  }, 5 * 60 * 1000);
}

// ─── Per-API rate limit configs ───────────────────────────────
export const API_RATE_LIMITS = {
  'twelve-data': { limit: 8,    windowMs: 60_000 },        // 8/min
  'alpha-vantage': { limit: 5,  windowMs: 60_000 },        // 5/min (conservative)
  'yahoo-finance': { limit: 30, windowMs: 60_000 },        // no official limit
  'binance':       { limit: 100, windowMs: 60_000 },       // 1200/min, we stay low
  'coingecko':     { limit: 25, windowMs: 60_000 },        // 30/min free
  'cryptopanic':   { limit: 80, windowMs: 60_000 },        // 100/min free
} as const;

export type ApiName = keyof typeof API_RATE_LIMITS;

/**
 * Check rate limit for a specific API.
 */
export function checkApiRateLimit(api: ApiName): boolean {
  const cfg = API_RATE_LIMITS[api];
  return checkRateLimit(`api:${api}`, cfg.limit, cfg.windowMs);
}

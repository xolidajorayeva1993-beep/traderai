// ============================================================
// API Health Logger — Firestore /api_logs/{timestamp}
// Logs errors, rate limits, and latency for monitoring
// ============================================================
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/lib/firebase/admin';

export type LogLevel = 'info' | 'warn' | 'error';

export interface ApiLogEntry {
  provider:   string;
  symbol?:    string;
  timeframe?: string;
  action:     string;
  level:      LogLevel;
  message:    string;
  latencyMs?: number;
  timestamp:  number;
}

let _initialized = false;

function getDb() {
  if (!_initialized) {
    initAdmin();
    _initialized = true;
  }
  return getFirestore();
}

/**
 * Write an API log entry to Firestore /api_logs/.
 * Non-blocking — fire and forget, never throws.
 */
export async function logApiEvent(entry: Omit<ApiLogEntry, 'timestamp'>): Promise<void> {
  try {
    const db = getDb();
    const doc: ApiLogEntry = { ...entry, timestamp: Date.now() };
    // Auto-ID document
    await db.collection('api_logs').add(doc);
  } catch {
    // Logging must never throw — silently ignore Firestore errors
  }
}

/**
 * Wraps an async function and logs timing + errors to Firestore.
 */
export async function withApiLog<T>(
  provider: string,
  action: string,
  fn: () => Promise<T>,
  meta?: { symbol?: string; timeframe?: string }
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const latencyMs = Date.now() - start;

    // Only log slow requests (>2s) as info to avoid excessive Firestore writes
    if (latencyMs > 2000) {
      logApiEvent({
        provider, action, level: 'warn',
        message: `Slow response: ${latencyMs}ms`,
        latencyMs, ...meta,
      });
    }

    return result;
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    const level: LogLevel = message.includes('429') || message.includes('rate limit') ? 'warn' : 'error';

    logApiEvent({
      provider, action, level,
      message, latencyMs, ...meta,
    });

    throw err; // Re-throw — caller handles the error
  }
}

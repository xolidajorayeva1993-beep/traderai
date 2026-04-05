// ============================================================
// Shared API input validation utilities
// ============================================================

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ─── Primitive validators ─────────────────────────────────────

export function requireString(val: unknown, field: string, maxLen = 500): string {
  if (typeof val !== 'string' || val.trim().length === 0) {
    throw new ValidationError(`${field} maydoni bo'sh bo'lmasligi kerak`, field);
  }
  if (val.length > maxLen) {
    throw new ValidationError(`${field} ${maxLen} ta belgidan oshmasligi kerak`, field);
  }
  return val.trim();
}

export function optionalString(val: unknown, field: string, maxLen = 500): string | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  return requireString(val, field, maxLen);
}

export function requireNumber(val: unknown, field: string, min?: number, max?: number): number {
  const n = Number(val);
  if (!isFinite(n)) {
    throw new ValidationError(`${field} raqam bo'lishi kerak`, field);
  }
  if (min !== undefined && n < min) {
    throw new ValidationError(`${field} ${min} dan kichik bo'lmasligi kerak`, field);
  }
  if (max !== undefined && n > max) {
    throw new ValidationError(`${field} ${max} dan katta bo'lmasligi kerak`, field);
  }
  return n;
}

export function optionalNumber(val: unknown, field: string, min?: number, max?: number): number | undefined {
  if (val === undefined || val === null) return undefined;
  return requireNumber(val, field, min, max);
}

export function requireEnum<T extends string>(val: unknown, field: string, allowed: readonly T[]): T {
  if (!allowed.includes(val as T)) {
    throw new ValidationError(`${field} qiymatlari: ${allowed.join(', ')}`, field);
  }
  return val as T;
}

export function requireBoolean(val: unknown, field: string): boolean {
  if (typeof val !== 'boolean') {
    throw new ValidationError(`${field} true/false bo'lishi kerak`, field);
  }
  return val;
}

export function requireEmail(val: unknown, field = 'email'): string {
  const s = requireString(val, field, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
    throw new ValidationError("Email formati noto'g'ri", field);
  }
  return s.toLowerCase();
}

// ─── Sanitization ──────────────────────────────────────────────

/**
 * Strip HTML tags and script injection attempts.
 * Use for any user-provided text that might be displayed in UI.
 */
export function sanitizeText(val: string): string {
  return val
    .replace(/<[^>]*>/g, '')          // strip HTML tags
    .replace(/javascript:/gi, '')      // script URLs
    .replace(/on\w+\s*=/gi, '')        // event handlers
    .trim();
}

/**
 * Sanitize a Firestore document ID candidate — only alphanumeric + dash + underscore.
 */
export function sanitizeId(val: string): string {
  return val.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
}

// ─── Domain-specific validators ───────────────────────────────

export const VALID_PAIRS = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'NZDUSD', 'USDCAD', 'USDCHF',
  'GBPJPY', 'EURJPY', 'EURGBP', 'XAUUSD', 'XAGUSD',
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT', 'DOGEUSDT',
] as const;

export const VALID_TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'] as const;
export const VALID_DIRECTIONS = ['BUY', 'SELL'] as const;
export const VALID_PLAN_IDS   = ['free', 'pro', 'vip'] as const;

export type ValidPair      = typeof VALID_PAIRS[number];
export type ValidTimeframe = typeof VALID_TIMEFRAMES[number];
export type ValidDirection = typeof VALID_DIRECTIONS[number];
export type ValidPlanId    = typeof VALID_PLAN_IDS[number];

export function requirePair(val: unknown): ValidPair {
  return requireEnum(val, 'pair', VALID_PAIRS);
}

export function requireTimeframe(val: unknown): ValidTimeframe {
  return requireEnum(val, 'timeframe', VALID_TIMEFRAMES);
}

export function requireDirection(val: unknown): ValidDirection {
  return requireEnum(val, 'direction', VALID_DIRECTIONS);
}

// ─── Body parser helper (returns typed body or throws) ─────────

export async function parseBody<T>(req: Request): Promise<T> {
  const ct = req.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    throw new ValidationError("Content-Type application/json bo'lishi kerak");
  }
  try {
    return await req.json() as T;
  } catch {
    throw new ValidationError("JSON formati noto'g'ri");
  }
}

// ─── NextResponse helper ───────────────────────────────────────
import { NextResponse } from 'next/server';

export function validationErrorResponse(err: unknown) {
  if (err instanceof ValidationError) {
    return NextResponse.json(
      { error: err.message, field: err.field ?? null },
      { status: 400 }
    );
  }
  return null;
}

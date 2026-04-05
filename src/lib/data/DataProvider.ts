// ============================================================
// DataProvider — Abstract interface + Failover implementation
// ============================================================
import type { OHLCVCandle, LivePrice } from '@/types';

export interface DataProvider {
  name: string;
  getOHLCV(symbol: string, timeframe: string, limit: number): Promise<OHLCVCandle[]>;
  getPrice(symbol: string): Promise<LivePrice>;
  isAvailable(): Promise<boolean>;
}

/** Returns true if the error indicates a rate limit (HTTP 429). */
function isRateLimit(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('429') || msg.toLowerCase().includes('rate limit');
}

/**
 * FailoverDataProvider wraps multiple DataProvider instances.
 * It tries providers in order and moves to the next on failure.
 * Rate-limited (429) providers are skipped immediately and marked
 * as cooling-down for RATE_LIMIT_COOLDOWN_MS milliseconds.
 */
const RATE_LIMIT_COOLDOWN_MS = 60_000; // 1 minute

export class FailoverDataProvider implements DataProvider {
  name = 'failover';

  /** Tracks which providers are rate-limited and until when. */
  private readonly cooldowns = new Map<string, number>();

  constructor(private readonly providers: DataProvider[]) {}

  private isOnCooldown(provider: DataProvider): boolean {
    const until = this.cooldowns.get(provider.name);
    if (!until) return false;
    if (Date.now() >= until) {
      this.cooldowns.delete(provider.name);
      return false;
    }
    return true;
  }

  private markCooldown(provider: DataProvider): void {
    this.cooldowns.set(provider.name, Date.now() + RATE_LIMIT_COOLDOWN_MS);
  }

  async isAvailable(): Promise<boolean> {
    for (const provider of this.providers) {
      if (this.isOnCooldown(provider)) continue;
      if (await provider.isAvailable()) return true;
    }
    return false;
  }

  async getOHLCV(symbol: string, timeframe: string, limit: number): Promise<OHLCVCandle[]> {
    const errors: string[] = [];
    for (const provider of this.providers) {
      if (this.isOnCooldown(provider)) {
        errors.push(`[${provider.name}]: on cooldown (rate-limited)`);
        continue;
      }
      try {
        const data = await provider.getOHLCV(symbol, timeframe, limit);
        if (data.length > 0) return data;
        errors.push(`[${provider.name}]: returned empty data`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`[${provider.name}]: ${msg}`);
        if (isRateLimit(err)) this.markCooldown(provider);
      }
    }
    throw new Error(`All data providers failed for ${symbol}:\n${errors.join('\n')}`);
  }

  async getPrice(symbol: string): Promise<LivePrice> {
    const errors: string[] = [];
    for (const provider of this.providers) {
      if (this.isOnCooldown(provider)) {
        errors.push(`[${provider.name}]: on cooldown (rate-limited)`);
        continue;
      }
      try {
        return await provider.getPrice(symbol);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`[${provider.name}]: ${msg}`);
        if (isRateLimit(err)) this.markCooldown(provider);
      }
    }
    throw new Error(`All data providers failed for price ${symbol}:\n${errors.join('\n')}`);
  }
}

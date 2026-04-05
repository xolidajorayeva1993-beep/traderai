// ============================================================
// CoinGecko Free API Adapter (no key required)
// ============================================================
import type { OHLCVCandle, LivePrice } from '@/types';
import type { DataProvider } from './DataProvider';

const BASE_URL = 'https://api.coingecko.com/api/v3';

// Map common symbol → CoinGecko id (supports both BTC/USDT and BTCUSDT formats)
const SYMBOL_MAP: Record<string, string> = {
  'BTC/USDT': 'bitcoin',  'BTCUSDT': 'bitcoin',  'BTCUSD': 'bitcoin',
  'ETH/USDT': 'ethereum', 'ETHUSDT': 'ethereum', 'ETHUSD': 'ethereum',
  'BNB/USDT': 'binancecoin', 'BNBUSDT': 'binancecoin', 'BNBUSD': 'binancecoin',
  'SOL/USDT': 'solana',   'SOLUSDT': 'solana',
  'XRP/USDT': 'ripple',   'XRPUSDT': 'ripple',
  'ADA/USDT': 'cardano',  'ADAUSDT': 'cardano',
  'DOGE/USDT': 'dogecoin','DOGEUSDT': 'dogecoin',
  'AVAX/USDT': 'avalanche-2', 'AVAXUSDT': 'avalanche-2',
  'MATIC/USDT': 'matic-network', 'MATICUSDT': 'matic-network',
  'DOT/USDT': 'polkadot', 'DOTUSDT': 'polkadot',
};

const TIMEFRAME_TO_DAYS: Record<string, number> = {
  '1m': 1, '5m': 1, '15m': 1, '30m': 2, '1h': 7, '4h': 30, '1d': 90, '1w': 365,
};

export class CoinGeckoAdapter implements DataProvider {
  name = 'coingecko';

  private getCoinId(symbol: string): string {
    const id = SYMBOL_MAP[symbol.toUpperCase()];
    if (!id) throw new Error(`CoinGecko: unknown symbol ${symbol}`);
    return id;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/ping`, { cache: 'no-store' });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getOHLCV(symbol: string, timeframe: string, limit: number): Promise<OHLCVCandle[]> {
    const coinId = this.getCoinId(symbol);
    const days = TIMEFRAME_TO_DAYS[timeframe] ?? 7;

    const res = await fetch(
      `${BASE_URL}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) throw new Error(`CoinGecko OHLCV error: ${res.status}`);

    const raw: number[][] = await res.json();
    return raw.slice(-limit).map((k) => ({
      timestamp: k[0],
      open: k[1],
      high: k[2],
      low: k[3],
      close: k[4],
      volume: 0, // CoinGecko OHLC free doesn't include volume
    }));
  }

  async getPrice(symbol: string): Promise<LivePrice> {
    const coinId = this.getCoinId(symbol);
    const res = await fetch(
      `${BASE_URL}/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`,
      { next: { revalidate: 30 } }
    );
    if (!res.ok) throw new Error(`CoinGecko price error: ${res.status}`);

    const data = await res.json();
    const coin = data[coinId];

    return {
      symbol,
      bid: coin.usd * 0.9999,
      ask: coin.usd * 1.0001,
      price: coin.usd,
      change: 0,
      changePercent: coin.usd_24h_change ?? 0,
      volume: coin.usd_24h_vol ?? 0,
      updatedAt: Date.now(),
    };
  }
}

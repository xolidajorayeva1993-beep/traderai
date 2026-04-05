'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { LivePrice, OHLCVCandle } from '@/types';
import { getBinanceWsManager, type BinanceTicker } from '@/lib/binanceWebSocket';

// ─── Live Prices ──────────────────────────────────────────────
interface LivePricesResponse {
  prices: LivePrice[];
  updatedAt: number;
}

export function useLivePrices() {
  return useQuery<LivePricesResponse>({
    queryKey: ['market', 'live'],
    queryFn: async () => {
      const res = await fetch('/api/market/live');
      if (!res.ok) throw new Error('Live narxlar olinmadi');
      return res.json();
    },
    refetchInterval: 10_000,
    staleTime:       5_000,
    retry:           2,
  });
}

// ─── OHLCV (candlestick data) ─────────────────────────────────
interface OHLCVResponse {
  symbol:    string;
  timeframe: string;
  candles:   OHLCVCandle[];
  livePrice: LivePrice;
}

export function useOHLCV(symbol: string, timeframe: string, type: 'forex' | 'crypto' = 'forex') {
  return useQuery<OHLCVResponse>({
    queryKey: ['market', 'ohlcv', symbol, timeframe, type],
    queryFn: async () => {
      const endpoint = type === 'crypto' ? '/api/market/crypto' : '/api/market/forex';
      const res = await fetch(`${endpoint}?symbol=${symbol}&timeframe=${timeframe}&limit=200`);
      if (!res.ok) throw new Error(`${symbol} OHLCV olinmadi`);
      return res.json();
    },
    refetchInterval: timeframe === '1m' ? 60_000 : timeframe === '5m' ? 300_000 : 600_000,
    staleTime:       30_000,
    retry:           2,
    enabled:         !!symbol && !!timeframe,
  });
}

// ─── Fear & Greed Index ───────────────────────────────────────
interface FearGreedItem {
  value:          number;
  classification: string;
  timestamp:      number;
}

interface FearGreedResponse {
  items: FearGreedItem[];
}

export function useFearGreed() {
  return useQuery<FearGreedResponse>({
    queryKey: ['market', 'fear-greed'],
    queryFn: async () => {
      const res = await fetch('/api/market/fear-greed');
      if (!res.ok) throw new Error('Fear & Greed olinmadi');
      return res.json();
    },
    refetchInterval: 3_600_000, // 1 soat
    staleTime:       3_600_000,
    retry:           1,
  });
}

// ─── Single symbol price (from live batch) ────────────────────
export function useSymbolPrice(symbol: string) {
  const { data, ...rest } = useLivePrices();
  const price = data?.prices.find((p) => p.symbol === symbol);
  return { price, ...rest };
}

// ─── Crypto News (CryptoPanic) ────────────────────────────────
export interface CryptoNewsItem {
  id:          number;
  title:       string;
  url:         string;
  source:      string;
  publishedAt: string;
  currencies:  string[];
  votes:       { positive: number; negative: number; important: number };
  sentiment:   'positive' | 'negative' | 'neutral';
}

interface CryptoNewsResponse {
  items: CryptoNewsItem[];
  total: number;
}

export function useCryptoNews(options?: {
  currencies?: string;
  filter?: 'hot' | 'rising' | 'bullish' | 'bearish';
  limit?: number;
}) {
  const currencies = options?.currencies ?? 'BTC,ETH,BNB';
  const filter     = options?.filter     ?? 'hot';
  const limit      = options?.limit      ?? 20;

  return useQuery<CryptoNewsResponse>({
    queryKey: ['market', 'news', currencies, filter, limit],
    queryFn: async () => {
      const res = await fetch(
        `/api/market/news?currencies=${currencies}&filter=${filter}&limit=${limit}`
      );
      if (!res.ok) throw new Error('Kripto yangiliklar olinmadi');
      return res.json();
    },
    refetchInterval: 5 * 60_000,  // 5 min
    staleTime:       5 * 60_000,
    retry:           1,
  });
}

// ─── Binance WebSocket real-time ticker ───────────────────────
/**
 * Subscribe to Binance real-time mini-ticker for a single crypto symbol.
 * Falls back to HTTP polling if WebSocket is unavailable.
 * @param symbol - e.g. "BTCUSDT"
 */
export function useBinanceTicker(symbol: string): BinanceTicker | null {
  const [ticker, setTicker] = useState<BinanceTicker | null>(null);

  useEffect(() => {
    if (!symbol || typeof WebSocket === 'undefined') return;
    const manager = getBinanceWsManager();
    const unsub = manager.subscribe(symbol.toUpperCase(), setTicker);
    return unsub;
  }, [symbol]);

  return ticker;
}

/**
 * Subscribe to Binance real-time tickers for multiple symbols.
 * Returns a Map of symbol → latest ticker.
 */
export function useBinanceTickers(symbols: string[]): Map<string, BinanceTicker> {
  const [tickers, setTickers] = useState<Map<string, BinanceTicker>>(new Map());

  useEffect(() => {
    if (!symbols.length || typeof WebSocket === 'undefined') return;
    const manager = getBinanceWsManager();

    const unsubs = symbols.map((sym) =>
      manager.subscribe(sym.toUpperCase(), (t) => {
        setTickers((prev) => new Map(prev).set(t.symbol, t));
      })
    );

    return () => unsubs.forEach((fn) => fn());
  }, [symbols.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return tickers;
}

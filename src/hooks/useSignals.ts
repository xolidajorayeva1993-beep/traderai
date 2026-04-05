'use client';

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { collection, query, where, orderBy, limit, getDocs, onSnapshot, QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Signal, SignalStatus, AssetType } from '@/types';
import { useEffect, useState } from 'react';

// ─── Fetch signals from Firestore ─────────────────────────────
async function fetchSignals(filters: SignalFilters): Promise<Signal[]> {
  if (!db) return MOCK_SIGNALS;

  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc'), limit(filters.limit ?? 20)];

  if (filters.status)    constraints.push(where('status',    '==', filters.status));
  if (filters.assetType) constraints.push(where('assetType', '==', filters.assetType));
  if (filters.pair)      constraints.push(where('pair',      '==', filters.pair));

  const q   = query(collection(db, 'signals'), ...constraints);
  const snap = await getDocs(q);

  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Signal));
}

// ─── Filters interface ────────────────────────────────────────
interface SignalFilters {
  status?:    SignalStatus;
  assetType?: AssetType;
  pair?:      string;
  limit?:     number;
}

// ─── useSignals — TanStack Query ──────────────────────────────
export function useSignals(filters: SignalFilters = {}) {
  return useQuery<Signal[]>({
    queryKey: ['signals', filters],
    queryFn: () => fetchSignals(filters),
    staleTime:       60_000,
    refetchInterval: 120_000,
    retry:           2,
  });
}

// ─── useActiveSignals — real-time Firestore listener ─────────
export function useActiveSignals() {
  const [signals, setSignals] = useState<Signal[]>(MOCK_SIGNALS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) {
      setSignals(MOCK_SIGNALS);
      setLoading(false);
      return;
    }

    let unsub: (() => void) | null = null;
    let cancelled = false;

    const q = query(
      collection(db, 'signals'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    unsub = onSnapshot(q, (snap) => {
      if (cancelled) return;
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Signal));
      setSignals(data.length > 0 ? data : MOCK_SIGNALS);
      setLoading(false);
    }, () => {
      if (cancelled) return;
      setSignals(MOCK_SIGNALS);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  return { signals, loading };
}

// ─── Infinite signals list ────────────────────────────────────
export function useInfiniteSignals(filters: Omit<SignalFilters, 'limit'> = {}) {
  return useInfiniteQuery<Signal[], Error, { pages: Signal[][] }, ['signals', 'infinite', typeof filters], number>({
    queryKey: ['signals', 'infinite', filters],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchSignals({ ...filters, limit: 20 + (pageParam as number) }),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < 20 ? undefined : allPages.length * 20,
  });
}

// ─── Mock data (shown when Firebase is not configured) ───────
const MOCK_SIGNALS: Signal[] = [
  {
    id: 'mock-1',
    pair: 'XAU/USD',
    assetType: 'commodities',
    direction: 'BUY',
    timeframe: '1h',
    entryPrice: 2638.5,
    entryZone: [2635, 2642],
    targets: [
      { price: 2651, pips: 125, riskReward: 2.1, probability: 72 },
      { price: 2665, pips: 265, riskReward: 4.4, probability: 58 },
    ],
    stopLoss: 2628,
    stopLossPips: 105,
    confidence: 'HIGH',
    confidenceScore: 87,
    status: 'active',
    chartImages: { overview: '', entry: '' },
    strategiesTriggered: [],
    consensus: {
      fathAI_primary: 'BUY',
      fathAI_secondary: 'BUY',
    },
    analysis: 'FATH AI: Kuchli support zone. Bullish engulfing + RSI divergence.',
    createdAt: Date.now() - 60 * 60 * 1000,
    updatedAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  } as unknown as Signal,
  {
    id: 'mock-2',
    pair: 'EUR/USD',
    assetType: 'forex',
    direction: 'BUY',
    timeframe: '4h',
    entryPrice: 1.0892,
    entryZone: [1.0885, 1.0898],
    targets: [
      { price: 1.0935, pips: 43, riskReward: 1.9, probability: 68 },
      { price: 1.0975, pips: 83, riskReward: 3.7, probability: 51 },
    ],
    stopLoss: 1.0860,
    stopLossPips: 32,
    confidence: 'HIGH',
    confidenceScore: 82,
    status: 'active',
    chartImages: { overview: '', entry: '' },
    strategiesTriggered: [],
    consensus: {
      fathAI_primary: 'BUY',
      fathAI_secondary: 'BUY',
    },
    analysis: 'FATH AI: EMA50 ustida yopilish. Trend davom etadi.',
    createdAt: Date.now() - 2 * 60 * 60 * 1000,
    updatedAt: Date.now(),
    expiresAt: Date.now() + 48 * 60 * 60 * 1000,
  } as unknown as Signal,
  {
    id: 'mock-3',
    pair: 'BTC/USDT',
    assetType: 'crypto',
    direction: 'SELL',
    timeframe: '1d',
    entryPrice: 97800,
    entryZone: [97500, 98200],
    targets: [
      { price: 94000, pips: 380, riskReward: 2.5, probability: 64 },
      { price: 91000, pips: 680, riskReward: 4.5, probability: 46 },
    ],
    stopLoss: 99300,
    stopLossPips: 150,
    confidence: 'MEDIUM',
    confidenceScore: 71,
    status: 'active',
    chartImages: { overview: '', entry: '' },
    strategiesTriggered: [],
    consensus: {
      fathAI_primary: 'SELL',
      fathAI_secondary: 'SELL',
    },
    analysis: 'FATH AI: Resistance zone. Bearish divergence RSI + MACD.',
    createdAt: Date.now() - 4 * 60 * 60 * 1000,
    updatedAt: Date.now(),
    expiresAt: Date.now() + 72 * 60 * 60 * 1000,
  } as unknown as Signal,
];

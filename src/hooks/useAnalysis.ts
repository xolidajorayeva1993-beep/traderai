// ============================================================
// hooks/useAnalysis.ts — Faza 3 texnik analiz hooks
// ============================================================
'use client'

import { useState, useEffect, useCallback } from 'react'
import type { FullAnalysisResult } from '@/lib/analysis'

interface UseAnalysisState {
  data: (FullAnalysisResult & {
    currentPrice: number
    levels: { entry: number; tp1: number; tp2: number; tp3: number; sl: number; rr: number }
  }) | null
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}

interface UseAnalysisOptions {
  timeframe?: '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w'
  limit?: number
  autoRefresh?: boolean
  refreshInterval?: number // milliseconds
}

// ------------------------------------------------------------------
// useAnalysis — bitta juftlik uchun to'liq analiz
// ------------------------------------------------------------------
export function useAnalysis(symbol: string, options: UseAnalysisOptions = {}) {
  const {
    timeframe = '4h',
    limit = 200,
    autoRefresh = false,
    refreshInterval = 5 * 60 * 1000, // 5 daqiqa
  } = options

  const [state, setState] = useState<UseAnalysisState>({
    data: null,
    loading: false,
    error: null,
    lastUpdated: null,
  })

  const fetchAnalysis = useCallback(async () => {
    if (!symbol) return
    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const url = `/api/analysis/${encodeURIComponent(symbol)}?timeframe=${timeframe}&limit=${limit}`
      const res = await fetch(url)

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Network error' }))
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }

      const json = await res.json()
      setState({
        data: json,
        loading: false,
        error: null,
        lastUpdated: new Date(),
      })
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Analysis xatosi',
      }))
    }
  }, [symbol, timeframe, limit])

  useEffect(() => {
    fetchAnalysis()
  }, [fetchAnalysis])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchAnalysis, refreshInterval)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchAnalysis])

  return { ...state, refresh: fetchAnalysis }
}

// ------------------------------------------------------------------
// useMultiAnalysis — bir nechta juftlik uchun parallel analiz
// ------------------------------------------------------------------
export function useMultiAnalysis(
  symbols: string[],
  options: UseAnalysisOptions = {}
) {
  const { timeframe = '4h', limit = 200 } = options
  const [results, setResults] = useState<
    Record<string, UseAnalysisState>
  >({})
  const [allLoading, setAllLoading] = useState(false)

  const fetchAll = useCallback(async () => {
    if (symbols.length === 0) return
    setAllLoading(true)

    setResults(
      symbols.reduce((acc, s) => {
        acc[s] = { data: null, loading: true, error: null, lastUpdated: null }
        return acc
      }, {} as Record<string, UseAnalysisState>)
    )

    const promises = symbols.map(async (symbol) => {
      try {
        const url = `/api/analysis/${encodeURIComponent(symbol)}?timeframe=${timeframe}&limit=${limit}`
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        return { symbol, data: json, error: null }
      } catch (err) {
        return {
          symbol,
          data: null,
          error: err instanceof Error ? err.message : 'Xato',
        }
      }
    })

    const allResults = await Promise.allSettled(promises)
    const newState: Record<string, UseAnalysisState> = {}

    for (const r of allResults) {
      if (r.status === 'fulfilled') {
        const { symbol, data, error } = r.value
        newState[symbol] = {
          data,
          loading: false,
          error,
          lastUpdated: data ? new Date() : null,
        }
      }
    }

    setResults(newState)
    setAllLoading(false)
  }, [symbols.join(','), timeframe, limit])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return { results, allLoading, refreshAll: fetchAll }
}

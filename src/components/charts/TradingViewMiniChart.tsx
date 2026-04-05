'use client';

// ============================================================
// TradingView Mini Chart Widget
// Compact chart for signal cards and market overviews
// ============================================================
import { useEffect, useRef } from 'react';

interface TradingViewMiniChartProps {
  symbol:      string;          // e.g. 'FX:EURUSD' or 'BINANCE:BTCUSDT'
  width?:      number | string;
  height?:     number;
  colorTheme?: 'dark' | 'light';
  isTransparent?: boolean;
  noTimeScale?: boolean;
  locale?:     string;
  dateRange?:  '1D' | '1M' | '3M' | '12M' | '60M' | 'ALL';
  trendLineColor?: string;
  underLineColor?: string;
  underLineBottomColor?: string;
}

export default function TradingViewMiniChart({
  symbol,
  width           = '100%',
  height          = 150,
  colorTheme      = 'dark',
  isTransparent   = true,
  noTimeScale     = true,
  locale          = 'en',
  dateRange       = '1M',
  trendLineColor  = '#00D4AA',
  underLineColor  = 'rgba(0, 212, 170, 0.2)',
  underLineBottomColor = 'rgba(0, 212, 170, 0)',
}: TradingViewMiniChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src   = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol,
      width,
      height,
      locale,
      dateRange,
      colorTheme,
      isTransparent,
      noTimeScale,
      trendLineColor,
      underLineColor,
      underLineBottomColor,
      chartOnly: false,
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [
    symbol, width, height, colorTheme, isTransparent,
    noTimeScale, locale, dateRange,
    trendLineColor, underLineColor, underLineBottomColor,
  ]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{ width: typeof width === 'number' ? `${width}px` : width, height: `${height}px`, overflow: 'hidden' }}
    >
      <div className="tradingview-widget-container__widget" />
    </div>
  );
}

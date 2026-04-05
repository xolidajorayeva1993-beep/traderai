'use client';

import { useEffect, useRef, memo } from 'react';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    TradingView: any;
  }
}

interface TradingViewChartProps {
  symbol?:    string;
  interval?:  string;
  theme?:     'dark' | 'light';
  height?:    number;
  className?: string;
}

function TradingViewChart({
  symbol    = 'FX:EURUSD',
  interval  = '60',
  theme     = 'dark',
  height    = 500,
  className = '',
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef    = useRef<unknown>(null);

  useEffect(() => {
    // Load TradingView script once
    const scriptId = 'tradingview-widget-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    function createWidget() {
      if (!containerRef.current || !window.TradingView) return;
      // Destroy existing widget
      if (widgetRef.current) {
        containerRef.current.innerHTML = '';
        widgetRef.current = null;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      widgetRef.current = new (window.TradingView as any).widget({
        autosize:           true,
        symbol,
        interval,
        timezone:           'Asia/Tashkent',
        theme,
        style:              '1',
        locale:             'uz',
        toolbar_bg:         '#0D0E14',
        enable_publishing:  false,
        allow_symbol_change: true,
        container_id:       containerRef.current.id,
        backgroundColor:    '#07080C',
        gridColor:          'rgba(255,255,255,0.04)',
        hide_side_toolbar:  false,
        studies:            ['RSI@tv-basicstudies', 'MACD@tv-basicstudies', 'BB@tv-basicstudies'],
        show_popup_button:  true,
        popup_width:        '1000',
        popup_height:       '650',
        withdateranges:     true,
        save_image:         false,
        details:            true,
        hotlist:            false,
        calendar:           false,
      });
    }

    if (!script) {
      script = document.createElement('script');
      script.id   = scriptId;
      script.src  = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = createWidget;
      document.head.appendChild(script);
    } else if (window.TradingView) {
      createWidget();
    } else {
      script.addEventListener('load', createWidget);
    }

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = '';
      widgetRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, interval, theme]);

  return (
    <div className={`relative w-full rounded-xl overflow-hidden border border-white/10 ${className}`}
         style={{ height }}>
      <div
        id={`tv_chart_${symbol.replace(/[^a-zA-Z0-9]/g, '_')}`}
        ref={containerRef}
        className="w-full h-full"
      />
      {/* Skeleton loader shown until widget loads */}
      <div className="absolute inset-0 flex items-center justify-center bg-[#07080C] animate-pulse"
           style={{ zIndex: -1 }}>
        <p className="text-white/30 text-sm">Graf yuklanmoqda…</p>
      </div>
    </div>
  );
}

export default memo(TradingViewChart);

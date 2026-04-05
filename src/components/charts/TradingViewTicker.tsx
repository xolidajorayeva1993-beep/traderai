'use client';

// ============================================================
// TradingView Ticker Tape Widget
// Shows live scrolling price bar for multiple symbols
// ============================================================
import { useEffect, useRef } from 'react';

interface TickerSymbol {
  description: string;
  proName:     string;
}

const DEFAULT_SYMBOLS: TickerSymbol[] = [
  { description: 'XAU/USD',   proName: 'TVC:GOLD'           },
  { description: 'EUR/USD',   proName: 'FX:EURUSD'          },
  { description: 'GBP/USD',   proName: 'FX:GBPUSD'          },
  { description: 'USD/JPY',   proName: 'FX:USDJPY'          },
  { description: 'BTC/USDT',  proName: 'BINANCE:BTCUSDT'    },
  { description: 'ETH/USDT',  proName: 'BINANCE:ETHUSDT'    },
  { description: 'S&P 500',   proName: 'SP:SPX'             },
  { description: 'NASDAQ',    proName: 'NASDAQ:NDX'         },
  { description: 'OIL (WTI)', proName: 'TVC:USOIL'          },
  { description: 'XAG/USD',   proName: 'TVC:SILVER'         },
];

interface TradingViewTickerProps {
  symbols?:   TickerSymbol[];
  colorTheme?: 'dark' | 'light';
  isTransparent?: boolean;
  showSymbolLogo?: boolean;
  locale?: string;
}

export default function TradingViewTicker({
  symbols        = DEFAULT_SYMBOLS,
  colorTheme     = 'dark',
  isTransparent  = true,
  showSymbolLogo = true,
  locale         = 'en',
}: TradingViewTickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src   = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols,
      colorTheme,
      isTransparent,
      displayMode:   'adaptive',
      showSymbolLogo,
      locale,
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [colorTheme, isTransparent, locale, showSymbolLogo, symbols]);

  return (
    <div
      className="tradingview-widget-container"
      ref={containerRef}
      style={{ width: '100%', height: 46 }}
    >
      <div className="tradingview-widget-container__widget" />
    </div>
  );
}

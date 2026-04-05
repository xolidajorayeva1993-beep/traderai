'use client';

import { useLivePrices } from '@/hooks/useMarketData';
import type { LivePrice } from '@/types';

const DISPLAY_SYMBOLS = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSDT', 'ETHUSDT', 'USOIL', 'XAGUSD'];

function PriceCell({ p }: { p: LivePrice }) {
  const up = p.change >= 0;
  return (
    <span className="inline-flex items-center gap-2 px-4 border-r border-white/10 shrink-0">
      <span className="text-white/50 text-xs font-mono">{p.symbol}</span>
      <span className="text-white font-mono text-sm font-semibold">
        {p.price < 10 ? p.price.toFixed(5) : p.price < 1000 ? p.price.toFixed(3) : p.price.toLocaleString('en', { maximumFractionDigits: 2 })}
      </span>
      <span className={`text-xs font-mono ${up ? 'text-[#00D4AA]' : 'text-[#FF4D6A]'}`}>
        {up ? '▲' : '▼'} {Math.abs(p.changePercent).toFixed(2)}%
      </span>
    </span>
  );
}

export default function LivePriceTicker() {
  const { data, isLoading } = useLivePrices();

  const prices = (data?.prices ?? []).filter((p) => DISPLAY_SYMBOLS.includes(p.symbol));

  if (isLoading) {
    return (
      <div className="h-9 bg-[#0D0E14] border-b border-white/5 flex items-center px-4">
        <span className="text-white/30 text-xs animate-pulse">Narxlar yuklanmoqda…</span>
      </div>
    );
  }

  // Duplicate for seamless loop
  const doubled = [...prices, ...prices];

  return (
    <div className="h-9 bg-[#0D0E14] border-b border-white/5 overflow-hidden flex items-center relative">
      <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#0D0E14] to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#0D0E14] to-transparent z-10 pointer-events-none" />

      <div className="flex items-center animate-ticker whitespace-nowrap">
        {doubled.map((p, i) => <PriceCell key={`${p.symbol}-${i}`} p={p} />)}
      </div>
    </div>
  );
}

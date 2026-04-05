import { NextResponse } from 'next/server';
import { forexProvider, cryptoProvider } from '@/lib/data';

const FOREX_SYMBOLS  = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'XAGUSD', 'USOIL'];
const CRYPTO_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT'];

export async function GET() {
  try {
    const [forexResults, cryptoResults] = await Promise.allSettled([
      Promise.allSettled(FOREX_SYMBOLS.map((s)  => forexProvider.getPrice(s))),
      Promise.allSettled(CRYPTO_SYMBOLS.map((s) => cryptoProvider.getPrice(s))),
    ]);

    const forex = forexResults.status === 'fulfilled'
      ? forexResults.value.flatMap((r) => r.status === 'fulfilled' ? [r.value] : [])
      : [];

    const crypto = cryptoResults.status === 'fulfilled'
      ? cryptoResults.value.flatMap((r) => r.status === 'fulfilled' ? [r.value] : [])
      : [];

    return NextResponse.json(
      { prices: [...forex, ...crypto], updatedAt: Date.now() },
      { headers: { 'Cache-Control': 's-maxage=10, stale-while-revalidate=5' } }
    );
  } catch (err) {
    console.error('[live prices route]', err);
    return NextResponse.json({ error: 'Narxlar olinmadi' }, { status: 502 });
  }
}

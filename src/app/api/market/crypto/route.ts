import { NextRequest, NextResponse } from 'next/server';
import { BinanceAdapter } from '@/lib/data/BinanceAdapter';

const adapter = new BinanceAdapter();

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const symbol    = (searchParams.get('symbol') ?? 'BTCUSDT').toUpperCase();
  const timeframe = searchParams.get('timeframe') ?? '1h';
  const limit     = Math.min(Number(searchParams.get('limit') ?? '200'), 1000);

  try {
    const [candles, livePrice] = await Promise.all([
      adapter.getOHLCV(symbol, timeframe, limit),
      adapter.getPrice(symbol),
    ]);

    return NextResponse.json({ symbol, timeframe, candles, livePrice }, {
      headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=15' },
    });
  } catch (err) {
    console.error('[crypto route]', err);
    return NextResponse.json({ error: 'Crypto ma\'lumoti olinmadi' }, { status: 502 });
  }
}

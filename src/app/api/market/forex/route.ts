import { NextRequest, NextResponse } from 'next/server';
import { forexProvider } from '@/lib/data';
import { withOHLCVCache } from '@/lib/ohlcvCache';
import { logApiEvent } from '@/lib/apiLogger';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const symbol    = (searchParams.get('symbol') ?? 'EURUSD').toUpperCase();
  const timeframe = searchParams.get('timeframe') ?? '1h';
  const limit     = Math.min(Number(searchParams.get('limit') ?? '200'), 500);

  try {
    const [candles, livePrice] = await Promise.all([
      withOHLCVCache(symbol, timeframe, () =>
        forexProvider.getOHLCV(symbol, timeframe, limit)
      ),
      forexProvider.getPrice(symbol),
    ]);

    return NextResponse.json({ symbol, timeframe, candles, livePrice }, {
      headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=30' },
    });
  } catch (err) {
    console.error('[forex route]', err);
    logApiEvent({
      provider: 'forex-route', action: 'GET', level: 'error',
      message: err instanceof Error ? err.message : String(err),
      symbol, timeframe,
    });
    return NextResponse.json({ error: "Forex ma'lumoti olinmadi" }, { status: 502 });
  }
}

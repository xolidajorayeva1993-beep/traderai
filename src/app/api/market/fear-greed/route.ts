import { NextResponse } from 'next/server';

interface FearGreedResponse {
  name:                string;
  data:                Array<{ value: string; value_classification: string; timestamp: string }>;
  metadata:            { error: null | string };
}

export async function GET() {
  try {
    const res  = await fetch('https://api.alternative.me/fng/?limit=7&format=json', {
      next: { revalidate: 3600 }, // cache 1 soat
    });

    if (!res.ok) throw new Error(`alternative.me ${res.status}`);

    const json: FearGreedResponse = await res.json();

    const items = (json.data ?? []).map((d) => ({
      value:          Number(d.value),
      classification: d.value_classification,
      timestamp:      Number(d.timestamp) * 1000,
    }));

    return NextResponse.json({ items }, {
      headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=300' },
    });
  } catch (err) {
    console.error('[fear-greed route]', err);
    // Fallback neutral value
    return NextResponse.json({
      items: [{ value: 50, classification: 'Neutral', timestamp: Date.now() }],
    });
  }
}

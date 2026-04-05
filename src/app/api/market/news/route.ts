// ============================================================
// CryptoPanic News API Route
// Free tier: 100 req/min, no auth required (public API)
// Env: CRYPTOPANIC_API_KEY (optional — improves results)
// ============================================================
import { NextRequest, NextResponse } from 'next/server';

const BASE_URL = 'https://cryptopanic.com/api/free/v1/posts/';

export interface CryptoNewsItem {
  id:          number;
  title:       string;
  url:         string;
  source:      string;
  publishedAt: string;
  currencies:  string[];
  votes:       { positive: number; negative: number; important: number };
  sentiment:   'positive' | 'negative' | 'neutral';
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const currencies = searchParams.get('currencies') ?? 'BTC,ETH,BNB';
  const filter     = searchParams.get('filter') ?? 'hot';   // hot | rising | bullish | bearish
  const limit      = Math.min(Number(searchParams.get('limit') ?? '20'), 50);

  const apiKey = process.env.CRYPTOPANIC_API_KEY;

  let url = `${BASE_URL}?public=true&filter=${filter}&currencies=${currencies}&limit=${limit}`;
  if (apiKey) url += `&auth_token=${apiKey}`;

  try {
    const res = await fetch(url, {
      next: { revalidate: 300 }, // cache 5 min
      headers: { 'User-Agent': 'TraderAI/1.0' },
    });

    if (res.status === 429) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }
    if (!res.ok) {
      throw new Error(`CryptoPanic API error: ${res.status}`);
    }

    const json = await res.json() as {
      results?: Array<{
        id: number;
        title: string;
        url: string;
        source: { title: string };
        published_at: string;
        currencies?: Array<{ code: string }>;
        votes: { positive: number; negative: number; important: number };
      }>;
    };

    const items: CryptoNewsItem[] = (json.results ?? []).slice(0, limit).map((r) => {
      const pos = r.votes.positive ?? 0;
      const neg = r.votes.negative ?? 0;
      const sentiment: CryptoNewsItem['sentiment'] =
        pos > neg + 2 ? 'positive' : neg > pos + 2 ? 'negative' : 'neutral';

      return {
        id:          r.id,
        title:       r.title,
        url:         r.url,
        source:      r.source?.title ?? 'CryptoPanic',
        publishedAt: r.published_at,
        currencies:  (r.currencies ?? []).map((c) => c.code),
        votes:       r.votes,
        sentiment,
      };
    });

    return NextResponse.json({ items, total: items.length }, {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' },
    });
  } catch (err) {
    console.error('[cryptopanic route]', err);
    return NextResponse.json({ error: 'Kripto yangiliklar olinmadi' }, { status: 502 });
  }
}

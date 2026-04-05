// ============================================================
// Next.js Edge Middleware — Security + Rate Limiting + CORS
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
export const config = {
  matcher: [
    '/api/:path*',
    '/(dashboard)/:path*',
    '/admin/:path*',
  ],
}

// ─── In-memory rate limit store (Edge-compatible sliding window) ─
// Key: ip_window → count
const RATE_MAP = new Map<string, { count: number; resetAt: number }>()

// Per-route limits (requests per window)
const RATE_LIMITS: Record<string, { requests: number; windowMs: number }> = {
  '/api/ai':             { requests: 20,  windowMs: 60_000  }, // 20/min → AI chat
  '/api/signals/analyze':{ requests: 10,  windowMs: 60_000  }, // 10/min → heavy
  '/api/payment':        { requests: 5,   windowMs: 60_000  }, // 5/min  → to'lov
  '/api/pipeline':       { requests: 3,   windowMs: 60_000  }, // 3/min  → scan
  '/api/':               { requests: 120, windowMs: 60_000  }, // 120/min → other API
}

function getRateLimit(pathname: string) {
  for (const [prefix, cfg] of Object.entries(RATE_LIMITS)) {
    if (pathname.startsWith(prefix)) return cfg
  }
  return { requests: 120, windowMs: 60_000 }
}

function getRateLimitKey(ip: string, pathname: string) {
  // Group by route prefix, not exact path
  for (const prefix of Object.keys(RATE_LIMITS)) {
    if (pathname.startsWith(prefix)) return `${ip}:${prefix}`
  }
  return `${ip}:/api/`
}

function checkRateLimit(ip: string, pathname: string): { allowed: boolean; remaining: number; resetAt: number } {
  const cfg    = getRateLimit(pathname)
  const key    = getRateLimitKey(ip, pathname)
  const now    = Date.now()
  const entry  = RATE_MAP.get(key)

  if (!entry || now >= entry.resetAt) {
    RATE_MAP.set(key, { count: 1, resetAt: now + cfg.windowMs })
    return { allowed: true, remaining: cfg.requests - 1, resetAt: now + cfg.windowMs }
  }

  entry.count++
  RATE_MAP.set(key, entry)
  const remaining = Math.max(0, cfg.requests - entry.count)
  return { allowed: entry.count <= cfg.requests, remaining, resetAt: entry.resetAt }
}

// ─── CORS allowed origins ──────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://traderai.uz',
  'https://www.traderai.uz',
  'https://traderai-fath.web.app',
  'http://localhost:3000',
  'http://localhost:3001',
]

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
}

// ─── Security headers applied to all responses ─────────────────
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

export function proxy(req: NextRequest) {
  const { pathname }  = req.nextUrl
  const origin        = req.headers.get('origin')
  const method        = req.method

  // ── Preflight CORS request ───────────────────────────────────
  if (method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: { ...corsHeaders(origin), 'Content-Length': '0' },
    })
  }

  // ── API routes: rate limit + CORS + security ─────────────────
  if (pathname.startsWith('/api/')) {
    // Get real IP (Cloudflare / Vercel / direct)
    const ip = (
      req.headers.get('cf-connecting-ip') ??
      req.headers.get('x-real-ip') ??
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      '0.0.0.0'
    )

    // Skip rate limiting for admin + payme (server-to-server callback)
    const skipRL = pathname.startsWith('/api/admin') || pathname.startsWith('/api/payment/payme')
    let rlHeaders: Record<string, string> = {}

    if (!skipRL) {
      const { allowed, remaining, resetAt } = checkRateLimit(ip, pathname)
      rlHeaders = {
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
      }

      if (!allowed) {
        return NextResponse.json(
          { error: "Juda ko'p so'rov yuborildi. Biroz kuting." },
          {
            status: 429,
            headers: {
              ...corsHeaders(origin),
              ...SECURITY_HEADERS,
              ...rlHeaders,
              'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
            },
          }
        )
      }
    }

    const res = NextResponse.next()
    Object.entries({ ...corsHeaders(origin), ...SECURITY_HEADERS, ...rlHeaders }).forEach(
      ([k, v]) => res.headers.set(k, v)
    )
    return res
  }

  // ── Dashboard + Admin: auth cookie check ─────────────────────
  if (pathname.startsWith('/admin')) {
    const token = req.cookies.get('__auth')?.value
    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
  }

  // ── Apply security headers to all other pages ─────────────────
  const res = NextResponse.next()
  Object.entries(SECURITY_HEADERS).forEach(([k, v]) => res.headers.set(k, v))
  return res
}

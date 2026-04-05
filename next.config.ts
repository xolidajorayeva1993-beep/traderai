import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin must be external (not bundled) — Turbopack externalizes it as
  // 'firebase-admin-a14c8a5423a75469'. We add that name as an npm alias in package.json
  // so the Cloud Function can find it at runtime.
  serverExternalPackages: [
    'firebase-admin',
    'firebase-admin/app',
    'firebase-admin/auth',
    'firebase-admin/firestore',
    'firebase-admin/messaging',
    'firebase-admin/storage',
    '@google-cloud/firestore',
    '@google-cloud/storage',
  ],

  // Firebase SDK v12 + React 19 StrictMode incompatibility:
  // StrictMode double-invokes effects → onSnapshot/onAuthStateChanged register twice
  // → Firestore internal state assertion error. Disable StrictMode as workaround.
  reactStrictMode: false,

  // ─── Compression ──────────────────────────────────────────────
  compress: true,

  // ─── Image optimization ───────────────────────────────────────
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 3600,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },

  // ─── HTTP security + cache headers ───────────────────────────
  async headers() {
    return [
      // PWA assets
      {
        source: '/manifest.json',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' }],
      },
      {
        source: '/icons/(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, immutable' }],
      },
      // API routes: no cache by default
      {
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
      // Pages: security headers
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options',  value: 'nosniff' },
          { key: 'X-XSS-Protection',         value: '1; mode=block' },
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.tradingview.com https://*.firebaseapp.com https://accounts.google.com https://s3.tradingview.com",
              "script-src-elem 'self' 'unsafe-inline' https://accounts.google.com https://*.google.com https://www.tradingview.com https://*.firebaseapp.com https://s3.tradingview.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https: http:",
              "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://firestore.googleapis.com wss://*.firebaseio.com https://api.openai.com https://openrouter.ai https://*.binance.com https://*.oanda.com https://accounts.google.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com",
              "frame-src https://www.tradingview.com https://*.tradingview.com https://accounts.google.com https://*.google.com https://*.firebaseapp.com",
              "media-src 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },

};

export default nextConfig;


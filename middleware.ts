// ============================================================
// Next.js Middleware — minimal, cookie-free route protection
// Dashboard auth is handled client-side via Firebase Auth SDK
// ============================================================
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only redirect already-authenticated users away from auth pages
  // (best-effort: uses __auth cookie set after successful login)
  const authFlag = request.cookies.get('__auth')?.value;
  if (authFlag && AUTH_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|api/public).*)',
  ],
};

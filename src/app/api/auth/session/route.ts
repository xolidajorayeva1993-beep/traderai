import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/auth/session
 * Body: { idToken: string }
 * Sets HttpOnly session cookie (7 days).
 *
 * NOTE: This route uses Firebase Admin SDK to verify the ID token
 * and create a session cookie. Firebase Admin must be initialised
 * via environment variable FIREBASE_SERVICE_ACCOUNT_JSON.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { idToken?: unknown };
    const idToken = typeof body.idToken === 'string' ? body.idToken : null;

    if (!idToken) {
      return NextResponse.json({ error: 'idToken majburiy' }, { status: 400 });
    }

    // Lazy-load Firebase Admin to avoid build errors when env is missing
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
      return NextResponse.json({ error: 'Admin SDK sozlanmagan' }, { status: 503 });
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
      });
    }

    const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
    const sessionCookie: string = await admin.auth().createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });

    const response = NextResponse.json({ status: 'ok' });
    response.cookies.set('__session', sessionCookie, {
      httpOnly:  true,
      secure:    process.env.NODE_ENV === 'production',
      sameSite:  'strict',
      maxAge:    SESSION_DURATION_MS / 1000,
      path:      '/',
    });

    return response;
  } catch (err) {
    console.error('[session POST]', err);
    return NextResponse.json({ error: 'Session yaratib bo\'lmadi' }, { status: 401 });
  }
}

/** DELETE /api/auth/session — logout: clear cookie */
export async function DELETE() {
  const response = NextResponse.json({ status: 'ok' });
  response.cookies.set('__session', '', { maxAge: 0, path: '/' });
  return response;
}

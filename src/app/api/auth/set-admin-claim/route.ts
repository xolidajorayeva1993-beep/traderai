import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/auth/set-admin-claim
 * Body: { uid: string }
 * Headers: Authorization: Bearer <admin-idToken>
 *
 * Sets custom claim { admin: true } on the target user.
 * Only callable by an already-admin user (or super-admin env variable).
 */
export async function POST(req: NextRequest) {
  try {
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

    // Verify caller is an admin
    const authHeader = req.headers.get('Authorization') ?? '';
    const callerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!callerToken) {
      return NextResponse.json({ error: 'Avtorizatsiya talab qilinadi' }, { status: 401 });
    }

    const decoded = await admin.auth().verifyIdToken(callerToken);
    if (!decoded.admin && decoded.uid !== process.env.SUPER_ADMIN_UID) {
      return NextResponse.json({ error: 'Ruxsat yo\'q' }, { status: 403 });
    }

    // Get target UID
    const body = await req.json() as { uid?: unknown };
    const targetUid = typeof body.uid === 'string' ? body.uid : null;
    if (!targetUid) {
      return NextResponse.json({ error: 'uid majburiy' }, { status: 400 });
    }

    await admin.auth().setCustomUserClaims(targetUid, { admin: true });

    return NextResponse.json({ status: 'ok', uid: targetUid, claim: 'admin' });
  } catch (err) {
    console.error('[set-admin-claim POST]', err);
    return NextResponse.json({ error: 'Custom claim o\'rnatib bo\'lmadi' }, { status: 500 });
  }
}

/**
 * DELETE /api/auth/set-admin-claim
 * Body: { uid: string }
 * Removes admin claim from target user.
 */
export async function DELETE(req: NextRequest) {
  try {
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

    const authHeader = req.headers.get('Authorization') ?? '';
    const callerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!callerToken) {
      return NextResponse.json({ error: 'Avtorizatsiya talab qilinadi' }, { status: 401 });
    }

    const decoded = await admin.auth().verifyIdToken(callerToken);
    if (!decoded.admin && decoded.uid !== process.env.SUPER_ADMIN_UID) {
      return NextResponse.json({ error: 'Ruxsat yo\'q' }, { status: 403 });
    }

    const body = await req.json() as { uid?: unknown };
    const targetUid = typeof body.uid === 'string' ? body.uid : null;
    if (!targetUid) {
      return NextResponse.json({ error: 'uid majburiy' }, { status: 400 });
    }

    await admin.auth().setCustomUserClaims(targetUid, { admin: false });

    return NextResponse.json({ status: 'ok', uid: targetUid, claim: 'removed' });
  } catch (err) {
    console.error('[set-admin-claim DELETE]', err);
    return NextResponse.json({ error: 'Claim olib tashlab bo\'lmadi' }, { status: 500 });
  }
}

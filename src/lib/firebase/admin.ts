// ============================================================
// Firebase Admin SDK — server-side only
// Used in API routes and Cloud Functions
// ============================================================
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';

let adminApp: App | null = null;

/**
 * Initialize Firebase Admin SDK (singleton).
 * Uses FIREBASE_SERVICE_ACCOUNT_JSON env var (JSON string) or
 * falls back to Application Default Credentials (in Cloud environments).
 */
export function initAdmin(): App {
  if (adminApp) return adminApp;
  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const clientEmail  = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey   = process.env.FIREBASE_PRIVATE_KEY;
  const projectId    = process.env.FIREBASE_PROJECT_ID
                    || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (serviceAccountJson) {
    // To'liq JSON (bitta env var)
    const serviceAccount = JSON.parse(serviceAccountJson);
    adminApp = initializeApp({ credential: cert(serviceAccount), storageBucket });
  } else if (clientEmail && privateKey && projectId) {
    // Uchta alohida env var
    adminApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        // .env.local da \n escaped bo'ladi — haqiqiy newline ga aylantiramiz
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
      storageBucket,
    });
  } else {
    // Application Default Credentials (Cloud Run, Firebase Hosting)
    adminApp = initializeApp();
  }

  return adminApp;
}

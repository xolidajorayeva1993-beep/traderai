import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getDatabase, type Database } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  // Only include databaseURL when it is explicitly set — avoids getDatabase() crash
  ...(process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
    ? { databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL }
    : {}),
};

// Only initialize when API key is present (avoids build-time errors with missing .env)
function getFirebaseApp(): FirebaseApp | null {
  if (!firebaseConfig.apiKey) return null;
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
}

const app = getFirebaseApp();

// Export null-safe instances — callers must be client-side ('use client')
export const auth: Auth = app ? getAuth(app) : (null as unknown as Auth);
export const db: Firestore = app ? getFirestore(app) : (null as unknown as Firestore);
export const storage: FirebaseStorage = app ? getStorage(app) : (null as unknown as FirebaseStorage);
// rtdb is only available when databaseURL is configured
export const rtdb: Database = (app && process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL)
  ? getDatabase(app)
  : (null as unknown as Database);
export default app;


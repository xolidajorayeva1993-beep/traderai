// ============================================================
// Firebase Auth helpers
// ============================================================
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from './config';
import { setUser, getUser } from './firestore';
import { Timestamp } from 'firebase/firestore';
import type { UserProfile } from '@/types';

const googleProvider = new GoogleAuthProvider();

// ─── Sign in ───────────────────────────────────────────────────
export const signInEmail = (email: string, password: string) => {
  if (!auth) throw new Error('Firebase not configured. Add .env.local with Firebase credentials.');
  return signInWithEmailAndPassword(auth, email, password);
};

export const signInGoogle = () => {
  if (!auth) throw new Error('Firebase not configured. Add .env.local with Firebase credentials.');
  return signInWithPopup(auth, googleProvider);
};

// ─── Sign up ───────────────────────────────────────────────────
export async function signUpEmail(email: string, password: string, displayName: string) {
  if (!auth) throw new Error('Firebase not configured. Add .env.local with Firebase credentials.');
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  await createUserProfile(cred.user, displayName);
  return cred;
}

// ─── Create Firestore profile on first sign in ─────────────────
export async function createUserProfile(user: User, displayName?: string) {
  const existing = await getUser(user.uid);
  if (existing) return existing;

  const profile: UserProfile = {
    uid: user.uid,
    email: user.email!,
    displayName: displayName ?? user.displayName ?? 'Trader',
    photoURL: user.photoURL,
    role: 'free',
    plan: 'free',
    planExpiresAt: null,
    trialEndsAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    createdAt: Date.now(),
    lastSeen: Date.now(),
    isActive: true,
    referralCode: generateReferralCode(user.uid),
  };
  await setUser(user.uid, profile as unknown as Parameters<typeof setUser>[1]);
  return profile;
}

// ─── Sign out ──────────────────────────────────────────────────
export const logOut = async () => {
  if (typeof document !== 'undefined') {
    document.cookie = '__auth=; path=/; max-age=0; SameSite=Strict';
  }
  if (!auth) return Promise.resolve();
  return signOut(auth);
};

// ─── Password reset ────────────────────────────────────────────
export const resetPassword = (email: string) => {
  if (!auth) throw new Error('Firebase not configured. Add .env.local with Firebase credentials.');
  return sendPasswordResetEmail(auth, email);
};

// ─── Auth state observer ───────────────────────────────────────
export const onAuthChange = (cb: (user: User | null) => void) => {
  // auth is null when Firebase env vars are missing — return no-op unsubscribe
  if (!auth) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth, cb);
};

// ─── Helpers ───────────────────────────────────────────────────
function generateReferralCode(uid: string): string {
  return 'TAI-' + uid.slice(0, 8).toUpperCase();
}

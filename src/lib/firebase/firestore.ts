// ============================================================
// Firestore collection helpers — typed wrappers
// ============================================================
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  type QueryConstraint,
  type DocumentData,
  type WithFieldValue,
} from 'firebase/firestore';
import { db } from './config';
import type { UserProfile, Signal, Strategy, AIPrompt } from '@/types';

// ─── Collection paths ──────────────────────────────────────────
export const COLLECTIONS = {
  USERS: 'users',
  SIGNALS: 'signals',
  STRATEGIES: 'strategies',
  MARKET_CACHE: 'market_cache',
  SUBSCRIPTIONS: 'subscriptions',
  PROMPTS: 'prompts',
  NOTIFICATIONS: 'notifications',
  PLANS: 'plans',
} as const;

// ─── Generic helpers ───────────────────────────────────────────
export async function getDocument<T extends DocumentData>(
  collectionName: string,
  id: string
): Promise<T | null> {
  const snap = await getDoc(doc(db, collectionName, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as unknown as T) : null;
}

export async function setDocument<T extends DocumentData>(
  collectionName: string,
  id: string,
  data: WithFieldValue<T>
): Promise<void> {
  await setDoc(doc(db, collectionName, id), data);
}

export async function updateDocument(
  collectionName: string,
  id: string,
  data: Partial<DocumentData>
): Promise<void> {
  await updateDoc(doc(db, collectionName, id), data);
}

export async function deleteDocument(collectionName: string, id: string): Promise<void> {
  await deleteDoc(doc(db, collectionName, id));
}

export async function queryDocuments<T extends DocumentData>(
  collectionName: string,
  constraints: QueryConstraint[]
): Promise<T[]> {
  const q = query(collection(db, collectionName), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as T));
}

// ─── User helpers ──────────────────────────────────────────────
export const getUser = (uid: string) => getDocument<UserProfile>(COLLECTIONS.USERS, uid);
export const setUser = (uid: string, data: WithFieldValue<UserProfile>) =>
  setDocument<UserProfile>(COLLECTIONS.USERS, uid, data);

// ─── Signal helpers ─────────────────────────────────────────────
export const getActiveSignals = (maxCount = 20) =>
  queryDocuments<Signal>(COLLECTIONS.SIGNALS, [
    where('status', '==', 'active'),
    orderBy('createdAt', 'desc'),
    limit(maxCount),
  ]);

export const getSignalsByPair = (pair: string, maxCount = 10) =>
  queryDocuments<Signal>(COLLECTIONS.SIGNALS, [
    where('pair', '==', pair),
    orderBy('createdAt', 'desc'),
    limit(maxCount),
  ]);

// ─── Strategy helpers ───────────────────────────────────────────
export const getActiveStrategies = () =>
  queryDocuments<Strategy>(COLLECTIONS.STRATEGIES, [
    where('isActive', '==', true),
    orderBy('weight', 'desc'),
  ]);

// ─── Prompt helpers ─────────────────────────────────────────────
export const getActivePrompts = () =>
  queryDocuments<AIPrompt>(COLLECTIONS.PROMPTS, [where('isActive', '==', true)]);

// ─── Realtime listener helper ───────────────────────────────────
export function subscribeToSignals(
  callback: (signals: Signal[]) => void,
  maxCount = 20
) {
  const q = query(
    collection(db, COLLECTIONS.SIGNALS),
    where('status', '==', 'active'),
    orderBy('createdAt', 'desc'),
    limit(maxCount)
  );
  return onSnapshot(q, (snap) => {
    const signals = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Signal));
    callback(signals);
  });
}

export { Timestamp };

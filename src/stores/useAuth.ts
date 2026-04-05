// ============================================================
// useAuth — Zustand store for Firebase auth state
// ============================================================
'use client';
import { create } from 'zustand';
import { onAuthChange, createUserProfile } from '@/lib/firebase/auth';
import { getUser } from '@/lib/firebase/firestore';
import { getAuth } from 'firebase/auth';
import type { AuthState, UserProfile } from '@/types';

interface AuthStore extends AuthState {
  setUser: (user: UserProfile | null) => void;
  init: () => () => void;
  refreshUser: () => Promise<void>;
}

export const useAuth = create<AuthStore>((set) => ({
  user: null,
  loading: true,
  initialized: false,

  setUser: (user) => set({ user }),

  refreshUser: async () => {
    const { user } = useAuth.getState();
    if (!user?.uid) return;
    try {
      // Use server-side Admin SDK fetch to bypass Firestore client cache
      const firebaseUser = getAuth().currentUser;
      if (!firebaseUser) return;
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) return;
      const fresh = await res.json();
      set(state => ({
        user: state.user ? {
          ...state.user,
          plan: fresh.plan ?? state.user.plan,
          role: fresh.role ?? state.user.role,
          planExpiresAt: fresh.planExpiresAt ?? state.user.planExpiresAt,
        } : state.user,
      }));
    } catch { /* ignore */ }
  },

  init: () => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (!firebaseUser) {
        set({ user: null, loading: false, initialized: true });
        return;
      }

      try {
        // Try to get existing profile from Firestore
        let profile = await getUser(firebaseUser.uid);

        // First time Google sign-in: create profile
        if (!profile) {
          profile = await createUserProfile(firebaseUser);
        } else {
          // Update lastSeen
          profile.lastSeen = Date.now();
        }

        set({ user: profile, loading: false, initialized: true });
      } catch {
        // Still set user with basic info on Firestore failure
        set({
          user: {
            uid: firebaseUser.uid,
            email: firebaseUser.email ?? '',
            displayName: firebaseUser.displayName ?? 'Trader',
            photoURL: firebaseUser.photoURL,
            role: 'free',
            plan: 'free',
            planExpiresAt: null,
            trialEndsAt: null,
            createdAt: Date.now(),
            lastSeen: Date.now(),
            isActive: true,
            referralCode: 'TAI-' + firebaseUser.uid.slice(0, 8).toUpperCase(),
          },
          loading: false,
          initialized: true,
        });
      }
    });

    return unsubscribe;
  },
}));

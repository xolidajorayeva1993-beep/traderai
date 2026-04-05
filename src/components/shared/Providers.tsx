// ============================================================
// Providers — wraps app with TanStack Query, Zustand init
// ============================================================
'use client';
import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@/stores/useAuth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 2,
    },
  },
});

function AuthInit() {
  const init = useAuth((s) => s.init);
  useEffect(() => {
    const unsubscribe = init();
    return unsubscribe;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthInit />
      {children}
    </QueryClientProvider>
  );
}

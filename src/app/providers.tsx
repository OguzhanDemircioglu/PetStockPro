'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

/**
 * TanStack Query Provider — PLAN-BETA-PERFORMANCE FAZ 4.
 *
 * Client component'lerde `useQuery` + `useMutation` ile optimistic UI
 * pattern'i devreye girer (FAZ 5 — 5 kritik CRUD).
 *
 * Default options:
 *   - staleTime: 30s — kısa süreli cache, tab focus refetch'i tetikler
 *   - refetchOnWindowFocus: true (default) — concurrent edit yumuşatma
 *   - retry: queries=1, mutations=0 (UI rollback toast üzerinden tekrar)
 *
 * Devtools: NODE_ENV='development' iken sağ alt köşede, production'da yok.
 *
 * Singleton-per-render — `useState(() => new QueryClient(...))` her mount'ta
 * tek client; HMR / Strict Mode double-render güvenli.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: true,
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      {process.env.NODE_ENV !== 'production' && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  );
}

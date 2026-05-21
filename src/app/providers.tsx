'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

/**
 * TanStack Query Provider — PLAN-BETA-PERFORMANCE FAZ 4 + Tur 14 (P2-5).
 *
 * Client component'lerde `useQuery` + `useMutation` ile optimistic UI
 * pattern'i devreye girer (FAZ 5 — 5 kritik CRUD).
 *
 * Default options (Tur 14 P2-5 — refetch tuning):
 *   - staleTime: 60s — orta vadede taze, dakikalık tab switch refetch yok
 *   - refetchOnWindowFocus: false — NotificationBell cache-reactive zaten,
 *     genel refetch trafik spike yapar (1K user × tab focus = burst)
 *   - refetchOnReconnect: true — network kesintisi sonrası taze veri OK
 *   - retry: queries=1, mutations=0 (UI rollback toast üzerinden tekrar)
 *
 * Specific query'ler kendi staleTime / refetchOnWindowFocus override edebilir
 * (e.g. notif feed manuel refresh isteyenler için).
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
            staleTime: 60_000, // 60s — was 30s; tab switch refetch agresifliği azaldı
            refetchOnWindowFocus: false, // Tur 14: cache-reactive bell + setQueryData yeterli
            refetchOnReconnect: true,
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

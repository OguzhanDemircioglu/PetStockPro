'use client';

import Link from 'next/link';
import { useEffect, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { notificationKeys } from '@/lib/queries/keys';

// Layout SSR'da güncel sayıyı prop olarak verir; bulk "Tümünü oku" + tek satır
// mark-read mutation'ları setQueryData ile cache'i günceller → bell anında flip.
export function NotificationBell({ unreadCount: serverCount }: { unreadCount: number }) {
  const queryClient = useQueryClient();

  // Layout yeni SSR'de farklı prop gönderirse cache'i taze değere senkronla.
  useEffect(() => {
    queryClient.setQueryData<number>(notificationKeys.unreadCount(), serverCount);
  }, [serverCount, queryClient]);

  // 2026-05-22 Tur 7 YT7-9: cache.subscribe global → notification key filtre.
  // Önceki: tüm cache event'leri (product/stock/audit/notification 5+ query)
  // bell'i re-render ediyordu (pano açıkken excessive). Şimdi sadece
  // 'notifications' namespace cache değişiklikleri tetikler.
  const cache = queryClient.getQueryCache();
  const unreadCount = useSyncExternalStore(
    (notify) =>
      cache.subscribe((event) => {
        if (event.query.queryKey[0] === 'notifications') notify();
      }),
    () =>
      queryClient.getQueryData<number>(notificationKeys.unreadCount()) ?? serverCount,
    () => serverCount,
  );

  return (
    <Link
      href={'/admin/notifications' as never}
      data-notif-bell
      data-unread-count={unreadCount}
      aria-label={`Bildirimler${unreadCount > 0 ? ` (${unreadCount} okunmamış)` : ''}`}
      className="relative grid h-9 w-9 place-items-center rounded-xl border border-line bg-paper text-lg hover:bg-cat-soft"
    >
      🔔
      {unreadCount > 0 && (
        <span
          data-notif-badge
          className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-cat px-1 py-0.5 text-center text-[11.5px] font-bold leading-none text-white"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
}

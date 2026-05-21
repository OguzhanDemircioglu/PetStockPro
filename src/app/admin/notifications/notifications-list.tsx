'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NotificationRow } from '@/lib/notifications/manage';
import { notificationKeys } from '@/lib/queries/keys';
import { PetSpinner } from '@/components/ui/pet-spinner';
import { markAsReadAction, markAllAsReadAction } from './actions';

interface Props {
  initialItems: NotificationRow[];
  unreadOnly: boolean;
  typeEmoji: Record<string, string>;
  typeLabel: Record<string, string>;
}

/**
 * NotificationsList — FAZ 5.5 optimistic read.
 *
 * Mutation pattern:
 *   - Tıklanan satır onMutate → readAt = now (optimistic UI)
 *   - Bulk Tümünü oku → tüm liste readAt = now
 *   - Error → rollback + alert (basit, toast yok)
 *   - Settled → invalidate (server kaynak hatası varsa düzeltir)
 *
 * Bell badge için ayrı queryClient.setQueryData(notificationKeys.unreadCount, ...)
 * çağrılır — page'ta SSR initial sayı + tab'da bell yine güncel.
 */
export function NotificationsList({
  initialItems,
  unreadOnly,
  typeEmoji,
  typeLabel,
}: Props) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState(initialItems);

  const unreadCount = useMemo(
    () => items.filter((i) => i.readAt === null).length,
    [items],
  );

  const markOneMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await markAsReadAction(notificationId);
    },
    onMutate: async (notificationId) => {
      const previous = items;
      const now = new Date();
      setItems((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, readAt: now } : n)),
      );
      // Bell badge: count - 1
      queryClient.setQueryData<number>(
        notificationKeys.unreadCount(),
        (old) => Math.max(0, (old ?? unreadCount) - 1),
      );
      return { previous };
    },
    onError: (err, _id, ctx) => {
      if (ctx) setItems(ctx.previous);
      queryClient.setQueryData<number>(
        notificationKeys.unreadCount(),
        (old) => (old ?? 0) + 1,
      );
      alert('Okundu işaretlenemedi — tekrar dene.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: async () => {
      await markAllAsReadAction();
    },
    onMutate: async () => {
      const previous = items;
      const now = new Date();
      setItems((prev) =>
        prev.map((n) => (n.readAt === null ? { ...n, readAt: now } : n)),
      );
      queryClient.setQueryData<number>(notificationKeys.unreadCount(), 0);
      return { previous };
    },
    onError: (err, _v, ctx) => {
      if (ctx) setItems(ctx.previous);
      alert('Tümünü okundu işaretleme başarısız.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });

  // Unread-only filtre client-side filtreleme (server-side initial yapıldı,
  // mutation sonrası listeden anında çıkar).
  const displayed = unreadOnly ? items.filter((i) => i.readAt === null) : items;

  return (
    <>
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[13px] font-bold uppercase tracking-wider text-cat">
            Admin · Bildirimler
          </div>
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
            Bildirimler
          </h1>
          <p className="mt-1 text-sm text-ink-3" data-notif-header-count>
            {unreadOnly
              ? `${displayed.length} okunmamış bildirim`
              : `${displayed.length} bildirim · ${unreadCount} okunmamış`}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            data-action="mark-all-read"
            disabled={markAllMutation.isPending}
            onClick={() => markAllMutation.mutate()}
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-4 py-2 text-xs font-bold text-ink-2 hover:bg-line-soft disabled:opacity-50"
          >
            {markAllMutation.isPending ? (
              <PetSpinner size="sm" inline tone="cat" label="İşleniyor" />
            ) : (
              '✓'
            )}{' '}
            Tümünü okundu işaretle
          </button>
        )}
      </header>

      {displayed.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-line bg-paper py-16 text-center">
          <div className="text-6xl">🔔</div>
          <h2 className="mt-4 text-xl font-bold text-cart">
            {unreadOnly ? 'Okunmamış bildirim yok' : 'Henüz bildirim yok'}
          </h2>
          <p className="mt-2 text-sm text-ink-3">
            Sayım tamamlama, stok 0, abonelik gibi olaylar burada görünecek.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="notif-list">
          {displayed.map((n) => (
            <NotificationItem
              key={n.id}
              item={n}
              emoji={n.content.emoji ?? typeEmoji[n.type] ?? '🔔'}
              typeLabel={typeLabel[n.type] ?? n.type}
              onMarkRead={() => markOneMutation.mutate(n.id)}
              isPending={markOneMutation.isPending && markOneMutation.variables === n.id}
            />
          ))}
        </ul>
      )}
    </>
  );
}

function NotificationItem({
  item,
  emoji,
  typeLabel,
  onMarkRead,
  isPending,
}: {
  item: NotificationRow;
  emoji: string;
  typeLabel: string;
  onMarkRead: () => void;
  isPending: boolean;
}) {
  const isUnread = item.readAt === null;
  const link = item.content.link;

  return (
    <li
      data-notification-id={item.id}
      data-unread={isUnread ? '1' : '0'}
      className={`flex items-start gap-3 rounded-2xl border p-4 transition-colors ${
        isUnread ? 'border-cat/40 bg-cat-soft/30' : 'border-line bg-paper opacity-80'
      }`}
    >
      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-paper text-xl">
        {emoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-bold text-cart">{item.content.title}</h3>
          {isUnread && (
            <span className="rounded-full bg-cat px-1.5 py-0.5 text-[10.5px] font-bold text-white">
              YENİ
            </span>
          )}
        </div>
        {item.content.body && (
          <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{item.content.body}</p>
        )}
        <div className="mt-1 flex items-center gap-3 text-[12px] text-ink-3">
          <span>{typeLabel}</span>
          <span>·</span>
          <time>
            {new Date(item.createdAt).toLocaleString('tr-TR', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </time>
          {link && (
            <Link href={link as never} className="text-cat hover:underline">
              Gör →
            </Link>
          )}
        </div>
      </div>
      {isUnread && (
        <button
          type="button"
          onClick={onMarkRead}
          disabled={isPending}
          data-action="mark-read"
          aria-label="Okundu işaretle"
          className="inline-flex items-center justify-center rounded-lg border border-line bg-paper px-2 py-1 text-[11.5px] font-bold text-ink-3 hover:bg-line-soft disabled:opacity-50"
        >
          {isPending ? (
            <PetSpinner size="sm" inline tone="cat" label="İşleniyor" />
          ) : (
            '✓'
          )}
        </button>
      )}
    </li>
  );
}

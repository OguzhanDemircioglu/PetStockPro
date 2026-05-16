import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { listForUser, type NotificationRow } from '@/lib/notifications/manage';
import { markAsReadAction, markAllAsReadAction } from './actions';

const TYPE_EMOJI: Record<string, string> = {
  low_stock_critical: '⚠',
  out_of_stock: '🔴',
  high_sale: '🚀',
  new_user: '👤',
  plan_limit_warning: '📊',
  daily_summary: '📰',
  weekly_summary: '📰',
  transfer_received: '🔁',
  stocktake_completed: '✅',
  superadmin_session: '🛡',
  subscription_payment_failed: '💳',
  subscription_renewed: '💚',
  invoice_issued: '🧾',
  vitrin_approved: '🌐',
  vitrin_report_received: '🚨',
  vitrin_auto_unpublished: '🔒',
};

const TYPE_LABEL: Record<string, string> = {
  low_stock_critical: 'Düşük stok kritik',
  out_of_stock: 'Stok bitti',
  high_sale: 'Yüksek satış',
  new_user: 'Yeni kullanıcı',
  plan_limit_warning: 'Plan limit uyarısı',
  daily_summary: 'Günlük özet',
  weekly_summary: 'Haftalık özet',
  transfer_received: 'Transfer alındı',
  stocktake_completed: 'Sayım tamamlandı',
  superadmin_session: 'Süperadmin oturumu',
  subscription_payment_failed: 'Ödeme başarısız',
  subscription_renewed: 'Abonelik yenilendi',
  invoice_issued: 'Fatura kesildi',
  vitrin_approved: 'Vitrin onaylandı',
  vitrin_report_received: 'Vitrin şikayeti',
  vitrin_auto_unpublished: 'Vitrin otomatik kapatıldı',
};

const TYPE_GROUPS: Record<string, { label: string; types: string[] }> = {
  stock: {
    label: '📦 Stok',
    types: ['low_stock_critical', 'out_of_stock', 'high_sale', 'transfer_received'],
  },
  stocktake: {
    label: '📋 Sayım',
    types: ['stocktake_completed'],
  },
  vitrin: {
    label: '🌐 Vitrin',
    types: ['vitrin_approved', 'vitrin_auto_unpublished', 'vitrin_report_received'],
  },
  billing: {
    label: '💳 Abonelik',
    types: ['subscription_payment_failed', 'subscription_renewed', 'invoice_issued', 'plan_limit_warning'],
  },
  system: {
    label: '⚙ Sistem',
    types: ['new_user', 'daily_summary', 'weekly_summary', 'superadmin_session'],
  },
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; group?: string; type?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) redirect('/login' as never);

  const params = await searchParams;
  const unreadOnly = params.filter === 'unread';
  const activeGroup = params.group && TYPE_GROUPS[params.group] ? params.group : null;
  // Fine-grain: ?type=<exact> param. Grup seçili olmasa bile çalışır,
  // ama UI'da chip'ler sadece aktif grup içinde gösterilir (sade tut).
  const activeType =
    params.type && Object.keys(TYPE_LABEL).includes(params.type) ? params.type : null;

  const allItems = await listForUser(session.user.companyId, session.user.id, db, {
    limit: 100,
    unreadOnly,
  });

  // Filtre öncelik sırası: type > group > all
  const items = activeType
    ? allItems.filter((i) => i.type === activeType)
    : activeGroup
      ? allItems.filter((i) => TYPE_GROUPS[activeGroup].types.includes(i.type))
      : allItems;

  const unreadCount = allItems.filter((i) => i.readAt === null).length;

  // Group başına count (filter UI badge'i için)
  const groupCounts: Record<string, number> = {};
  for (const [key, def] of Object.entries(TYPE_GROUPS)) {
    groupCounts[key] = allItems.filter((i) => def.types.includes(i.type)).length;
  }

  // Type başına count (sadece aktif grup için)
  const typeCounts: Record<string, number> = {};
  if (activeGroup) {
    for (const t of TYPE_GROUPS[activeGroup].types) {
      typeCounts[t] = allItems.filter((i) => i.type === t).length;
    }
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[11.5px] font-bold uppercase tracking-wider text-cat">
            Admin · Bildirimler
          </div>
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
            Bildirimler
          </h1>
          <p className="mt-1 text-sm text-ink-3">
            {unreadOnly
              ? `${items.length} okunmamış bildirim`
              : `${items.length} bildirim · ${unreadCount} okunmamış`}
          </p>
        </div>
        {unreadCount > 0 && (
          <form action={markAllAsReadAction}>
            <button
              type="submit"
              data-action="mark-all-read"
              className="rounded-xl border border-line bg-white px-4 py-2 text-xs font-bold text-ink-2 hover:bg-line-soft"
            >
              ✓ Tümünü okundu işaretle
            </button>
          </form>
        )}
      </header>

      <div className="flex flex-col gap-2" data-testid="notif-filter">
        <div className="flex gap-2">
          <Link
            href={'/admin/notifications' as never}
            className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${
              !unreadOnly
                ? 'border-cat bg-cat text-white'
                : 'border-line bg-white text-ink-3 hover:bg-line-soft'
            }`}
          >
            Hepsi
          </Link>
          <Link
            href={'/admin/notifications?filter=unread' as never}
            className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${
              unreadOnly
                ? 'border-cat bg-cat text-white'
                : 'border-line bg-white text-ink-3 hover:bg-line-soft'
            }`}
          >
            Okunmamış ({unreadCount})
          </Link>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Link
            href={`/admin/notifications${unreadOnly ? '?filter=unread' : ''}` as never}
            data-group="all"
            data-active={activeGroup === null ? '1' : '0'}
            className={`rounded-full border px-2.5 py-1 text-[10.5px] font-bold ${
              activeGroup === null
                ? 'border-cart bg-cart-soft text-cart'
                : 'border-line bg-white text-ink-3 hover:bg-line-soft'
            }`}
          >
            Tüm türler
          </Link>
          {Object.entries(TYPE_GROUPS).map(([key, def]) => {
            const count = groupCounts[key] ?? 0;
            if (count === 0 && activeGroup !== key) return null;
            const params = new URLSearchParams();
            if (unreadOnly) params.set('filter', 'unread');
            params.set('group', key);
            return (
              <Link
                key={key}
                href={`/admin/notifications?${params.toString()}` as never}
                data-group={key}
                data-active={activeGroup === key ? '1' : '0'}
                className={`rounded-full border px-2.5 py-1 text-[10.5px] font-bold ${
                  activeGroup === key
                    ? 'border-cat bg-cat-soft text-cart'
                    : 'border-line bg-white text-ink-3 hover:bg-line-soft'
                }`}
              >
                {def.label} ({count})
              </Link>
            );
          })}
        </div>

        {activeGroup && (
          <div
            className="flex flex-wrap gap-1.5 rounded-2xl border border-line bg-paper p-3"
            data-testid="notif-type-filter"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-3 self-center">
              {TYPE_GROUPS[activeGroup].label} alt-tipler:
            </span>
            <Link
              href={
                `/admin/notifications?${new URLSearchParams({
                  ...(unreadOnly ? { filter: 'unread' } : {}),
                  group: activeGroup,
                }).toString()}` as never
              }
              data-type="all"
              data-active={activeType === null ? '1' : '0'}
              className={`rounded-full border px-2.5 py-1 text-[10.5px] font-bold ${
                activeType === null
                  ? 'border-cart bg-cart-soft text-cart'
                  : 'border-line bg-white text-ink-3 hover:bg-line-soft'
              }`}
            >
              Tümü ({groupCounts[activeGroup] ?? 0})
            </Link>
            {TYPE_GROUPS[activeGroup].types.map((t) => {
              const count = typeCounts[t] ?? 0;
              if (count === 0 && activeType !== t) return null;
              const params = new URLSearchParams();
              if (unreadOnly) params.set('filter', 'unread');
              params.set('group', activeGroup);
              params.set('type', t);
              return (
                <Link
                  key={t}
                  href={`/admin/notifications?${params.toString()}` as never}
                  data-type={t}
                  data-active={activeType === t ? '1' : '0'}
                  className={`rounded-full border px-2.5 py-1 text-[10.5px] font-bold ${
                    activeType === t
                      ? 'border-cat bg-cat text-white'
                      : 'border-line bg-white text-ink-3 hover:bg-line-soft'
                  }`}
                >
                  {TYPE_EMOJI[t] ?? '🔔'} {TYPE_LABEL[t] ?? t} ({count})
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {items.length === 0 ? (
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
          {items.map((n) => (
            <NotificationItem key={n.id} item={n} />
          ))}
        </ul>
      )}

      <Link
        href={'/admin' as never}
        className="text-center text-xs text-ink-4 hover:text-cart"
      >
        ← Pano&apos;ya dön
      </Link>
    </main>
  );
}

function NotificationItem({ item }: { item: NotificationRow }) {
  const isUnread = item.readAt === null;
  const emoji = item.content.emoji ?? TYPE_EMOJI[item.type] ?? '🔔';
  const typeLabel = TYPE_LABEL[item.type] ?? item.type;
  const link = item.content.link;

  return (
    <li
      data-notification-id={item.id}
      data-unread={isUnread ? '1' : '0'}
      className={`flex items-start gap-3 rounded-2xl border p-4 ${
        isUnread ? 'border-cat/40 bg-cat-soft/30' : 'border-line bg-white'
      }`}
    >
      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-white text-xl">
        {emoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-bold text-cart">{item.content.title}</h3>
          {isUnread && (
            <span className="rounded-full bg-cat px-1.5 py-0.5 text-[9px] font-bold text-white">
              YENİ
            </span>
          )}
        </div>
        {item.content.body && (
          <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{item.content.body}</p>
        )}
        <div className="mt-1 flex items-center gap-3 text-[10.5px] text-ink-3">
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
        <form action={markAsReadAction.bind(null, item.id)}>
          <button
            type="submit"
            data-action="mark-read"
            aria-label="Okundu işaretle"
            className="rounded-lg border border-line bg-white px-2 py-1 text-[10px] font-bold text-ink-3 hover:bg-line-soft"
          >
            ✓
          </button>
        </form>
      )}
    </li>
  );
}

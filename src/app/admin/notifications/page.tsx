import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { listForUser } from '@/lib/notifications/manage';
import { NotificationsList } from './notifications-list';

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

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) redirect('/login' as never);

  const params = await searchParams;
  const unreadOnly = params.filter === 'unread';

  const items = await listForUser(session.user.companyId, session.user.id, db, {
    limit: 100,
    unreadOnly,
  });

  const unreadCount = items.filter((i) => i.readAt === null).length;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex gap-2" data-testid="notif-filter">
        <Link
          href={'/admin/notifications' as never}
          className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${
            !unreadOnly
              ? 'border-cat bg-cat text-white'
              : 'border-line bg-paper text-ink-3 hover:bg-line-soft'
          }`}
        >
          Hepsi
        </Link>
        <Link
          href={'/admin/notifications?filter=unread' as never}
          className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${
            unreadOnly
              ? 'border-cat bg-cat text-white'
              : 'border-line bg-paper text-ink-3 hover:bg-line-soft'
          }`}
        >
          Okunmamış ({unreadCount})
        </Link>
      </div>

      <NotificationsList
        initialItems={items}
        unreadOnly={unreadOnly}
        typeEmoji={TYPE_EMOJI}
        typeLabel={TYPE_LABEL}
      />

      <Link
        href={'/admin' as never}
        className="text-center text-xs text-ink-4 hover:text-cart"
      >
        ← Pano&apos;ya dön
      </Link>
    </main>
  );
}

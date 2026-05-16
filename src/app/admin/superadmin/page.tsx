import Link from 'next/link';
import { db } from '@/lib/db/client';
import { requireSuperadmin } from '@/lib/superadmin/access';
import { listAllTenants, getSystemStats } from '@/lib/superadmin/tenants';

const PLAN_COLORS: Record<string, string> = {
  FREE: 'bg-line-soft text-ink-2',
  PRO: 'bg-cat-soft text-cart',
  PRO_PLUS: 'bg-arrow-soft text-arrow-7',
};

const STOREFRONT_LABELS: Record<string, { label: string; cls: string }> = {
  disabled: { label: 'Kapalı', cls: 'bg-line-soft text-ink-3' },
  pending: { label: 'Bekliyor', cls: 'bg-cat-soft text-cart' },
  approved: { label: '✓ Aktif', cls: 'bg-arrow-soft text-arrow-7' },
  rejected: { label: '× Reddedildi', cls: 'bg-danger-soft text-danger-7' },
  auto_suspended: { label: '⚠ Askıda', cls: 'bg-danger-soft text-danger-7' },
};

export default async function SuperadminTenantsPage() {
  await requireSuperadmin();

  const [tenants, stats] = await Promise.all([
    listAllTenants(db, 50),
    getSystemStats(db),
  ]);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12">
      <header>
        <div className="text-[11.5px] font-bold uppercase tracking-wider text-cat">
          🛡 Süperadmin · Tenant&apos;lar
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          Süperadmin paneli
        </h1>
        <p className="mt-1 text-sm text-ink-3">
          Sistem geneli görünüm — tüm tenant&apos;lar + global istatistikler.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI title="Toplam tenant" value={stats.tenantCount} emoji="🏪" />
        <KPI
          title="Aktif vitrin"
          value={stats.activeTenantCount}
          emoji="🌐"
          accent="arrow"
        />
        <KPI title="Toplam kullanıcı" value={stats.totalUsers} emoji="👥" />
        <KPI title="Toplam ürün" value={stats.totalProducts} emoji="🐾" />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI
          title="24s hareket"
          value={stats.totalMovementsLast24h}
          emoji="📦"
          accent="arrow"
        />
        <KPI
          title="Okunmamış notif"
          value={stats.unreadNotificationsAll}
          emoji="🔔"
          accent={stats.unreadNotificationsAll > 0 ? 'cat' : 'arrow'}
        />
        <KPI title="Aktif PRO" value={stats.proSubscriptions} emoji="💎" accent="cat" />
        <KPI
          title="Aktif PRO+"
          value={stats.proPlusSubscriptions}
          emoji="💎"
          accent="cat"
        />
      </section>

      <section
        className="overflow-x-auto rounded-2xl border border-line bg-white"
        data-testid="tenant-table"
      >
        <table className="w-full text-sm">
          <thead className="bg-paper">
            <tr className="text-left text-[10.5px] font-bold uppercase tracking-wider text-ink-3">
              <th className="px-4 py-3">Tenant</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Vitrin</th>
              <th className="px-4 py-3 text-right">User</th>
              <th className="px-4 py-3 text-right">Ürün</th>
              <th className="px-4 py-3 text-right">Şube</th>
              <th className="px-4 py-3 text-right">Stok</th>
              <th className="px-4 py-3">Kayıt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {tenants.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-xs text-ink-3">
                  Henüz tenant yok.
                </td>
              </tr>
            ) : (
              tenants.map((t) => {
                const storefront = STOREFRONT_LABELS[t.storefrontStatus] ?? {
                  label: t.storefrontStatus,
                  cls: 'bg-line-soft text-ink-3',
                };
                return (
                  <tr key={t.id} data-tenant-id={t.id} className="hover:bg-line-soft">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/superadmin/tenant/${t.id}` as never}
                        className="font-bold text-cart hover:underline"
                      >
                        {t.name}
                      </Link>
                      <div className="font-mono text-[10.5px] text-ink-4">
                        {t.slug}
                        {t.vatNo && <span> · VKN {t.vatNo}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${PLAN_COLORS[t.plan] ?? ''}`}
                      >
                        {t.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${storefront.cls}`}
                      >
                        {storefront.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[11.5px]">{t.userCount}</td>
                    <td className="px-4 py-3 text-right font-mono text-[11.5px]">{t.productCount}</td>
                    <td className="px-4 py-3 text-right font-mono text-[11.5px]">{t.branchCount}</td>
                    <td className="px-4 py-3 text-right font-mono text-[11.5px]">
                      {t.totalStockQty}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-ink-3 whitespace-nowrap">
                      {new Date(t.createdAt).toLocaleDateString('tr-TR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                      })}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      <p className="text-center text-[11px] text-ink-4">
        🛡 Süperadmin · Sistem geneli görünüm. Impersonation + DB Inspector + Toolbox FAB Faz 2&apos;de.
      </p>

      <Link href={'/admin' as never} className="text-center text-xs text-ink-4 hover:text-cart">
        ← Pano&apos;ya dön
      </Link>
    </main>
  );
}

function KPI({
  title,
  value,
  emoji,
  accent = 'neutral',
}: {
  title: string;
  value: number | string;
  emoji: string;
  accent?: 'cat' | 'arrow' | 'neutral';
}) {
  const cls: Record<string, string> = {
    cat: 'border-cat/30 bg-cat-soft/40',
    arrow: 'border-arrow/30 bg-arrow-soft/40',
    neutral: 'border-line bg-white',
  };
  return (
    <article className={`flex flex-col gap-2 rounded-2xl border p-5 ${cls[accent]}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-ink-3">
          {title}
        </span>
        <span className="text-xl">{emoji}</span>
      </div>
      <div className="font-mono text-2xl font-bold text-cart">{value}</div>
    </article>
  );
}

import Link from 'next/link';
import { db } from '@/lib/db/client';
import { requireSuperadmin } from '@/lib/superadmin/access';
import { listAllTenants, getSystemStats } from '@/lib/superadmin/tenants';
import { getDatabaseStats } from '@/lib/superadmin/db-stats';

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

  const [tenants, stats, dbStats] = await Promise.all([
    listAllTenants(db, 50),
    getSystemStats(db),
    getDatabaseStats(db),
  ]);

  const usageDanger = dbStats.usagePct > 80;
  const usageWarning = dbStats.usagePct > 50 && !usageDanger;

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

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]" data-testid="db-stats">
        <article
          className={`rounded-2xl border p-5 ${
            usageDanger
              ? 'border-danger/40 bg-danger-soft/40'
              : usageWarning
                ? 'border-cat/40 bg-cat-soft/30'
                : 'border-arrow/30 bg-arrow-soft/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink-3">
              💾 Disk doluluğu (Supabase)
            </h2>
            <span className="text-[10.5px] font-bold text-ink-3">
              {dbStats.connectionCount} bağlantı
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span
              className={`font-mono text-3xl font-bold ${
                usageDanger ? 'text-danger-7' : usageWarning ? 'text-cart' : 'text-arrow-7'
              }`}
              data-testid="db-size"
            >
              {dbStats.totalSizePretty}
            </span>
            <span className="text-[11.5px] text-ink-3">
              / {dbStats.planLimitMb < 1024 ? `${dbStats.planLimitMb} MB` : `${(dbStats.planLimitMb / 1024).toFixed(1)} GB`} plan limit
            </span>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-line-soft">
            <div
              className={`h-full transition-all ${
                usageDanger
                  ? 'bg-gradient-to-r from-danger to-danger-2'
                  : usageWarning
                    ? 'bg-gradient-to-r from-cat to-cat-2'
                    : 'bg-gradient-to-r from-arrow to-arrow-2'
              }`}
              style={{ width: `${Math.min(dbStats.usagePct, 100)}%` }}
              data-testid="db-usage-bar"
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="font-mono font-bold text-ink">
              %{dbStats.usagePct.toFixed(2)}
            </span>
            <span className="text-ink-3">
              {usageDanger ? '🔴 Kritik — Pro tier upgrade gerek' : usageWarning ? '⚠ Dikkat' : '✓ Sağlıklı'}
            </span>
          </div>
        </article>

        <article className="rounded-2xl border border-line bg-white p-5">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
            📊 Top 8 tablo (petstockpro schema)
          </h2>
          <ul className="flex flex-col gap-1.5" data-testid="top-tables">
            {dbStats.topTables.map((t) => {
              const max = dbStats.topTables[0]?.bytes ?? 1;
              const pct = (t.bytes / max) * 100;
              return (
                <li
                  key={t.name}
                  data-table={t.name}
                  className="grid grid-cols-[140px_1fr_60px] items-center gap-2 text-[11px]"
                >
                  <span className="font-mono text-ink-2 truncate">{t.name}</span>
                  <div className="h-1.5 overflow-hidden rounded-full bg-line-soft">
                    <div
                      className="h-full bg-gradient-to-r from-cat to-arrow"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-right font-mono font-bold text-cart">{t.sizePretty}</span>
                </li>
              );
            })}
          </ul>
        </article>
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

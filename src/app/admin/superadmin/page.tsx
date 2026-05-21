import Link from 'next/link';
import { db } from '@/lib/db/client';
import { requireSuperadmin } from '@/lib/superadmin/access';
import { listAllTenants, getSystemStats } from '@/lib/superadmin/tenants';
import { getDatabaseStats } from '@/lib/superadmin/db-stats';
import {
  getVitrinEventStats,
  getTenantActivityStats,
} from '@/lib/superadmin/analytics';
import { NumberTicker } from '@/components/magicui/number-ticker';
import { startImpersonationAction } from './impersonate-actions';

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

  const [tenants, stats, dbStats, vitrinStats, activityStats] = await Promise.all([
    listAllTenants(db, 50),
    getSystemStats(db),
    getDatabaseStats(db),
    getVitrinEventStats(db, 7),
    getTenantActivityStats(db),
  ]);

  const usageDanger = dbStats.usagePct > 80;
  const usageWarning = dbStats.usagePct > 50 && !usageDanger;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 lg:px-6 py-8 lg:py-10">
      {/* HERO — koyu superadmin banner, kırmızı vurgular (super-admin.html stili) */}
      <section
        data-testid="superadmin-hero"
        className="relative overflow-hidden rounded-3xl p-7 text-white shadow-[0_22px_50px_rgba(20,40,55,.45)]"
        style={{
          background:
            'radial-gradient(circle at 92% 25%, rgba(196,69,58,.35), transparent 60%), linear-gradient(135deg, #0e3c66 0%, #1a2530 60%, #0e3c66 100%)',
        }}
      >
        <div className="grid items-center gap-4 md:grid-cols-[auto_1fr_auto]">
          <div
            aria-hidden
            className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-danger to-cat text-2xl shadow-[0_8px_22px_rgba(196,69,58,.45)]"
          >
            🛡
          </div>
          <div className="min-w-0">
            <div className="text-[12.5px] font-bold uppercase tracking-wider opacity-75">
              SÜPERADMİN MODU
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
              Sistem geneli görünüm
            </h1>
            <p className="mt-1 text-[14.5px] opacity-85">
              {stats.tenantCount} tenant · {stats.totalUsers} kullanıcı · son 7 günde {vitrinStats.profileView + vitrinStats.productView} vitrin görüntüleme.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SupChip href="/admin/superadmin/vitrin-moderation" emoji="📋">
              Vitrin moderasyon
            </SupChip>
            <SupChip href="/admin/superadmin/errors" emoji="🐛">
              Hatalar
            </SupChip>
            <SupChip href="/admin/superadmin/db-inspector" emoji="🔍">
              DB Inspector
            </SupChip>
            <SupChip href="/admin/superadmin/system-settings" emoji="⚙">
              Sistem ayarları
            </SupChip>
          </div>
        </div>
      </section>

      <ZoneLabel emoji="📈" label="Genel" />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI title="Toplam tenant" value={stats.tenantCount} emoji="🏪" />
        <KPI
          title="Aktif vitrin"
          value={stats.activeTenantCount}
          emoji="🌐"
          accent="arrow"
        />
        <KPI title="Toplam kullanıcı" value={stats.totalUsers} emoji="👥" />
        <KPI title="Toplam ürün" value={stats.totalProducts} emoji="" />
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

      <ZoneLabel emoji="👁" label="Vitrin Görüntüleme · Son 7 gün" />

      <section
        data-testid="vitrin-metrics"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <KpiBold
          tone="bars"
          label="Profil görüntüleme"
          value={vitrinStats.profileView}
          sub="/vitrin/magaza/[slug] ziyaret"
        />
        <KpiBold
          tone="cart"
          label="Ürün görüntüleme"
          value={vitrinStats.productView}
          sub="ürün detay sayfası"
        />
        <KpiBold
          tone="arrow"
          label="WhatsApp tıklama"
          value={vitrinStats.whatsappClick}
          sub="en kıymetli — conversion"
        />
        <KpiBold
          tone="cat"
          label="Conversion oranı"
          value={`%${vitrinStats.conversionRate.toFixed(1)}`}
          sub="WA tıklama / profil görüntüleme"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <article className="rounded-2xl border border-line bg-paper p-5">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-3">
            🏆 Top 5 tenant · görüntüleme
          </h2>
          {vitrinStats.topTenants.length === 0 ? (
            <p className="rounded-lg bg-line-soft px-3 py-4 text-center text-xs text-ink-3">
              Son 7 günde vitrin trafiği yok.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 text-xs">
              {vitrinStats.topTenants.map((t, idx) => {
                const max = vitrinStats.topTenants[0]?.totalViews ?? 1;
                const pct = (t.totalViews / max) * 100;
                return (
                  <li
                    key={t.companyId}
                    data-top-tenant={t.companyId}
                    className="grid grid-cols-[18px_1fr_60px_60px] items-center gap-2.5"
                  >
                    <span className="text-[12.5px] font-bold text-ink-4 text-right">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <Link
                        href={`/admin/superadmin/tenant/${t.companyId}` as never}
                        className="block truncate text-[13.5px] font-bold text-cart hover:underline"
                      >
                        {t.companyName}
                      </Link>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line-soft">
                        <div
                          className="h-full bg-gradient-to-r from-bars to-arrow"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-right font-mono text-[12.5px] font-bold text-cart">
                      {t.totalViews}
                    </span>
                    <span className="text-right text-[11.5px] text-ink-3">
                      📞 {t.whatsappClicks}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </article>

        <article className="rounded-2xl border border-line bg-paper p-5">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-3">
            📣 Listede gösterilme
          </h2>
          <div className="font-mono text-3xl font-bold text-cart">
            <NumberTicker value={vitrinStats.listingImpression} />
          </div>
          <p className="mt-2 text-[13px] text-ink-3">
            Aramada/kategoride listelenme · son 7 gün
          </p>
          <hr className="my-3 border-line-soft" />
          <p className="text-[12.5px] text-ink-4 leading-relaxed">
            Funnel: {vitrinStats.listingImpression} listede gösterim →{' '}
            {vitrinStats.profileView} profil ziyaret →{' '}
            {vitrinStats.whatsappClick} WhatsApp tıklama (
            <strong className="text-cart">
              %{vitrinStats.conversionRate.toFixed(1)}
            </strong>{' '}
            dönüşüm).
          </p>
        </article>
      </section>

      <ZoneLabel emoji="🔥" label="Tenant Aktivitesi" />

      <section
        data-testid="tenant-activity-metrics"
        className="grid gap-4 sm:grid-cols-3"
      >
        <KpiBold
          tone="arrow"
          emoji="📈"
          label="24 saat aktif"
          value={activityStats.activeLast24h}
          sub={`/ ${stats.tenantCount} tenant`}
        />
        <KpiBold
          tone="bars"
          emoji="📊"
          label="7 gün aktif"
          value={activityStats.activeLast7d}
          sub={`/ ${stats.tenantCount} tenant`}
        />
        <KpiBold
          tone="cart"
          emoji="📅"
          label="30 gün aktif"
          value={activityStats.activeLast30d}
          sub={`/ ${stats.tenantCount} tenant`}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <article className="rounded-2xl border border-line bg-paper p-5">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
            🗂 Son aktivite dağılımı
          </h2>
          <ul className="flex flex-col gap-2 text-xs">
            <DistRow
              label="🟢 Bugün (≤24s)"
              value={activityStats.distribution.today}
              total={stats.tenantCount}
              tone="arrow"
            />
            <DistRow
              label="🟡 1-7 gün"
              value={activityStats.distribution.week}
              total={stats.tenantCount}
              tone="bars"
            />
            <DistRow
              label="🟠 7-30 gün"
              value={activityStats.distribution.month}
              total={stats.tenantCount}
              tone="cat"
            />
            <DistRow
              label="🔴 30 günden eski"
              value={activityStats.distribution.older}
              total={stats.tenantCount}
              tone="danger"
            />
            <DistRow
              label="⚫ Hiç aktivite yok"
              value={activityStats.distribution.never}
              total={stats.tenantCount}
              tone="neutral"
            />
          </ul>
        </article>

        <article className="rounded-2xl border border-line bg-paper p-5">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-3">
            ⚠ İlgi azalan tenant&apos;lar
            <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[10.5px] font-bold uppercase text-danger-7">
              {activityStats.inactiveTenants.length}
            </span>
          </h2>
          {activityStats.inactiveTenants.length === 0 ? (
            <p className="rounded-lg bg-arrow-soft/40 px-3 py-4 text-center text-[12.5px] text-arrow-7">
              ✓ Tüm tenant&apos;lar son 7 gün içinde aktif.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-xs">
              {activityStats.inactiveTenants.map((t) => (
                <li
                  key={t.companyId}
                  data-inactive-tenant={t.companyId}
                  className="grid grid-cols-[1fr_auto_60px] items-center gap-2"
                >
                  <Link
                    href={`/admin/superadmin/tenant/${t.companyId}` as never}
                    className="truncate font-bold text-cart hover:underline"
                  >
                    {t.companyName}
                  </Link>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      t.plan === 'FREE'
                        ? 'bg-line-soft text-ink-3'
                        : t.plan === 'PRO'
                          ? 'bg-cat-soft text-cart'
                          : 'bg-arrow-soft text-arrow-7'
                    }`}
                  >
                    {t.plan}
                  </span>
                  <span className="text-right text-[12px] font-bold text-danger-7">
                    {t.daysSinceActivity === null
                      ? 'hiç'
                      : `${t.daysSinceActivity}g`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <ZoneLabel emoji="💾" label="Veritabanı" />

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
            <span className="text-[12px] font-bold text-ink-3">
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
            <span className="text-[13px] text-ink-3">
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
          <div className="mt-2 flex items-center justify-between text-[12.5px]">
            <span className="font-mono font-bold text-ink">
              %{dbStats.usagePct.toFixed(2)}
            </span>
            <span className="text-ink-3">
              {usageDanger ? '🔴 Kritik — Pro tier upgrade gerek' : usageWarning ? '⚠ Dikkat' : '✓ Sağlıklı'}
            </span>
          </div>
        </article>

        <article className="rounded-2xl border border-line bg-paper p-5">
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
                  className="grid grid-cols-[140px_1fr_60px] items-center gap-2 text-[12.5px]"
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
        className="overflow-x-auto rounded-2xl border border-line bg-paper"
        data-testid="tenant-table"
      >
        <table className="w-full text-sm">
          <thead className="bg-paper">
            <tr className="text-left text-[12px] font-bold uppercase tracking-wider text-ink-3">
              <th className="px-4 py-3">Tenant</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Vitrin</th>
              <th className="px-4 py-3 text-right">User</th>
              <th className="px-4 py-3 text-right">Ürün</th>
              <th className="px-4 py-3 text-right">Şube</th>
              <th className="px-4 py-3 text-right">Stok</th>
              <th className="px-4 py-3">Kayıt</th>
              <th className="px-4 py-3 text-right">Aksiyon</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {tenants.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-xs text-ink-3">
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
                      <div className="font-mono text-[12px] text-ink-4">
                        {t.slug}
                        {t.vatNo && <span> · VKN {t.vatNo}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold ${PLAN_COLORS[t.plan] ?? ''}`}
                      >
                        {t.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold ${storefront.cls}`}
                      >
                        {storefront.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[13px]">{t.userCount}</td>
                    <td className="px-4 py-3 text-right font-mono text-[13px]">{t.productCount}</td>
                    <td className="px-4 py-3 text-right font-mono text-[13px]">{t.branchCount}</td>
                    <td className="px-4 py-3 text-right font-mono text-[13px]">
                      {t.totalStockQty}
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-ink-3 whitespace-nowrap">
                      {new Date(t.createdAt).toLocaleDateString('tr-TR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form action={startImpersonationAction}>
                        <input type="hidden" name="companyId" value={t.id} />
                        <button
                          type="submit"
                          data-testid={`impersonate-${t.id}`}
                          title={`${t.name} olarak görüntüle`}
                          className="inline-flex items-center gap-1 rounded-lg border border-cat/40 bg-cat-soft px-2.5 py-1.5 text-[12px] font-bold text-cart transition-colors hover:border-cat hover:bg-cat hover:text-white"
                        >
                          🎭 Gir
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      <p className="text-center text-[12.5px] text-ink-4">
        🛡 Süperadmin · Sistem geneli görünüm. Tenant&apos;a girmek için satır sonundaki 🎭 Gir butonunu kullan.
      </p>

      {/* Süperadmin kendi tenant pano'sunu görmek için sidebar Pano linkini kullanabilir.
          Buradaki "Pano'ya dön" link kaldırıldı — tenant'a impersonate akışı için karışıklık yaratıyordu. */}
    </main>
  );
}

function SupChip({
  href,
  emoji,
  children,
}: {
  href: string;
  emoji: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href as never}
      className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/12 px-3 py-1.5 text-[13px] font-bold text-white backdrop-blur transition-colors hover:border-white/60 hover:bg-white/22"
    >
      <span aria-hidden>{emoji}</span> {children}
    </Link>
  );
}

function ZoneLabel({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div
      data-zone-label={label}
      className="mt-2 flex items-center gap-3 text-[12.5px] font-bold uppercase tracking-wider text-ink-4"
    >
      <span>
        {emoji} {label}
      </span>
      <span className="h-px flex-1 bg-gradient-to-r from-line to-transparent" />
    </div>
  );
}

function KpiBold({
  tone,
  emoji,
  label,
  value,
  sub,
}: {
  tone: 'cat' | 'cart' | 'arrow' | 'bars' | 'danger';
  /** Opsiyonel — verilmezse sağ üst ikon kutusu render edilmez. */
  emoji?: string;
  label: string;
  value: number | string;
  sub: string;
}) {
  const toneCls: Record<string, string> = {
    cat: 'bg-gradient-to-br from-cat to-cat-2 shadow-[0_12px_32px_rgba(212,74,20,.20)]',
    cart: 'bg-gradient-to-br from-cart to-cart-2 shadow-[0_12px_32px_rgba(26,85,136,.20)]',
    arrow: 'bg-gradient-to-br from-arrow to-arrow-7 shadow-[0_12px_32px_rgba(22,160,138,.20)]',
    bars: 'bg-gradient-to-br from-bars to-bars-7 shadow-[0_12px_32px_rgba(48,144,208,.20)]',
    danger: 'bg-gradient-to-br from-danger to-danger-7 shadow-[0_12px_32px_rgba(196,49,49,.22)]',
  };
  const numeric = typeof value === 'number';
  return (
    <article
      data-kpi-bold={label}
      data-kpi-tone={tone}
      className={`relative overflow-hidden rounded-2xl p-6 text-white transition-transform hover:-translate-y-1 ${toneCls[tone]}`}
    >
      {emoji && (
        <div className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-xl bg-white/20 text-lg">
          {emoji}
        </div>
      )}
      <span className="text-[12.5px] font-bold uppercase tracking-wider opacity-85">
        {label}
      </span>
      <div className="mt-2 font-mono text-4xl font-bold leading-none tracking-tight">
        {numeric ? <NumberTicker value={value as number} className="text-white" /> : value}
      </div>
      <div className="mt-2 text-[13px] opacity-90">{sub}</div>
    </article>
  );
}

function DistRow({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: 'cat' | 'cart' | 'arrow' | 'bars' | 'danger' | 'neutral';
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  const barCls: Record<string, string> = {
    cat: 'bg-cat',
    cart: 'bg-cart',
    arrow: 'bg-arrow',
    bars: 'bg-bars',
    danger: 'bg-danger',
    neutral: 'bg-ink-4',
  };
  return (
    <li className="grid grid-cols-[140px_1fr_44px] items-center gap-2.5">
      <span className="text-[12.5px] text-ink-2">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-line-soft">
        <div
          className={`h-full ${barCls[tone]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-right font-mono text-[12.5px] font-bold text-cart">
        {value}
      </span>
    </li>
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
    neutral: 'border-line bg-paper',
  };
  return (
    <article className={`flex flex-col gap-2 rounded-2xl border p-5 ${cls[accent]}`}>
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold uppercase tracking-wider text-ink-3">
          {title}
        </span>
        <span className="text-xl">{emoji}</span>
      </div>
      <div className="font-mono text-2xl font-bold text-cart">{value}</div>
    </article>
  );
}

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { companies } from '@/db/schema';
import {
  getDashboardStats,
  listLowStock,
  listRecentActivity,
} from '@/lib/dashboard/stats';
import { unreadCountForUser, listForUser, type NotificationRow } from '@/lib/notifications/manage';
import { isSuperadmin } from '@/lib/superadmin/access';
import { listOrderSuggestions } from '@/lib/assistant/order-suggestions';
import { listTopTransferSuggestions } from '@/lib/assistant/transfer-suggestions-flat';
import {
  listDiscountSuggestions,
  formatMonthsOfInventory,
} from '@/lib/assistant/discount-suggestions';
import {
  listExpiringSuggestions,
  formatExpiryLabel,
  type ExpirySeverity,
} from '@/lib/assistant/expiring-suggestions';
import { getFeedbackSummary } from '@/lib/vitrin/feedback';
import { planProductLimit, planLimitDisplay } from '@/lib/constants/plan-limits';

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  stock_in: { label: '📥', cls: 'bg-arrow-soft text-arrow-7' },
  stock_out: { label: '📤', cls: 'bg-cat-soft text-cart' },
  transfer: { label: '🔁', cls: 'bg-line-soft text-ink-2' },
  stocktake: { label: '📋', cls: 'bg-line-soft text-ink-2' },
  stocktake_initial: { label: '🗂', cls: 'bg-line-soft text-ink-2' },
};

const SUBTYPE_LABEL: Record<string, string> = {
  sale: 'Satış',
  waste: 'Fire',
  gift: 'Hediye',
  sample: 'Numune',
  return: 'İade',
  internal_use: 'Dahili',
  other: 'Diğer',
};

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) redirect('/login' as never);
  const userIsSuperadmin = isSuperadmin(session);

  const [
    companyRow,
    stats,
    lowStock,
    activity,
    unreadNotifications,
    recentNotifications,
    orderSuggestions,
    transferSuggestions,
    discountSuggestions,
    expiringSuggestions,
    feedback,
  ] = await Promise.all([
    db
      .select({ name: companies.name, plan: companies.plan })
      .from(companies)
      .where(eq(companies.id, session.user.companyId))
      .limit(1),
    getDashboardStats(session.user.companyId, db),
    listLowStock(session.user.companyId, db, 6),
    listRecentActivity(session.user.companyId, db, 8),
    unreadCountForUser(session.user.companyId, session.user.id, db),
    listForUser(session.user.companyId, session.user.id, db, { limit: 4 }),
    listOrderSuggestions(session.user.companyId, db, 5),
    listTopTransferSuggestions(session.user.companyId, db, 5),
    listDiscountSuggestions(session.user.companyId, db, 5),
    listExpiringSuggestions(session.user.companyId, db, 6),
    getFeedbackSummary(session.user.companyId, db, 30),
  ]);

  const feedbackActivity =
    feedback.totalSubmitted + feedback.totalClosedManually + feedback.totalDismissed;
  const feedbackResponseRate =
    feedbackActivity > 0
      ? (feedback.totalSubmitted / feedbackActivity) * 100
      : null;
  const feedbackReachRate =
    feedback.totalSubmitted > 0
      ? ((feedback.totalSubmitted -
          (feedback.ratingDistribution.unreached ?? 0)) /
          feedback.totalSubmitted) *
        100
      : null;

  const company = companyRow[0];
  const rawPlanLimit = planProductLimit(company?.plan ?? 'FREE');
  // KPI ring progress bar 0 = sınırsız (bar gösterimini gizler)
  const planLimit = rawPlanLimit === Infinity ? 0 : rawPlanLimit;
  const planLimitLabel = planLimitDisplay(company?.plan ?? 'FREE');

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11.5px] font-bold uppercase tracking-wider text-cat">
            Admin · Pano
          </div>
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
            Merhaba, {company?.name ?? 'Pet shop'}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NotificationBell unreadCount={unreadNotifications} />
          {userIsSuperadmin && (
            <Link
              href={'/admin/superadmin' as never}
              data-superadmin-link
              className="rounded-xl border-2 border-cat bg-cat-soft px-3 py-2 text-xs font-bold text-cart hover:bg-cat hover:text-white"
            >
              🛡 Süperadmin
            </Link>
          )}
          <QuickLink href="/admin/products" label="🐾 Ürünler" />
          <QuickLink href="/admin/stock-movements" label="📦 Stok hareketleri" />
          <QuickLink href="/admin/stocktake" label="📋 Sayım" />
          <QuickLink href="/admin/low-stock" label="⚠ Düşük stok" />
          <QuickLink href="/admin/reports" label="📊 Raporlar" />
          <QuickLink href="/admin/settings" label="⚙ Ayarlar" />
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI
          title="Toplam ürün"
          value={stats.totalProducts}
          subtitle={`${planLimitLabel} limit · ${stats.totalActiveVariants} variant`}
          emoji="🐾"
          bar={{ value: stats.totalProducts, max: planLimit }}
        />
        <KPI
          title="Toplam stok"
          value={stats.totalStockQty}
          subtitle={`${stats.branchCount} aktif şube`}
          emoji="📦"
        />
        <KPI
          title="Bugünkü satış"
          value={stats.todaySaleQty}
          subtitle={`${stats.todaySaleRevenue}₺ ciro`}
          emoji="💰"
          accent={stats.todaySaleQty > 0 ? 'arrow' : 'neutral'}
        />
        <KPI
          title="Düşük stok"
          value={stats.lowStockCount}
          subtitle={
            stats.lowStockCount > 0 ? 'Eşik altı variant' : '✓ Hepsi yeterli'
          }
          emoji="⚠"
          accent={stats.lowStockCount > 0 ? 'danger' : 'arrow'}
        />
      </section>

      {recentNotifications.length > 0 && (
        <section data-testid="pano-notif-feed">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink-3">
              🔔 Son bildirimler
            </h2>
            <Link
              href={'/admin/notifications' as never}
              className="text-[11px] font-bold text-cat hover:underline"
            >
              Tümü →
            </Link>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {recentNotifications.slice(0, 4).map((n) => (
              <PanoNotificationItem key={n.id} item={n} />
            ))}
          </ul>
        </section>
      )}

      {feedbackActivity > 0 && (
        <section data-testid="pano-feedback-widget">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink-3">
              💬 Vitrin geri bildirimleri · son 30g
            </h2>
            <Link
              href={'/admin/settings/storefront' as never}
              className="text-[11px] font-bold text-cat hover:underline"
            >
              Detay →
            </Link>
          </div>
          <article className="grid gap-3 rounded-2xl border border-line bg-white p-4 sm:grid-cols-4">
            <FeedbackKpi
              label="Aktivite"
              value={String(feedbackActivity)}
              hint="submit + closed + dismissed"
              tone="neutral"
            />
            <FeedbackKpi
              label="Anket cevabı"
              value={String(feedback.totalSubmitted)}
              hint={
                feedbackResponseRate !== null
                  ? `${feedbackResponseRate.toFixed(0)}% katılım`
                  : 'Henüz yok'
              }
              tone="cat"
            />
            <FeedbackKpi
              label="Ortalama puan"
              value={
                feedback.averageRatingScore !== null
                  ? `${feedback.averageRatingScore.toFixed(2)}/5`
                  : '—'
              }
              hint={
                feedback.averageRatingScore !== null &&
                feedback.averageRatingScore < 3
                  ? '⚠ İyileştirme gerek'
                  : '5 = en iyi'
              }
              tone={
                feedback.averageRatingScore !== null &&
                feedback.averageRatingScore < 3
                  ? 'danger'
                  : 'arrow'
              }
            />
            <FeedbackKpi
              label="Ulaşma oranı"
              value={
                feedbackReachRate !== null
                  ? `${feedbackReachRate.toFixed(0)}%`
                  : '—'
              }
              hint={
                feedbackReachRate !== null && feedbackReachRate < 80
                  ? '⚠ Cevap hızı'
                  : 'Anket cevaplarına göre'
              }
              tone={
                feedbackReachRate !== null && feedbackReachRate < 80
                  ? 'danger'
                  : 'arrow'
              }
            />
          </article>
        </section>
      )}

      {transferSuggestions.length > 0 && (
        <section data-testid="petpro-transfer-suggestions">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-cat">
              🤖 PetPro Asistanı · Transfer Önerileri
            </h2>
            <Link
              href={'/admin/low-stock' as never}
              className="text-[11px] font-bold text-cat hover:underline"
            >
              Düşük stok detayı →
            </Link>
          </div>
          <article className="rounded-2xl border-2 border-arrow/30 bg-gradient-to-br from-arrow-soft/30 to-cat-soft/20 p-4">
            <p className="mb-3 text-[11px] text-ink-3">
              Aynı ürün/variant başka şubede yüksek stoklu — düşük stoklu şubeye transfer öner:
            </p>
            <ul className="divide-y divide-line-soft text-xs">
              {transferSuggestions.map((t) => (
                <li
                  key={`${t.variantId}-${t.sourceBranchId}-${t.targetBranchId}`}
                  data-transfer-suggestion={t.variantId}
                  className="flex items-center gap-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-bold text-ink">
                      {t.productName}{' '}
                      {t.variantLabel && (
                        <span className="text-[10px] font-normal text-ink-3">
                          · {t.variantLabel}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-ink-3">
                      <span className="text-arrow-7 font-bold">
                        📤 {t.sourceBranchName} ({t.sourceStock})
                      </span>
                      <span>→</span>
                      <span className={t.targetStock === 0 ? 'text-danger-7 font-bold' : 'text-cart font-bold'}>
                        📥 {t.targetBranchName} ({t.targetStock})
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-ink-4">Öneri</div>
                    <div className="font-mono text-base font-bold text-arrow-7">
                      +{t.suggestedQty}
                    </div>
                  </div>
                  <Link
                    href={
                      `/admin/stock-movements?transfer=open&variant=${t.variantId}&source=${t.sourceBranchId}&target=${t.targetBranchId}&qty=${t.suggestedQty}` as never
                    }
                    className="rounded-lg border border-arrow/40 bg-white px-2.5 py-1.5 text-[10.5px] font-bold text-arrow-7 hover:bg-arrow hover:text-white transition-colors"
                  >
                    🔁 Transfer
                  </Link>
                </li>
              ))}
            </ul>
          </article>
        </section>
      )}

      {discountSuggestions.length > 0 && (
        <section data-testid="petpro-discount-suggestions">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-cat">
              🤖 PetPro Asistanı · İndirim Önerileri
            </h2>
            <Link
              href={'/admin/reports' as never}
              className="text-[11px] font-bold text-cat hover:underline"
            >
              Stok değer raporu →
            </Link>
          </div>
          <article className="rounded-2xl border-2 border-danger/20 bg-gradient-to-br from-danger-soft/20 to-cat-soft/30 p-4">
            <p className="mb-3 text-[11px] text-ink-3">
              Yavaş satış + yüksek stok — indirim ile cirosu hareketlendir:
            </p>
            <ul className="divide-y divide-line-soft text-xs">
              {discountSuggestions.map((d) => {
                const stockMonths = formatMonthsOfInventory(d.monthsOfInventory);
                return (
                  <li
                    key={d.variantId}
                    data-discount-suggestion={d.variantId}
                    data-pct={d.suggestedDiscountPct}
                    className="flex items-center gap-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-bold text-ink">
                        {d.productName}{' '}
                        {d.variantLabel && (
                          <span className="text-[10px] font-normal text-ink-3">
                            · {d.variantLabel}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-ink-3">
                        <span className="font-bold text-cart">
                          📦 {d.totalStock} adet
                        </span>
                        <span>·</span>
                        <span>
                          30g satış:{' '}
                          <strong className={d.sale30d === 0 ? 'text-danger-7' : ''}>
                            {d.sale30d}
                          </strong>
                        </span>
                        <span>·</span>
                        <span className="text-danger-7 font-bold">
                          ~{stockMonths} stok
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-ink-4">Fiyat</div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[10.5px] text-ink-3 line-through">
                          {d.salePrice}₺
                        </span>
                        <span className="font-mono text-sm font-bold text-arrow-7">
                          {d.suggestedPrice}₺
                        </span>
                      </div>
                      <div
                        data-discount-pct
                        className="mt-0.5 inline-flex rounded-full bg-danger px-1.5 py-0.5 text-[9.5px] font-bold text-white"
                      >
                        -%{d.suggestedDiscountPct}
                      </div>
                    </div>
                    <Link
                      href={`/admin/products/${d.productId}/edit` as never}
                      className="rounded-lg border border-danger/40 bg-white px-2.5 py-1.5 text-[10.5px] font-bold text-danger-7 hover:bg-danger hover:text-white transition-colors"
                    >
                      ✏ Fiyatı düzenle
                    </Link>
                  </li>
                );
              })}
            </ul>
          </article>
        </section>
      )}

      {expiringSuggestions.length > 0 && (
        <section data-testid="petpro-expiring-suggestions">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-cat">
              🤖 PetPro Asistanı · SKT Yaklaşan
            </h2>
            <Link
              href={'/admin/stock-movements' as never}
              className="text-[11px] font-bold text-cat hover:underline"
            >
              Hareketleri aç →
            </Link>
          </div>
          <article className="rounded-2xl border-2 border-danger/30 bg-gradient-to-br from-danger-soft/30 to-cat-soft/20 p-4">
            <p className="mb-3 text-[11px] text-ink-3">
              SKT&apos;si yaklaşan (≤30 gün) veya geçmiş stok satırları — fire kaydı al veya indirimle hızlandır:
            </p>
            <ul className="divide-y divide-line-soft text-xs">
              {expiringSuggestions.map((e) => {
                const toneClass: Record<ExpirySeverity, string> = {
                  expired: 'text-danger-7 font-bold',
                  critical: 'text-danger-7 font-bold',
                  warning: 'text-cart font-bold',
                };
                const badgeClass: Record<ExpirySeverity, string> = {
                  expired: 'bg-danger text-white',
                  critical: 'bg-danger-soft text-danger-7',
                  warning: 'bg-cat-soft text-cart',
                };
                const badgeLabel: Record<ExpirySeverity, string> = {
                  expired: '🚨 GEÇTİ',
                  critical: '⏱ ≤7 gün',
                  warning: '⚠ ≤30 gün',
                };
                return (
                  <li
                    key={`${e.variantId}-${e.branchId}`}
                    data-expiring-suggestion={e.variantId}
                    data-severity={e.severity}
                    className="flex items-center gap-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-bold text-ink">
                        {e.productName}{' '}
                        {e.variantLabel && (
                          <span className="text-[10px] font-normal text-ink-3">
                            · {e.variantLabel}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-ink-3">
                        <span>📍 {e.branchName}</span>
                        <span>·</span>
                        <span className="font-bold text-cart">📦 {e.stockQty} adet</span>
                        <span>·</span>
                        <span className={toneClass[e.severity]}>
                          📅 {e.expiryDate} · {formatExpiryLabel(e.daysUntilExpiry)}
                        </span>
                      </div>
                    </div>
                    <span
                      data-expiring-badge
                      className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold ${badgeClass[e.severity]}`}
                    >
                      {badgeLabel[e.severity]}
                    </span>
                    <Link
                      href={
                        `/admin/stock-movements?variant=${e.variantId}&branch=${e.branchId}` as never
                      }
                      className="rounded-lg border border-danger/40 bg-white px-2.5 py-1.5 text-[10.5px] font-bold text-danger-7 hover:bg-danger hover:text-white transition-colors"
                    >
                      📤 Fire kaydı
                    </Link>
                  </li>
                );
              })}
            </ul>
          </article>
        </section>
      )}

      {orderSuggestions.length > 0 && (
        <section data-testid="petpro-assistant">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-cat">
              🤖 PetPro Asistanı · Sipariş Önerileri
            </h2>
            <Link
              href={'/admin/low-stock' as never}
              className="text-[11px] font-bold text-cat hover:underline"
            >
              Düşük stok detayı →
            </Link>
          </div>
          <article className="rounded-2xl border-2 border-cat/30 bg-gradient-to-br from-cat-soft/40 to-arrow-soft/30 p-4">
            <p className="mb-3 text-[11px] text-ink-3">
              Eşik altı stoklar + son tedarikçiden yeniden sipariş önerisi:
            </p>
            <ul className="divide-y divide-line-soft text-xs">
              {orderSuggestions.map((s) => (
                <li
                  key={`${s.variantId}-${s.branchId}`}
                  data-suggestion-id={s.variantId}
                  className="flex items-center gap-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-bold text-ink">
                      {s.productName}{' '}
                      {s.variantLabel && (
                        <span className="text-[10px] font-normal text-ink-3">
                          · {s.variantLabel}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-ink-3">
                      <span>📍 {s.branchName}</span>
                      <span>·</span>
                      <span className={s.currentStock === 0 ? 'text-danger-7 font-bold' : ''}>
                        Stok: {s.currentStock} / eşik {s.threshold}
                      </span>
                      {s.lastSupplierName ? (
                        <>
                          <span>·</span>
                          <span className="text-arrow-7">
                            🚚 {s.lastSupplierName}
                            {s.lastUnitCost && ` (${s.lastUnitCost}₺ son alış)`}
                          </span>
                        </>
                      ) : (
                        <>
                          <span>·</span>
                          <span className="text-ink-4 italic">tedarikçi bilinmiyor</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-ink-4">Öneri</div>
                    <div className="font-mono text-base font-bold text-cart">
                      +{s.suggestedQty}
                    </div>
                  </div>
                  <Link
                    href={
                      `/admin/stock-movements?variant=${s.variantId}&branch=${s.branchId}` as never
                    }
                    className="rounded-lg border border-cat/40 bg-white px-2.5 py-1.5 text-[10.5px] font-bold text-cart hover:bg-cat hover:text-white transition-colors"
                  >
                    📥 Giriş yap
                  </Link>
                </li>
              ))}
            </ul>
          </article>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <Card title="⚠ Düşük stok" testid="low-stock-card">
          {lowStock.length === 0 ? (
            <p className="rounded-lg bg-arrow-soft/50 px-3 py-4 text-center text-xs text-arrow-7">
              ✓ Hiç düşük stok yok.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-line-soft text-sm">
                {lowStock.map((item) => (
                  <li
                    key={`${item.variantId}-${item.branchId}`}
                    data-low-stock-id={item.variantId}
                  >
                    <Link
                      href={
                        `/admin/stock-movements?variant=${item.variantId}&branch=${item.branchId}` as never
                      }
                      className="flex items-center justify-between gap-2 py-2 hover:bg-line-soft"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-bold text-ink">
                          {item.productName}
                        </div>
                        <div className="text-[11px] text-ink-3">
                          {item.variantLabel} · {item.branchName}
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`font-mono text-base font-bold ${
                            item.stockQty === 0 ? 'text-danger-7' : 'text-cat'
                          }`}
                        >
                          {item.stockQty}
                        </div>
                        <div className="text-[10px] text-ink-4">
                          / {item.threshold} eşik
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href={'/admin/low-stock' as never}
                className="mt-3 block text-center text-[11px] font-bold text-cat hover:underline"
              >
                Tümünü gör + sipariş aksiyonları →
              </Link>
            </>
          )}
        </Card>

        <Card title="🕒 Son hareketler" testid="recent-activity-card">
          {activity.length === 0 ? (
            <p className="rounded-lg bg-line-soft px-3 py-4 text-center text-xs text-ink-3">
              Henüz hareket yok.
            </p>
          ) : (
            <ul className="divide-y divide-line-soft text-xs">
              {activity.map((a) => {
                const badge = TYPE_BADGE[a.type] ?? {
                  label: a.type,
                  cls: 'bg-line-soft',
                };
                const sub = a.subtype ? SUBTYPE_LABEL[a.subtype] : null;
                return (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 py-2"
                  >
                    <span
                      className={`grid h-8 w-8 place-items-center rounded-full text-sm ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold text-ink">
                        {a.productName}{' '}
                        <span className="text-[10px] font-normal text-ink-3">
                          {a.variantLabel}
                        </span>
                      </div>
                      <div className="text-[10px] text-ink-4">
                        {a.branchName}
                        {sub && ` · ${sub}`}
                      </div>
                    </div>
                    <div
                      className={`font-mono text-sm font-bold ${
                        a.quantity > 0 ? 'text-arrow-7' : 'text-danger-7'
                      }`}
                    >
                      {a.quantity > 0 ? '+' : ''}
                      {a.quantity}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-3 flex items-center justify-center gap-3 text-[11px] font-bold">
            <Link
              href={'/admin/stock-movements' as never}
              className="text-cat hover:underline"
              data-testid="recent-activity-all-ledger"
            >
              Tüm ledger →
            </Link>
            <span className="text-ink-4">·</span>
            <Link
              href={
                `/admin/audit-log?from=${todayYmd()}&to=${todayYmd()}` as never
              }
              className="text-cat hover:underline"
              data-testid="recent-activity-today-audit"
            >
              📜 Bugünün audit logu →
            </Link>
          </div>
        </Card>
      </section>
    </main>
  );
}

/** Bugün YYYY-MM-DD — Pano audit-log link'i için. */
function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function KPI({
  title,
  value,
  subtitle,
  emoji,
  accent = 'cat',
  bar,
}: {
  title: string;
  value: number | string;
  subtitle: string;
  emoji: string;
  accent?: 'cat' | 'arrow' | 'danger' | 'neutral';
  bar?: { value: number; max: number };
}) {
  const accentClasses: Record<string, string> = {
    cat: 'border-cat/30 bg-cat-soft/40',
    arrow: 'border-arrow/30 bg-arrow-soft/40',
    danger: 'border-danger/30 bg-danger-soft/40',
    neutral: 'border-line bg-white',
  };

  return (
    <article
      className={`flex flex-col gap-2 rounded-2xl border p-5 ${accentClasses[accent]}`}
      data-kpi={title}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-ink-3">
          {title}
        </span>
        <span className="text-xl">{emoji}</span>
      </div>
      <div className="font-mono text-3xl font-bold text-cart">{value}</div>
      <div className="text-[11px] text-ink-3">{subtitle}</div>
      {bar && bar.max > 0 && (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line-soft">
          <div
            className="h-full bg-cat"
            style={{
              width: `${Math.min(100, (bar.value / bar.max) * 100)}%`,
            }}
          />
        </div>
      )}
    </article>
  );
}

function FeedbackKpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: 'cat' | 'arrow' | 'danger' | 'neutral';
}) {
  const toneCls: Record<string, string> = {
    cat: 'border-cat/30 bg-cat-soft/40',
    arrow: 'border-arrow/30 bg-arrow-soft/40',
    danger: 'border-danger/30 bg-danger-soft/40',
    neutral: 'border-line bg-white',
  };
  return (
    <article
      data-feedback-kpi={label}
      className={`flex flex-col gap-1 rounded-xl border p-3 ${toneCls[tone]}`}
    >
      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-3">
        {label}
      </span>
      <span className="font-mono text-xl font-bold text-cart">{value}</span>
      <span className="text-[10px] text-ink-3">{hint}</span>
    </article>
  );
}

function Card({
  title,
  testid,
  children,
}: {
  title: string;
  testid: string;
  children: React.ReactNode;
}) {
  return (
    <article
      className="rounded-2xl border border-line bg-white p-5"
      data-testid={testid}
    >
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-3">
        {title}
      </h2>
      {children}
    </article>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href as never}
      className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-bold text-cart hover:bg-cat-soft"
    >
      {label}
    </Link>
  );
}

function PanoNotificationItem({ item }: { item: NotificationRow }) {
  const isUnread = item.readAt === null;
  const emoji = item.content.emoji ?? '🔔';
  const link = item.content.link ?? '/admin/notifications';
  return (
    <li>
      <Link
        href={link as never}
        data-pano-notif-id={item.id}
        data-unread={isUnread ? '1' : '0'}
        className={`flex items-start gap-3 rounded-2xl border p-3 hover:shadow-sm transition-shadow ${
          isUnread ? 'border-cat/40 bg-cat-soft/30' : 'border-line bg-white'
        }`}
      >
        <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-white text-lg">
          {emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-[12.5px] font-bold text-cart">
              {item.content.title}
            </h3>
            {isUnread && (
              <span className="rounded-full bg-cat px-1.5 py-0.5 text-[9px] font-bold text-white">
                YENİ
              </span>
            )}
          </div>
          {item.content.body && (
            <p className="truncate text-[10.5px] text-ink-3">{item.content.body}</p>
          )}
        </div>
      </Link>
    </li>
  );
}

function NotificationBell({ unreadCount }: { unreadCount: number }) {
  return (
    <Link
      href={'/admin/notifications' as never}
      data-notif-bell
      data-unread-count={unreadCount}
      aria-label={`Bildirimler${unreadCount > 0 ? ` (${unreadCount} okunmamış)` : ''}`}
      className="relative grid h-9 w-9 place-items-center rounded-xl border border-line bg-white text-lg hover:bg-cat-soft"
    >
      🔔
      {unreadCount > 0 && (
        <span
          data-notif-badge
          className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-cat px-1 py-0.5 text-center text-[10px] font-bold leading-none text-white"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
}

import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { companies } from '@/db/schema';
import { Snowfall } from '@/components/magicui/snowfall';
import { NumberTicker } from '@/components/magicui/number-ticker';
import { PulsatingButton } from '@/components/magicui/pulsating-button';
import {
  getDashboardStats,
  listLowStock,
  listRecentActivity,
} from '@/lib/dashboard/stats';
import { listForUser, type NotificationRow } from '@/lib/notifications/manage';
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

  const [
    companyRow,
    stats,
    lowStock,
    activity,
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

  // v3 pano stilinde Hero başlığı için bugünkü özet
  const todayQtyDisplay = stats.todaySaleQty;
  const todayRevenueDisplay = stats.todaySaleRevenue ?? '0';

  // Yeni register kullanıcı (boş tenant) tespiti — pano welcome variant'a geçer.
  // Onboarding sonrası /admin'e gelen kullanıcının ne göreceği bu branch.
  const isWelcomeState =
    stats.totalProducts === 0 && stats.totalStockQty === 0;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 lg:px-6 py-8 lg:py-10">
      {/* ============ HERO — Cat orange gradient + meteors + logo aside ============ */}
      <section
        data-testid="pano-hero"
        className="relative grid items-center gap-6 overflow-hidden rounded-3xl px-8 py-9 text-white shadow-[0_22px_50px_rgba(212,74,20,.32)] md:grid-cols-[1fr_auto]"
        style={{
          background:
            'radial-gradient(circle at 88% 30%, rgba(255,255,255,.18), transparent 60%), linear-gradient(135deg, #d44a14 0%, #ed6a2c 55%, #d44a14 100%)',
        }}
      >
        <Snowfall number={40} />

        <div className="absolute top-[22px] left-8 z-10 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/85">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-arrow-2" />
          Tüm sistemler çalışıyor
        </div>

        <div className="relative z-10 min-w-0 pt-4">
          <div className="text-[11px] font-bold uppercase tracking-wider opacity-85">
            🐾 Bugün · {company?.name ?? 'Pet shop'}
          </div>

          <h1
            className="mt-3 text-3xl lg:text-4xl font-bold leading-tight tracking-tight"
            data-testid="hero-title"
          >
            {isWelcomeState
              ? `🐾 Hoş geldin, ${company?.name ?? 'pet shop'}!`
              : todayQtyDisplay > 0
                ? `${todayQtyDisplay} satış · ${Number(todayRevenueDisplay).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺ ciro`
                : 'Bugün hareket bekliyor'}
          </h1>
          <p
            className="mt-2 max-w-xl text-[13.5px] leading-relaxed opacity-92"
            data-testid="hero-lead"
          >
            {isWelcomeState ? (
              <>
                Pet shop yönetim paneline hoş geldin. Önce{' '}
                <strong className="rounded-md bg-white/20 px-2 py-0.5">
                  ilk ürünü ekle
                </strong>
                , sonra tedarikçiden stok girişi yap. Vitrin profili ile
                müşteriler seni bulsun.
              </>
            ) : stats.lowStockCount > 0 ? (
              <>
                <strong className="rounded-md bg-white/20 px-2 py-0.5">
                  {stats.lowStockCount} ürün
                </strong>{' '}
                eşik altında — PetPro Asistanı sipariş + transfer önerilerini
                aşağıda hazırladı.
              </>
            ) : (
              <>
                ✓ Düşük stok yok — bu hafta operasyon stabil. Pet shop
                yönetim paneli aktif.
              </>
            )}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {isWelcomeState ? (
              <>
                <Link
                  href={'/admin/products/new' as never}
                  data-testid="hero-add-product"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[12.5px] font-bold text-cart shadow-md hover:-translate-y-0.5 transition-transform"
                >
                  🐾 İlk ürünü ekle
                </Link>
                <Link
                  href={'/admin/settings/storefront' as never}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/35 bg-white/15 px-4 py-2.5 text-[12.5px] font-bold text-white backdrop-blur hover:bg-white/25"
                >
                  🌐 Vitrin profili
                </Link>
              </>
            ) : (
              <>
                <Link
                  href={'/admin/stock-movements' as never}
                  data-testid="hero-stock-in"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[12.5px] font-bold text-cart shadow-md hover:-translate-y-0.5 transition-transform"
                >
                  ＋ Hızlı stok girişi
                </Link>
                <Link
                  href={'/admin/reports' as never}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/35 bg-white/15 px-4 py-2.5 text-[12.5px] font-bold text-white backdrop-blur hover:bg-white/25"
                >
                  Satışı detaylı gör →
                </Link>
              </>
            )}
          </div>

          {/* Branch rail — toplam stok + şube sayısı kısa özet */}
          <div className="mt-4 flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded-full border border-white/30 bg-white px-3 py-1 font-bold text-cart">
              📍 {stats.branchCount} aktif şube · {stats.totalStockQty} adet
              stok
            </span>
            <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 font-bold opacity-90">
              🐾 {stats.totalProducts} ürün ({planLimitLabel})
            </span>
          </div>
        </div>

        {/* Logo aside — mockup'taki rotated white card + logo */}
        <div
          data-testid="hero-logo-wrap"
          className="relative z-10 hidden h-44 w-44 place-items-center md:grid"
        >
          <span
            aria-hidden
            className="absolute inset-0 rounded-[30px] bg-white/95 shadow-[0_14px_34px_rgba(0,0,0,.18)]"
            style={{ transform: 'rotate(-6deg)' }}
          />
          <Image
            src="/logo.png"
            alt="PetStockPro logosu"
            width={158}
            height={158}
            priority
            className="relative z-10 h-[158px] w-[158px] object-contain"
          />
        </div>
      </section>

      {/* ============ ZONE: Bu Hafta — 3 bold KPI ============ */}
      <ZoneLabel emoji="⚡" label="Bu Hafta" />

      <section
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="kpi-trio"
      >
        <KpiBold
          tone="cat"
          label="Bugünkü ciro"
          value={
            Number(todayRevenueDisplay) > 0
              ? `${Number(todayRevenueDisplay).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`
              : '—'
          }
          sub={`${stats.todaySaleQty} satış · bugün`}
          emoji="💰"
        />
        <KpiBold
          tone="cart"
          label="Toplam stok"
          value={stats.totalStockQty.toLocaleString('tr-TR')}
          sub={`${stats.totalActiveVariants} aktif variant`}
          emoji="📦"
        />
        <KpiBold
          tone={stats.lowStockCount > 0 ? 'danger' : 'arrow'}
          label="Düşük stok"
          value={stats.lowStockCount}
          sub={
            stats.lowStockCount > 0
              ? 'eşik altı variant — eylem gerek'
              : '✓ hepsi yeterli'
          }
          emoji={stats.lowStockCount > 0 ? '⚠' : '✓'}
        />
      </section>

      {/* ============ STOCK STRIP — envanter özeti + plan ============ */}
      <article
        className="grid items-center gap-4 rounded-2xl border border-line bg-paper p-5 lg:grid-cols-[1.5fr_1fr_auto]"
        data-testid="stock-strip"
      >
        <div>
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-ink-4">
            Envanter
          </span>
          <div className="mt-1 font-mono text-2xl font-bold text-cart">
            {stats.totalStockQty.toLocaleString('tr-TR')} adet
          </div>
          <p className="mt-1 text-[11.5px] text-ink-3">
            {stats.branchCount} aktif şube · {stats.totalActiveVariants} variant
          </p>
        </div>
        <div>
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-ink-4">
            Plan kullanımı
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-mono text-2xl font-bold text-cart">
              {stats.totalProducts}
            </span>
            <span className="text-[12px] text-ink-4">
              / {planLimit > 0 ? planLimit : '∞'}
            </span>
          </div>
          {planLimit > 0 && (
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line-soft">
              <div
                className="h-full bg-cat"
                style={{
                  width: `${Math.min(100, (stats.totalProducts / planLimit) * 100)}%`,
                }}
              />
            </div>
          )}
        </div>
        <Link
          href={'/admin/products' as never}
          className="rounded-xl border border-cat/40 bg-cat-soft px-4 py-2 text-[11.5px] font-bold text-cart hover:bg-cat hover:text-white"
        >
          Ürünleri yönet →
        </Link>
      </article>

      {/* ============ ALERT — kritik tek mesaj ============ */}
      {stats.lowStockCount > 0 && (
        <article
          data-testid="pano-alert"
          className="flex flex-wrap items-center gap-4 rounded-2xl border-l-4 border-danger bg-danger-soft/40 px-5 py-4"
        >
          <div className="grid h-10 w-10 place-items-center rounded-full bg-danger text-white text-lg">
            ⚠
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-danger-7">
              {stats.lowStockCount} ürün eşik altında veya tükenmek üzere
            </div>
            <div className="text-[11.5px] text-ink-3">
              {orderSuggestions.length > 0
                ? `PetPro Asistanı ${orderSuggestions.length} sipariş önerisi hazırladı — aşağıda incele.`
                : 'Düşük stok detayında sipariş + transfer akışlarına git.'}
            </div>
          </div>
          <Link
            href={'/admin/low-stock' as never}
            data-testid="pano-alert-cta"
            className="inline-block"
          >
            <PulsatingButton
              className="bg-cat hover:bg-cat-2"
              pulseColor="rgba(212,74,20,.5)"
            >
              Düşük stoğa git →
            </PulsatingButton>
          </Link>
        </article>
      )}

      {/* ============ QUICK CHIP ROW ============ */}
      <section
        className="flex flex-wrap gap-2"
        data-testid="quick-chip-row"
      >
        <QuickChip
          href="/admin/stock-movements"
          tone="arrow"
          icon="＋"
          label="Stok girişi"
        />
        <QuickChip
          href="/admin/stock-movements"
          tone="cart"
          icon="$"
          label="Yeni satış"
        />
        <QuickChip
          href="/admin/stock-movements"
          tone="cat"
          icon="⇄"
          label="Transfer"
        />
        <QuickChip
          href="/admin/stocktake"
          tone="bars"
          icon="✓"
          label="Sayım başlat"
        />
        <div className="flex-1" />
        <Link
          href={'/admin/products' as never}
          className="rounded-xl px-3 py-2 text-[11.5px] font-bold text-ink-3 hover:text-cart"
        >
          Tüm ürünleri yönet →
        </Link>
      </section>

      <ZoneLabel emoji="🎯" label="Sırada Ne Var" />

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
          <article className="grid gap-3 rounded-2xl border border-line bg-paper p-4 sm:grid-cols-4">
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
                    className="rounded-lg border border-arrow/40 bg-paper px-2.5 py-1.5 text-[10.5px] font-bold text-arrow-7 hover:bg-arrow hover:text-white transition-colors"
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
                      className="rounded-lg border border-danger/40 bg-paper px-2.5 py-1.5 text-[10.5px] font-bold text-danger-7 hover:bg-danger hover:text-white transition-colors"
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
                      className="rounded-lg border border-danger/40 bg-paper px-2.5 py-1.5 text-[10.5px] font-bold text-danger-7 hover:bg-danger hover:text-white transition-colors"
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
                    className="rounded-lg border border-cat/40 bg-paper px-2.5 py-1.5 text-[10.5px] font-bold text-cart hover:bg-cat hover:text-white transition-colors"
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

/** v3 pano: zone başlığı + sağ tarafa yayılan çizgi */
function ZoneLabel({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div
      data-zone-label={label}
      className="mt-2 flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-ink-4"
    >
      <span>
        {emoji} {label}
      </span>
      <span className="h-px flex-1 bg-gradient-to-r from-line to-transparent" />
    </div>
  );
}

/** v3 pano: bold renkli KPI kartı (3 marka rengi: cat/cart/arrow + danger).
 *  Sayısal `value` ise NumberTicker ile count-up animasyonu uygulanır. */
function KpiBold({
  tone,
  label,
  value,
  sub,
  emoji,
}: {
  tone: 'cat' | 'cart' | 'arrow' | 'danger';
  label: string;
  value: number | string;
  sub: string;
  emoji: string;
}) {
  const toneCls: Record<string, string> = {
    cat: 'bg-gradient-to-br from-cat to-cat-2 shadow-[0_12px_32px_rgba(212,74,20,.18)]',
    cart: 'bg-gradient-to-br from-cart to-cart-2 shadow-[0_12px_32px_rgba(72,30,80,.18)]',
    arrow: 'bg-gradient-to-br from-arrow to-arrow-7 shadow-[0_12px_32px_rgba(22,160,138,.18)]',
    danger: 'bg-gradient-to-br from-danger to-danger-7 shadow-[0_12px_32px_rgba(196,49,49,.20)]',
  };
  const numeric = typeof value === 'number';
  return (
    <article
      data-kpi-bold={label}
      data-kpi-tone={tone}
      className={`relative overflow-hidden rounded-2xl p-6 text-white transition-transform hover:-translate-y-1 ${toneCls[tone]}`}
    >
      <div className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-xl bg-white/20 text-lg">
        {emoji}
      </div>
      <span className="text-[11px] font-bold uppercase tracking-wider opacity-85">
        {label}
      </span>
      <div className="mt-2 font-mono text-4xl font-bold leading-none tracking-tight">
        {numeric ? <NumberTicker value={value as number} className="text-white" /> : value}
      </div>
      <div className="mt-2 text-[11.5px] opacity-90">{sub}</div>
    </article>
  );
}

/** v3 pano: hızlı eylem chip butonu (Stok Girişi / Satış / Transfer / Sayım). */
function QuickChip({
  href,
  tone,
  icon,
  label,
}: {
  href: string;
  tone: 'cat' | 'cart' | 'arrow' | 'bars';
  icon: string;
  label: string;
}) {
  const toneCls: Record<string, { bg: string; text: string }> = {
    cat: { bg: 'bg-cat-soft border-cat/30', text: 'text-cart' },
    cart: { bg: 'bg-bars-soft border-bars/30', text: 'text-cart' },
    arrow: { bg: 'bg-arrow-soft border-arrow/30', text: 'text-arrow-7' },
    bars: { bg: 'bg-line-soft border-line', text: 'text-ink-2' },
  };
  return (
    <Link
      href={href as never}
      data-quick-chip={label}
      className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[12px] font-bold transition hover:-translate-y-0.5 ${toneCls[tone].bg} ${toneCls[tone].text}`}
    >
      <span className="grid h-6 w-6 place-items-center rounded-lg bg-white/70 text-[13px] font-bold">
        {icon}
      </span>
      {label}
    </Link>
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
    neutral: 'border-line bg-paper',
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
      className="rounded-2xl border border-line bg-paper p-5"
      data-testid={testid}
    >
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-3">
        {title}
      </h2>
      {children}
    </article>
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
          isUnread ? 'border-cat/40 bg-cat-soft/30' : 'border-line bg-paper'
        }`}
      >
        <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-paper text-lg">
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

// NotificationBell shared component'e taşındı: src/components/notification-bell.tsx

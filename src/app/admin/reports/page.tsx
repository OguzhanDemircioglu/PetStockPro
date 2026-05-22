import { redirect } from 'next/navigation';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { companies } from '@/db/schema';
import { hasAdvancedReports } from '@/lib/billing/plan-features';
import {
  dailySalesSummary,
  topSellingVariants,
  periodSummary,
} from '@/lib/reports/sales';
import {
  listStocktakeHistory,
  stocktakeHistorySummary,
  type StocktakeHistoryRow,
} from '@/lib/reports/stocktakes';
import {
  activityCountByAction,
  activityTotals,
  type ActivityCountRow,
} from '@/lib/reports/activity';
import {
  getInventoryValueSummary,
  getInventoryValueByCategory,
  getTopInventoryValueVariants,
} from '@/lib/reports/inventory-value';
import {
  topCustomers,
  customerSummary,
  busiestHours,
} from '@/lib/reports/customers';
import {
  getPeriodComparison,
  formatChangePct,
} from '@/lib/reports/period-comparison';
import {
  listOpenCredits,
  getOpenCreditsSummary,
} from '@/lib/reports/open-credits';
import { SettleCreditButton } from './settle-credit-button';

const RANGE_OPTIONS = [7, 30, 90];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const params = await searchParams;
  const daysRaw = params.days ? parseInt(params.days, 10) : 30;
  const days = RANGE_OPTIONS.includes(daysRaw) ? daysRaw : 30;

  // 2026-05-22 Karar A revize — Gelişmiş raporlar PRO + PRO+
  // FREE plan'da Pano KPI yeterli (temel ciro/hareket/düşük stok); detaylı
  // /admin/reports sayfası (period comparison + top selling + customer report
  // + open credits + inventory value + activity actions) PRO'ya özel.
  const [companyPlan] = await db
    .select({ plan: companies.plan })
    .from(companies)
    .where(eq(companies.id, session.user.companyId))
    .limit(1);
  if (!hasAdvancedReports(companyPlan?.plan ?? 'FREE')) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
        <header>
          <Link href={'/admin' as never} className="text-xs text-ink-4 hover:text-cart">
            ← Pano'ya dön
          </Link>
          <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-cart">
            Gelişmiş raporlar
          </h1>
        </header>
        <div className="rounded-2xl border-2 border-cat/40 bg-cat-soft/30 p-6">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-cat px-3 py-1 text-[12px] font-bold uppercase tracking-wider text-white">
            ⭐ PRO Özelliği
          </div>
          <h2 className="text-xl font-bold text-cart">
            Detaylı analitik PRO planında
          </h2>
          <p className="mt-3 text-sm text-ink-2">
            FREE planında <strong>Pano</strong> sayfasında temel KPI'ları
            (bugünkü ciro, hareket sayısı, düşük stok) görürsün. PRO planında ek:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-2">
            <li>📈 Dönem karşılaştırma (bu hafta vs geçen / 30 gün vs önceki 30)</li>
            <li>🏆 En çok satan variantlar + günlük breakdown</li>
            <li>👥 Müşteri raporu + en yoğun saatler</li>
            <li>💰 Açık veresiyeler + aging</li>
            <li>💎 Envanter değeri + kategori bazında</li>
            <li>📜 Aktivite logu (aksiyon istatistiği)</li>
            <li>⬇ Excel export</li>
          </ul>
          <div className="mt-5 flex gap-3">
            <Link
              href={'/admin/settings' as never}
              className="rounded-xl bg-cat px-5 py-2.5 text-sm font-bold text-white hover:bg-cat/90"
            >
              PRO'ya geç →
            </Link>
            <Link
              href={'/admin' as never}
              className="rounded-xl border border-line bg-paper px-5 py-2.5 text-sm font-bold text-cart hover:bg-cat-soft"
            >
              Pano'ya dön
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const [
    summary,
    daily,
    topVariants,
    stocktakeHistory,
    stocktakeSummary,
    activityActions,
    activityStats,
    invSummary,
    invByCategory,
    invTopVariants,
    custTop,
    custSummary,
    hourly,
    cmpWeek,
    cmpMonth,
    openCredits,
    openCreditsSummary,
  ] = await Promise.all([
    periodSummary(session.user.companyId, db, days),
    dailySalesSummary(session.user.companyId, db, days),
    topSellingVariants(session.user.companyId, db, days, 10),
    listStocktakeHistory(session.user.companyId, db, days, 10),
    stocktakeHistorySummary(session.user.companyId, db, days),
    activityCountByAction(session.user.companyId, db, days, 10),
    activityTotals(session.user.companyId, db, days),
    getInventoryValueSummary(session.user.companyId, db),
    getInventoryValueByCategory(session.user.companyId, db, 8),
    getTopInventoryValueVariants(session.user.companyId, db, 10),
    topCustomers(session.user.companyId, db, days, 10),
    customerSummary(session.user.companyId, db, days),
    busiestHours(session.user.companyId, db, days),
    getPeriodComparison(session.user.companyId, db, 'week'),
    getPeriodComparison(session.user.companyId, db, 'month'),
    listOpenCredits(session.user.companyId, db, { limit: 50 }),
    getOpenCreditsSummary(session.user.companyId, db),
  ]);

  // Maks qty bul, bar grafik için ölçek
  const maxDailyQty = daily.reduce((m, r) => Math.max(m, r.qty), 0);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[13px] font-bold uppercase tracking-wider text-cat">
            Admin · Raporlar
          </div>
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
            Satış raporu
          </h1>
          <p className="mt-1 text-sm text-ink-3">
            Son {days} gün · Sadece <strong>satış</strong> hareketleri
            (reversedları hariç)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-2" data-testid="range-picker">
            {RANGE_OPTIONS.map((d) => (
              <Link
                key={d}
                href={`/admin/reports?days=${d}` as never}
                className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${
                  d === days
                    ? 'border-cat bg-cat text-white'
                    : 'border-line bg-paper text-ink-3 hover:bg-line-soft'
                }`}
              >
                {d} gün
              </Link>
            ))}
          </div>
          <div className="flex gap-2 border-l border-line pl-3">
            <a
              href={`/admin/reports/export?days=${days}&kind=daily`}
              download
              data-testid="export-daily"
              className="rounded-xl border border-line bg-paper px-3 py-1.5 text-xs font-bold text-cart hover:bg-cat-soft"
            >
              ⬇ Günlük CSV
            </a>
            <a
              href={`/admin/reports/export?days=${days}&kind=top`}
              download
              data-testid="export-top"
              className="rounded-xl border border-line bg-paper px-3 py-1.5 text-xs font-bold text-cart hover:bg-cat-soft"
            >
              ⬇ Top variant CSV
            </a>
          </div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI title="Toplam adet" value={summary.totalQty} emoji="📦" />
        <KPI
          title="Toplam ciro"
          value={`${formatTRY(summary.totalRevenue)}`}
          emoji="💰"
          accent="cat"
        />
        <KPI title="Satış sayısı" value={summary.saleCount} emoji="🛍" />
        <KPI
          title="Ort. sepet"
          value={`${formatTRY(summary.avgBasket)}`}
          emoji="🧾"
        />
      </section>

      <section data-testid="period-comparison">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
          📈 Dönem karşılaştırma
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <ComparisonCard label="Bu hafta vs geçen hafta" cmp={cmpWeek} />
          <ComparisonCard label="Son 30 gün vs önceki 30 gün" cmp={cmpMonth} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3" title={`📊 Günlük satış (${daily.length} gün)`}>
          {daily.length === 0 ? (
            <p className="rounded-lg bg-line-soft px-3 py-4 text-center text-xs text-ink-3">
              Bu dönemde satış yok.
            </p>
          ) : (
            <ul className="flex flex-col gap-2" data-testid="daily-list">
              {daily.map((row) => (
                <li
                  key={row.day}
                  className="grid grid-cols-[80px_1fr_auto] items-center gap-3 text-xs"
                  data-day={row.day}
                >
                  <span className="font-mono text-ink-3">{row.day}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-line-soft">
                    <div
                      className="h-full bg-gradient-to-r from-cat to-cat-2"
                      style={{
                        width: `${maxDailyQty > 0 ? (row.qty / maxDailyQty) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="flex gap-3 font-mono text-ink">
                    <span className="text-arrow-7">{row.qty} ad</span>
                    <span className="text-cart">{formatTRY(row.revenue)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2" title={`🏆 En çok satan (son ${days} gün)`}>
          {topVariants.length === 0 ? (
            <p className="rounded-lg bg-line-soft px-3 py-4 text-center text-xs text-ink-3">
              Satılan ürün yok.
            </p>
          ) : (
            <ol className="divide-y divide-line-soft text-xs" data-testid="top-list">
              {topVariants.map((v, i) => (
                <li key={v.variantId} className="flex items-center gap-2 py-2">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-cat-soft text-[12px] font-bold text-cart">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-ink">
                      {v.productName}
                    </div>
                    <div className="text-[12px] text-ink-3">
                      {v.variantLabel} · SKU {v.sku}
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="font-bold text-arrow-7">{v.totalQty} ad</div>
                    <div className="text-[11.5px] text-cart">
                      {formatTRY(v.totalRevenue)}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
          📋 Sayım geçmişi (son {days} gün)
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPI
            title="Tamamlanan"
            value={stocktakeSummary.completedCount}
            emoji="✓"
            accent="arrow"
          />
          <KPI
            title="İptal"
            value={stocktakeSummary.cancelledCount}
            emoji="×"
            accent="arrow"
          />
          <KPI
            title="Toplam fark"
            value={stocktakeSummary.totalDiffItems}
            emoji="⚠"
            accent="cat"
          />
          <KPI
            title="Ort. süre"
            value={
              stocktakeSummary.avgDurationMinutes == null
                ? '—'
                : `${stocktakeSummary.avgDurationMinutes} dk`
            }
            emoji="⏱"
            accent="arrow"
          />
        </div>

        <Card title="Son sayımlar" className="mt-4">
          {stocktakeHistory.length === 0 ? (
            <p className="rounded-lg bg-line-soft px-3 py-4 text-center text-xs text-ink-3">
              Bu dönemde tamamlanmış/iptal sayım yok.
            </p>
          ) : (
            <ul
              className="divide-y divide-line-soft text-xs"
              data-testid="stocktake-history-list"
            >
              {stocktakeHistory.map((s) => (
                <StocktakeRow key={s.id} item={s} />
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
          📜 Audit aktivitesi (son {days} gün)
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KPI title="Toplam aksiyon" value={activityStats.totalActions} emoji="🔢" />
          <KPI
            title="Aksiyon türü"
            value={activityStats.uniqueActionTypes}
            emoji="🗂"
            accent="arrow"
          />
          <KPI title="Aktif kullanıcı" value={activityStats.uniqueUsers} emoji="👥" />
        </div>
        <Card title={`En çok kullanılan aksiyonlar (son ${days} gün)`} className="mt-4">
          {activityActions.length === 0 ? (
            <p className="rounded-lg bg-line-soft px-3 py-4 text-center text-xs text-ink-3">
              Bu dönemde audit kaydı yok.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5" data-testid="activity-actions">
              {activityActions.map((a) => (
                <ActivityActionRow key={a.action} item={a} max={activityActions[0]?.count ?? 1} />
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section data-testid="inventory-value">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
          💎 Stok değer raporu (anlık)
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPI
            title="Toplam değer (cost)"
            value={`${Number(invSummary.totalValueCost || 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}₺`}
            emoji="💎"
            accent="arrow"
          />
          <KPI
            title="Toplam stok"
            value={invSummary.totalQty}
            emoji="📦"
          />
          <KPI
            title="Aktif variant"
            value={invSummary.variantCount}
            emoji="🏷"
          />
          <KPI
            title="Maliyet eksik"
            value={invSummary.missingCostCount}
            emoji={invSummary.missingCostCount > 0 ? '⚠' : '✓'}
            accent={invSummary.missingCostCount > 0 ? 'cat' : 'arrow'}
          />
        </div>

        {invSummary.missingCostCount > 0 && (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-danger/30 bg-danger-soft px-4 py-2.5 text-[13.5px] text-danger-7"
          >
            ⚠ {invSummary.missingCostCount} variant&apos;ın <code>cost_price</code>{' '}
            tanımlı değil. Bu variantlar değer hesabına dahil edilmedi —
            <Link href={'/admin/products' as never} className="ml-1 font-bold underline">
              Ürünler sayfasından düzelt
            </Link>
            .
          </div>
        )}

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card title="Kategori bazında en yüksek değer">
            {invByCategory.length === 0 ? (
              <p className="rounded-lg bg-line-soft px-3 py-4 text-center text-xs text-ink-3">
                Aktif stok yok.
              </p>
            ) : (
              <ul className="divide-y divide-line-soft text-xs">
                {invByCategory.map((c) => (
                  <li
                    key={c.categoryId ?? c.categoryName}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold text-ink">
                        {c.categoryEmoji ?? '📂'} {c.categoryName}
                      </div>
                      <div className="text-[12px] text-ink-3">
                        {c.productCount} ürün · {c.totalQty} adet
                      </div>
                    </div>
                    <div className="text-right font-mono text-sm font-bold text-arrow-7">
                      {Number(c.totalValueCost || 0).toLocaleString('tr-TR', {
                        maximumFractionDigits: 2,
                      })}₺
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="En değerli variantlar (top 10)">
            {invTopVariants.length === 0 ? (
              <p className="rounded-lg bg-line-soft px-3 py-4 text-center text-xs text-ink-3">
                Aktif variant yok.
              </p>
            ) : (
              <ul className="divide-y divide-line-soft text-xs">
                {invTopVariants.map((v) => (
                  <li key={v.variantId} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold text-ink">
                        {v.productName}{' '}
                        {v.variantLabel && (
                          <span className="text-[11.5px] font-normal text-ink-3">
                            · {v.variantLabel}
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] text-ink-3">
                        {v.totalQty} adet × {v.unitCost ?? '?'}₺
                      </div>
                    </div>
                    <div className="text-right font-mono text-sm font-bold text-arrow-7">
                      {Number(v.totalValueCost || 0).toLocaleString('tr-TR', {
                        maximumFractionDigits: 2,
                      })}₺
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </section>

      <section data-testid="customers-report">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
          👥 Müşteri analitik (son {days} gün)
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KPI title="Tekil müşteri" value={custSummary.uniqueCustomers} emoji="👤" />
          <KPI title="Kayıtlı satış" value={custSummary.totalSalesWithRef} emoji="✓" accent="arrow" />
          <KPI title="Anonim satış" value={custSummary.totalSalesAnonymous} emoji="?" />
          <KPI title="Veresiye" value={custSummary.creditSalesCount} emoji="📝" accent={custSummary.creditSalesCount > custSummary.creditPaidCount ? 'cat' : 'arrow'} />
          <KPI
            title="Veresiye tahsil"
            value={`${custSummary.creditPaidCount}/${custSummary.creditSalesCount}`}
            emoji="💰"
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card title={`Top alıcı (customerRef bazında, top ${custTop.length})`}>
            {custTop.length === 0 ? (
              <p className="rounded-lg bg-line-soft px-3 py-4 text-center text-xs text-ink-3">
                Bu dönemde customerRef kayıtlı satış yok.
              </p>
            ) : (
              <ul className="divide-y divide-line-soft text-xs">
                {custTop.map((c, i) => (
                  <li key={c.customerRef} className="flex items-center gap-3 py-2">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-cat-soft text-[12.5px] font-bold text-cart">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono font-bold text-ink">
                        {c.customerRef}
                      </div>
                      <div className="text-[12px] text-ink-3">
                        {c.salesCount} satış · {c.totalQty} adet · son:{' '}
                        {new Date(c.lastSaleAt).toLocaleDateString('tr-TR', {
                          day: '2-digit',
                          month: '2-digit',
                        })}
                      </div>
                    </div>
                    <div className="font-mono text-sm font-bold text-arrow-7">
                      {Number(c.totalRevenue || 0).toLocaleString('tr-TR', {
                        maximumFractionDigits: 2,
                      })}₺
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="En yoğun saatler (TR saati)">
            {hourly.length === 0 ? (
              <p className="rounded-lg bg-line-soft px-3 py-4 text-center text-xs text-ink-3">
                Bu dönemde satış yok.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5" data-testid="hourly-breakdown">
                {hourly.map((h) => {
                  const max = hourly.reduce((m, x) => Math.max(m, x.qty), 1);
                  const pct = max > 0 ? (h.qty / max) * 100 : 0;
                  return (
                    <li key={h.hour} className="flex items-center gap-2 text-[12.5px]">
                      <span className="w-12 font-mono text-ink-3">
                        {String(h.hour).padStart(2, '0')}:00
                      </span>
                      <div className="flex-1 overflow-hidden rounded-full bg-line-soft">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-cat to-cat-2"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-12 text-right font-mono font-bold text-cart">
                        {h.qty}
                      </span>
                      <span className="w-20 text-right font-mono text-[11.5px] text-ink-4">
                        {Number(h.revenue || 0).toLocaleString('tr-TR', {
                          maximumFractionDigits: 0,
                        })}₺
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </section>

      <section data-testid="open-credits">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
          💳 Açık krediler (veresiye — tüm zaman)
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KPI
            title="Toplam açık"
            value={openCreditsSummary.totalCount}
            emoji="💳"
            accent={openCreditsSummary.totalCount > 0 ? 'cat' : 'arrow'}
          />
          <KPI
            title="Toplam tutar"
            value={`${formatTRY(openCreditsSummary.totalAmount)}`}
            emoji="💰"
            accent={openCreditsSummary.totalCount > 0 ? 'cat' : 'arrow'}
          />
          <KPI
            title="En eski"
            value={
              openCreditsSummary.oldestDays === 0 && openCreditsSummary.totalCount === 0
                ? '—'
                : `${openCreditsSummary.oldestDays} gün`
            }
            emoji="⏳"
            accent={openCreditsSummary.oldestDays >= 61 ? 'cat' : 'arrow'}
          />
        </div>

        <Card title="Yaş analizi" className="mt-4">
          <ul
            className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
            data-testid="open-credits-bands"
          >
            {openCreditsSummary.byBand.map((b) => (
              <AgingBandCard key={b.label} band={b} />
            ))}
          </ul>
        </Card>

        <Card title={`Açık kredi listesi (${openCredits.length} kayıt)`} className="mt-4">
          {openCredits.length === 0 ? (
            <p className="rounded-lg bg-arrow-soft/40 px-3 py-4 text-center text-xs text-arrow-7">
              ✓ Açık veresiye yok — tüm krediler tahsil edildi.
            </p>
          ) : (
            <ul
              className="divide-y divide-line-soft text-xs"
              data-testid="open-credits-list"
            >
              {openCredits.map((row) => (
                <OpenCreditRow key={row.movementId} item={row} />
              ))}
            </ul>
          )}
        </Card>
      </section>

      <Link
        href={'/admin' as never}
        className="text-center text-xs text-ink-4 hover:text-cart"
      >
        ← Pano&apos;ya dön
      </Link>
    </main>
  );
}

function AgingBandCard({
  band,
}: {
  band: import('@/lib/reports/open-credits').AgingBand;
}) {
  const danger = band.label === '60+' && band.count > 0;
  return (
    <li
      data-band={band.label}
      className={`flex flex-col gap-1 rounded-xl border px-3 py-3 ${
        danger
          ? 'border-danger/30 bg-danger-soft/40'
          : band.count > 0
            ? 'border-cat/30 bg-cat-soft/40'
            : 'border-line bg-paper'
      }`}
    >
      <span className="text-[11.5px] font-bold uppercase tracking-wider text-ink-3">
        {band.label} gün
      </span>
      <span className="font-mono text-base font-bold text-cart">
        {band.count} kayıt
      </span>
      <span className="font-mono text-[12.5px] text-ink-3">
        {formatTRY(band.amount)}
      </span>
    </li>
  );
}

function OpenCreditRow({
  item,
}: {
  item: import('@/lib/reports/open-credits').OpenCreditRow;
}) {
  const danger = item.daysOpen >= 61;
  const mid = item.daysOpen >= 31 && item.daysOpen < 61;
  return (
    <li
      data-movement-id={item.movementId}
      className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2"
    >
      <div className="min-w-0">
        <div className="truncate font-bold text-ink">
          {item.customerRef ?? '— anonim —'}
        </div>
        <div className="text-[12px] text-ink-3">
          {item.productName}
          {item.variantLabel ? ` · ${item.variantLabel}` : ''} · {item.quantity} ad ·{' '}
          {item.branchName}
        </div>
        <div className="text-[11.5px] text-ink-4">
          {new Date(item.createdAt).toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}{' '}
          ·{' '}
          <span
            className={
              danger
                ? 'font-bold text-danger-7'
                : mid
                  ? 'font-bold text-cat'
                  : 'text-ink-3'
            }
          >
            {item.daysOpen} gün
          </span>
        </div>
      </div>
      <div className="font-mono text-sm font-bold text-cart" data-amount={item.amount}>
        {formatTRY(item.amount)}
      </div>
      <SettleCreditButton movementId={item.movementId} />
    </li>
  );
}

const ACTION_LABEL: Record<string, string> = {
  'stock.in': '📥 Stok girişi',
  'stock.out': '📤 Stok çıkışı',
  'stock.transfer': '🔁 Transfer',
  'stock.stocktake': '📋 Sayım hareketi',
  'stock.reversed': '↶ Geri alma',
  'stocktake.started': '🟢 Sayım başlatıldı',
  'stocktake.completed': '✅ Sayım tamamlandı',
  'stocktake.cancelled': '× Sayım iptal',
  'storefront.published': '🌐 Vitrin açıldı',
  'storefront.unpublished': '🔒 Vitrin kapatıldı',
  'storefront.settings_updated': '🌐 Vitrin profili güncellendi',
  'product.created': 'Ürün eklendi',
  'product.updated': '✎ Ürün güncellendi',
  'product.deleted': '🗑 Ürün silindi',
  'brand.created': '🏷 Marka eklendi',
  'brand.deleted': '🗑 Marka silindi',
  'category.created': '📂 Kategori eklendi',
  'supplier.created': '🏢 Tedarikçi eklendi',
  'branch.created': '🏪 Şube eklendi',
  'company.updated': '⚙ Firma güncellendi',
};

function ActivityActionRow({ item, max }: { item: ActivityCountRow; max: number }) {
  const label = ACTION_LABEL[item.action] ?? item.action;
  const pct = max > 0 ? (item.count / max) * 100 : 0;
  return (
    <li
      data-action-key={item.action}
      className="grid grid-cols-[180px_1fr_50px] items-center gap-3 text-xs"
    >
      <span className="truncate font-mono text-[12px] text-ink-2">{label}</span>
      <div className="h-2 overflow-hidden rounded-full bg-line-soft">
        <div
          className="h-full bg-gradient-to-r from-cat to-arrow"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-right font-mono font-bold text-cart">{item.count}</span>
    </li>
  );
}

function StocktakeRow({ item }: { item: StocktakeHistoryRow }) {
  const isCompleted = item.status === 'completed';
  return (
    <li
      data-stocktake-history-id={item.id}
      className="grid grid-cols-[110px_1fr_auto] items-center gap-3 py-2"
    >
      <span
        className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-bold ${
          isCompleted ? 'bg-arrow-soft text-arrow-7' : 'bg-danger-soft text-danger-7'
        }`}
      >
        {isCompleted ? '✓ Tamamlandı' : '× İptal'}
      </span>
      <div className="min-w-0">
        <Link
          href={`/admin/stocktake/${item.id}` as never}
          className="truncate font-bold text-cart hover:text-cat hover:underline"
        >
          #{item.id.slice(0, 8)} · {item.branchName ?? '—'}
        </Link>
        <div className="text-[12px] text-ink-3">
          {item.startedByEmail ?? '—'} ·{' '}
          {item.closedAt
            ? new Date(item.closedAt).toLocaleString('tr-TR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '—'}
        </div>
      </div>
      <div className="text-right font-mono">
        <div className="text-[12.5px] font-bold text-ink">
          {item.countedItems}/{item.totalItems}
        </div>
        <div className="text-[11.5px] text-cart">
          {item.diffItems > 0 ? `${item.diffItems} fark` : 'fark yok'}
          {item.durationMinutes != null && ` · ${item.durationMinutes} dk`}
        </div>
      </div>
    </li>
  );
}

function formatTRY(value: string | number): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(n)) return '0₺';
  return `${n.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}₺`;
}

function ComparisonCard({
  label,
  cmp,
}: {
  label: string;
  cmp: import('@/lib/reports/period-comparison').PeriodComparisonResult;
}) {
  const qtyChange = formatChangePct(cmp.qtyChangePct);
  const revChange = formatChangePct(cmp.revenueChangePct);
  const cntChange = formatChangePct(cmp.countChangePct);

  const toneClass: Record<string, string> = {
    up: 'text-arrow-7',
    down: 'text-danger-7',
    neutral: 'text-ink-3',
    new: 'text-cat',
  };

  return (
    <article className="rounded-2xl border border-line bg-paper p-5">
      <h3 className="text-[12.5px] font-bold uppercase tracking-wider text-cart">{label}</h3>
      <ul className="mt-3 flex flex-col divide-y divide-line-soft text-[13.5px]">
        <li className="flex items-center justify-between py-2">
          <span className="text-ink-3">Adet</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-ink-2">
              {cmp.current.qty} <span className="text-[11.5px] text-ink-4">/ {cmp.previous.qty}</span>
            </span>
            <span className={`font-mono text-[13px] font-bold ${toneClass[qtyChange.tone]}`}>
              {qtyChange.label}
            </span>
          </div>
        </li>
        <li className="flex items-center justify-between py-2">
          <span className="text-ink-3">Ciro</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-ink-2">
              {formatTRY(cmp.current.revenue)}{' '}
              <span className="text-[11.5px] text-ink-4">
                / {formatTRY(cmp.previous.revenue)}
              </span>
            </span>
            <span className={`font-mono text-[13px] font-bold ${toneClass[revChange.tone]}`}>
              {revChange.label}
            </span>
          </div>
        </li>
        <li className="flex items-center justify-between py-2">
          <span className="text-ink-3">Satış sayısı</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-ink-2">
              {cmp.current.saleCount}{' '}
              <span className="text-[11.5px] text-ink-4">/ {cmp.previous.saleCount}</span>
            </span>
            <span className={`font-mono text-[13px] font-bold ${toneClass[cntChange.tone]}`}>
              {cntChange.label}
            </span>
          </div>
        </li>
      </ul>
    </article>
  );
}

function KPI({
  title,
  value,
  emoji,
  accent = 'arrow',
}: {
  title: string;
  value: number | string;
  emoji: string;
  accent?: 'cat' | 'arrow';
}) {
  const accentClasses: Record<string, string> = {
    cat: 'border-cat/30 bg-cat-soft/40',
    arrow: 'border-arrow/30 bg-arrow-soft/40',
  };
  return (
    <article
      className={`flex flex-col gap-2 rounded-2xl border p-5 ${accentClasses[accent]}`}
      data-kpi={title}
    >
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

function Card({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <article
      className={`rounded-2xl border border-line bg-paper p-5 ${className ?? ''}`}
    >
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-3">
        {title}
      </h2>
      {children}
    </article>
  );
}

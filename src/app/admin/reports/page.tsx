import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import {
  dailySalesSummary,
  topSellingVariants,
  periodSummary,
} from '@/lib/reports/sales';

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

  const [summary, daily, topVariants] = await Promise.all([
    periodSummary(session.user.companyId, db, days),
    dailySalesSummary(session.user.companyId, db, days),
    topSellingVariants(session.user.companyId, db, days, 10),
  ]);

  // Maks qty bul, bar grafik için ölçek
  const maxDailyQty = daily.reduce((m, r) => Math.max(m, r.qty), 0);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11.5px] font-bold uppercase tracking-wider text-cat">
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
                    : 'border-line bg-white text-ink-3 hover:bg-line-soft'
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
              className="rounded-xl border border-line bg-white px-3 py-1.5 text-xs font-bold text-cart hover:bg-cat-soft"
            >
              ⬇ Günlük CSV
            </a>
            <a
              href={`/admin/reports/export?days=${days}&kind=top`}
              download
              data-testid="export-top"
              className="rounded-xl border border-line bg-white px-3 py-1.5 text-xs font-bold text-cart hover:bg-cat-soft"
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

        <Card className="lg:col-span-2" title="🏆 En çok satan">
          {topVariants.length === 0 ? (
            <p className="rounded-lg bg-line-soft px-3 py-4 text-center text-xs text-ink-3">
              Satılan ürün yok.
            </p>
          ) : (
            <ol className="divide-y divide-line-soft text-xs" data-testid="top-list">
              {topVariants.map((v, i) => (
                <li key={v.variantId} className="flex items-center gap-2 py-2">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-cat-soft text-[10.5px] font-bold text-cart">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-ink">
                      {v.productName}
                    </div>
                    <div className="text-[10.5px] text-ink-3">
                      {v.variantLabel} · SKU {v.sku}
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="font-bold text-arrow-7">{v.totalQty} ad</div>
                    <div className="text-[10px] text-cart">
                      {formatTRY(v.totalRevenue)}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
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

function formatTRY(value: string | number): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(n)) return '0₺';
  return `${n.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}₺`;
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
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-ink-3">
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
      className={`rounded-2xl border border-line bg-white p-5 ${className ?? ''}`}
    >
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-3">
        {title}
      </h2>
      {children}
    </article>
  );
}

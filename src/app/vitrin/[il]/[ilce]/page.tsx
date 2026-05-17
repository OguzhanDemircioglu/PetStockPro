import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { db } from '@/lib/db/client';
import {
  buildWhatsappLink,
  countPublicStorefronts,
  getDistrictBySlug,
  listPublicStorefronts,
  parseSortParam,
  STOREFRONT_SORTS,
  type ListStorefrontsFilters,
  type StorefrontSort,
} from '@/lib/vitrin/public';
import { trackVitrinEventAsync } from '@/lib/vitrin/track';
import { WhatsappButton } from '@/components/vitrin/whatsapp-button';

export const dynamic = 'force-dynamic';

interface SearchParams {
  q?: string;
  page?: string;
  sort?: string;
}

const PAGE_SIZE = 24;
const SORT_LABEL: Record<StorefrontSort, string> = {
  name_asc: 'A — Z',
  recent: 'En son aktif',
  products_desc: 'Ürün sayısı (çoktan aza)',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ il: string; ilce: string }>;
}) {
  const { il, ilce } = await params;
  const found = await getDistrictBySlug(il, ilce, db);
  if (!found) {
    return { title: 'Sayfa bulunamadı — PetStockPro' };
  }
  return {
    title: `${found.district.name}, ${found.city.name} Pet Shop'lar — PetStockPro`,
    description: `${found.district.name} ilçesindeki pet shop'lar. WhatsApp ile direkt iletişim kur.`,
  };
}

export default async function VitrinDistrictPage({
  params,
  searchParams,
}: {
  params: Promise<{ il: string; ilce: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ il, ilce }, qp] = await Promise.all([params, searchParams]);
  const found = await getDistrictBySlug(il, ilce, db);
  if (!found) {
    notFound();
  }
  const { city, district } = found;

  const filters: ListStorefrontsFilters = {
    cityId: city.id,
    districtId: district.id,
  };
  if (qp.q && qp.q.trim().length > 0) {
    filters.q = qp.q.trim().slice(0, 100);
  }
  const sort = parseSortParam(qp.sort);
  filters.sort = sort;
  const page = Math.max(1, Number.parseInt(qp.page ?? '1', 10) || 1);
  filters.limit = PAGE_SIZE;
  filters.offset = (page - 1) * PAGE_SIZE;

  const [storefronts, totalCount] = await Promise.all([
    listPublicStorefronts(db, filters),
    countPublicStorefronts(db, {
      cityId: city.id,
      districtId: district.id,
      q: filters.q,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const isFirstPage = page <= 1;
  const isLastPage = page >= totalPages;

  // Search tracking — KVKK anonim
  const hdrs = await headers();
  const xff = hdrs.get('x-forwarded-for') ?? hdrs.get('x-real-ip');
  const ip = xff ? xff.split(',')[0].trim() : undefined;
  const ua = hdrs.get('user-agent') ?? undefined;
  if (filters.q) {
    for (const sf of storefronts.slice(0, 5)) {
      trackVitrinEventAsync(
        {
          companyId: sf.companyId,
          eventType: 'search',
          searchQuery: filters.q,
          ipAddress: ip,
          userAgent: ua,
        },
        db,
      );
    }
  }

  function buildPageUrl(p: number): string {
    const qs = new URLSearchParams();
    if (filters.q) qs.set('q', filters.q);
    if (sort !== 'name_asc') qs.set('sort', sort);
    if (p > 1) qs.set('page', String(p));
    const str = qs.toString();
    return str
      ? `/vitrin/${city.slug}/${district.slug}?${str}`
      : `/vitrin/${city.slug}/${district.slug}`;
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="text-[13px] text-ink-3"
        data-testid="vitrin-breadcrumb"
      >
        <Link href={'/vitrin' as never} className="hover:text-cat">
          Vitrin
        </Link>
        <span className="mx-1.5">/</span>
        <Link
          href={`/vitrin/${city.slug}` as never}
          className="hover:text-cat"
          data-testid="breadcrumb-city"
        >
          {city.name}
        </Link>
        <span className="mx-1.5">/</span>
        <span className="font-bold text-cart">{district.name}</span>
      </nav>

      <section className="rounded-3xl bg-gradient-to-br from-cat-soft/40 via-arrow-soft/30 to-paper p-6 lg:p-10">
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-cart">
          {`🐾 ${district.name}, ${city.name} Pet Shop'lar`}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-ink-2">
          {`${district.name} ilçesindeki pet shop'lar. WhatsApp'tan direkt mağaza ile iletişim kur.`}
        </p>

        <form
          method="get"
          action={`/vitrin/${city.slug}/${district.slug}`}
          className="mt-5 flex flex-wrap items-end gap-3"
          data-testid="vitrin-district-filter"
        >
          <div className="flex-1 min-w-[220px]">
            <label
              htmlFor="q"
              className="mb-1 block text-[12px] font-bold uppercase tracking-wider text-ink-3"
            >
              Arama
            </label>
            <input
              id="q"
              name="q"
              defaultValue={filters.q ?? ''}
              placeholder="Pet shop adı veya hakkında metin…"
              data-testid="vitrin-search"
              className="w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-2.5 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
            />
          </div>
          <div className="min-w-[180px]">
            <label
              htmlFor="sort"
              className="mb-1 block text-[12px] font-bold uppercase tracking-wider text-ink-3"
            >
              Sıralama
            </label>
            <select
              id="sort"
              name="sort"
              defaultValue={sort}
              data-testid="vitrin-sort"
              className="w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-2.5 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
            >
              {STOREFRONT_SORTS.map((s) => (
                <option key={s} value={s}>
                  {SORT_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-xl bg-cat px-5 py-2.5 text-sm font-bold text-white shadow-sm"
          >
            🔍 Filtrele
          </button>
          {(filters.q || sort !== 'name_asc') && (
            <Link
              href={`/vitrin/${city.slug}/${district.slug}` as never}
              className="rounded-xl border border-line bg-paper px-3 py-2.5 text-xs font-bold text-ink-3 hover:bg-line-soft"
              data-testid="vitrin-clear"
            >
              × Temizle
            </Link>
          )}
        </form>
      </section>

      <section data-testid="vitrin-results">
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h2
            className="text-sm font-bold uppercase tracking-wider text-ink-3"
            data-testid="vitrin-result-count"
          >
            {totalCount > 0
              ? page > totalPages
                ? `${totalCount} pet shop · sayfa boş`
                : `${totalCount} pet shop · sayfa ${page} / ${totalPages}`
              : 'Sonuç yok'}
          </h2>
          {(filters.q || sort !== 'name_asc') && (
            <span
              className="text-[13px] text-ink-3"
              data-testid="vitrin-filter-summary"
            >
              {filters.q && (
                <span>
                  Arama: <strong>{filters.q}</strong>
                </span>
              )}
              {sort !== 'name_asc' && (
                <span>
                  {filters.q && ' · '}Sıra:{' '}
                  <strong>{SORT_LABEL[sort]}</strong>
                </span>
              )}
            </span>
          )}
        </div>

        {storefronts.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-line bg-paper py-16 text-center">
            <div className="text-6xl">🔎</div>
            <h2 className="mt-4 text-xl font-bold text-cart">
              {page > totalPages && totalCount > 0
                ? 'Bu sayfa boş'
                : `${district.name} için pet shop yok`}
            </h2>
            <p className="mt-2 text-sm text-ink-3">
              {page > totalPages && totalCount > 0
                ? `Toplam ${totalPages} sayfa var, ilk sayfaya dön.`
                : `${city.name} altındaki diğer ilçelere veya tüm Türkiye'ye bak.`}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              {page > totalPages && totalCount > 0 ? (
                <Link
                  href={buildPageUrl(1) as never}
                  className="rounded-xl bg-cat px-4 py-2 text-sm font-bold text-white"
                >
                  İlk sayfaya dön
                </Link>
              ) : (
                <>
                  <Link
                    href={`/vitrin/${city.slug}` as never}
                    className="rounded-xl bg-cat px-4 py-2 text-sm font-bold text-white"
                  >
                    {`${city.name} pet shop'lar`}
                  </Link>
                  <Link
                    href={'/vitrin' as never}
                    className="rounded-xl border border-line bg-paper px-4 py-2 text-sm font-bold text-cart"
                  >
                    Tüm dizin
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {storefronts.map((s) => {
              const wa = buildWhatsappLink(
                s.whatsappPhone,
                `Merhaba ${s.name}, vitrin'den geliyorum.`,
              );
              return (
                <li
                  key={s.companyId}
                  data-storefront-id={s.companyId}
                  data-slug={s.slug}
                  className="flex flex-col rounded-2xl border border-line bg-paper p-4 hover:border-cat hover:shadow-md transition-all"
                >
                  <Link
                    href={`/vitrin/magaza/${s.slug}` as never}
                    className="flex-1 min-w-0"
                  >
                    <h3 className="truncate text-base font-bold text-cart">
                      {s.name}
                    </h3>
                    <p className="mt-0.5 text-[13px] text-ink-3">
                      📍{' '}
                      {[s.districtName, s.cityName].filter(Boolean).join(', ') ||
                        'Konum belirtilmemiş'}
                    </p>
                    {s.aboutShort && (
                      <p className="mt-2 line-clamp-3 text-[13.5px] text-ink-2">
                        {s.aboutShort}
                      </p>
                    )}
                    <p className="mt-3 flex gap-3 text-[12.5px] text-ink-3">
                      <span>
                        🐾{' '}
                        <strong className="text-cat">{s.productCount}</strong>{' '}
                        ürün
                      </span>
                      <span>
                        🏪{' '}
                        <strong className="text-cat">{s.branchCount}</strong>{' '}
                        şube
                      </span>
                    </p>
                  </Link>
                  {wa && (
                    <WhatsappButton
                      href={wa}
                      data-testid={`wa-${s.slug}`}
                      width="block"
                      size="sm"
                      className="mt-3"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {totalPages > 1 && storefronts.length > 0 && (
          <nav
            className="mt-6 flex items-center justify-center gap-2"
            data-testid="vitrin-pagination"
            aria-label="Sayfalama"
          >
            {!isFirstPage ? (
              <Link
                href={buildPageUrl(page - 1) as never}
                className="rounded-xl border border-line bg-paper px-4 py-2 text-sm font-bold text-cart hover:bg-cat-soft"
                data-testid="vitrin-prev"
              >
                ← Önceki
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="rounded-xl border border-line bg-line-soft px-4 py-2 text-sm font-bold text-ink-4 cursor-not-allowed"
              >
                ← Önceki
              </span>
            )}

            <span
              className="rounded-xl bg-cat-soft px-4 py-2 text-sm font-bold text-cart"
              data-testid="vitrin-page-indicator"
            >
              {page} / {totalPages}
            </span>

            {!isLastPage ? (
              <Link
                href={buildPageUrl(page + 1) as never}
                className="rounded-xl border border-line bg-paper px-4 py-2 text-sm font-bold text-cart hover:bg-cat-soft"
                data-testid="vitrin-next"
              >
                Sonraki →
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="rounded-xl border border-line bg-line-soft px-4 py-2 text-sm font-bold text-ink-4 cursor-not-allowed"
              >
                Sonraki →
              </span>
            )}
          </nav>
        )}
      </section>

      {/* SEO ilişkili linkler */}
      <section
        data-testid="vitrin-related"
        className="rounded-2xl border border-line bg-line-soft/50 p-5"
      >
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">
          🔗 İlgili sayfalar
        </h2>
        <ul className="flex flex-wrap gap-2 text-xs">
          <li>
            <Link
              href={`/vitrin/${city.slug}` as never}
              className="text-cat hover:underline font-bold"
            >
              {`${city.name} tüm ilçeleri`}
            </Link>
          </li>
          <li>
            <Link
              href={'/vitrin' as never}
              className="text-cat hover:underline font-bold"
            >
              Tüm Türkiye pet shop dizini
            </Link>
          </li>
        </ul>
      </section>
    </main>
  );
}

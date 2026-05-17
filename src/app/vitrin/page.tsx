import Link from 'next/link';
import { headers } from 'next/headers';
import { db } from '@/lib/db/client';
import {
  buildWhatsappLink,
  countPublicStorefronts,
  listCitiesWithStorefronts,
  listPublicStorefronts,
  parseSortParam,
  STOREFRONT_SORTS,
  type ListStorefrontsFilters,
  type StorefrontSort,
} from '@/lib/vitrin/public';
import { cities as citiesTable } from '@/db/schema';
import { trackVitrinEventAsync } from '@/lib/vitrin/track';
import { listCategoriesWithStorefrontProducts } from '@/lib/vitrin/category-listings';
import { parseLocationQuery } from '@/lib/vitrin/geolocation';
import { NearbyToggle } from './nearby-toggle';
import { asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Pet Shop Vitrin — PetStockPro',
  description:
    "Türkiye'deki pet shop'lar tek dizinde. Yakındaki pet shop'u bul, WhatsApp ile direkt iletişim kur.",
};

interface SearchParams {
  city?: string;
  q?: string;
  page?: string;
  sort?: string;
  lat?: string;
  lng?: string;
  r?: string;
}

const PAGE_SIZE = 24;
const SORT_LABEL: Record<StorefrontSort, string> = {
  name_asc: 'A — Z',
  recent: 'En son aktif',
  products_desc: 'Ürün sayısı (çoktan aza)',
};

export default async function VitrinHomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filters: ListStorefrontsFilters = {};
  if (params.city) {
    const parsed = Number.parseInt(params.city, 10);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 81) {
      filters.cityId = parsed;
    }
  }
  if (params.q && params.q.trim().length > 0) {
    filters.q = params.q.trim().slice(0, 100);
  }
  const sort = parseSortParam(params.sort);
  filters.sort = sort;
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  filters.limit = PAGE_SIZE;
  filters.offset = (page - 1) * PAGE_SIZE;

  // Yakınlık filtresi (params.lat + lng + r) varsa aktive ol — TR sınır
  // valide. Geçersizse sessizce atla, normal listele.
  const location = parseLocationQuery(params.lat, params.lng, params.r);
  if (location) {
    filters.location = location;
  }

  const [storefronts, cityList, totalCount, activeCities, activeCategories] =
    await Promise.all([
      listPublicStorefronts(db, filters),
      db
        .select({ id: citiesTable.id, name: citiesTable.name })
        .from(citiesTable)
        .orderBy(asc(citiesTable.name)),
      countPublicStorefronts(db, {
        cityId: filters.cityId,
        districtId: filters.districtId,
        q: filters.q,
        location: filters.location,
      }),
      listCitiesWithStorefronts(db),
      listCategoriesWithStorefrontProducts(db),
    ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const isLastPage = page >= totalPages;
  const isFirstPage = page <= 1;

  // URL query helper — filtre + sort + location'ı koruyarak page değiştir
  function buildPageUrl(p: number): string {
    const qs = new URLSearchParams();
    if (filters.cityId) qs.set('city', String(filters.cityId));
    if (filters.q) qs.set('q', filters.q);
    if (sort !== 'name_asc' && !location) qs.set('sort', sort);
    if (location) {
      qs.set('lat', String(location.lat));
      qs.set('lng', String(location.lng));
      qs.set('r', String(location.radiusKm));
    }
    if (p > 1) qs.set('page', String(p));
    const str = qs.toString();
    return str ? `/vitrin?${str}` : '/vitrin';
  }

  // KVKK uyumlu anonim home_view tracking (IP hash daily-salted)
  const hdrs = await headers();
  const xff = hdrs.get('x-forwarded-for') ?? hdrs.get('x-real-ip');
  const ip = xff ? xff.split(',')[0].trim() : undefined;
  const ua = hdrs.get('user-agent') ?? undefined;
  // Aggregate event (companyId=null değil; bizim ilk şirket gerekli olabilir → şu an
  // tenant-specific home_view yok, home_view skipped MVP'de). Search event'i geç:
  if (filters.q) {
    // Search event'lerini her tenant'a ayrı atmak yerine event sayısını azalt:
    // ilk 5 sonuç tenant'ına search event yaz
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

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
      <section className="rounded-3xl bg-gradient-to-br from-cat-soft/40 via-arrow-soft/30 to-paper p-6 lg:p-10">
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-cart">
          🐾 Türkiye&apos;de pet shop bul
        </h1>
        <p className="mt-2 max-w-xl text-sm text-ink-2">
          Yakındaki pet shop&apos;a WhatsApp&apos;tan ulaş, ürün sor, mağaza
          gezisi planla. <strong>PetStockPro&apos;nun online satışı yok</strong>{' '}
          — biz sadece dizin sağlıyoruz, alışveriş pet shop ile arandadır.
        </p>

        <form
          method="get"
          action="/vitrin"
          className="mt-5 flex flex-wrap items-end gap-3"
          data-testid="vitrin-filter"
        >
          <div className="flex-1 min-w-[200px]">
            <label
              htmlFor="city"
              className="mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-ink-3"
            >
              Şehir
            </label>
            <select
              id="city"
              name="city"
              defaultValue={filters.cityId ?? ''}
              data-testid="vitrin-city"
              className="w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-2.5 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
            >
              <option value="">Tüm Türkiye</option>
              {cityList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[220px]">
            <label
              htmlFor="q"
              className="mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-ink-3"
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
              className="mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-ink-3"
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
          {(filters.cityId || filters.q || sort !== 'name_asc') && (
            <Link
              href={'/vitrin' as never}
              className="rounded-xl border border-line bg-paper px-3 py-2.5 text-xs font-bold text-ink-3 hover:bg-line-soft"
              data-testid="vitrin-clear"
            >
              × Temizle
            </Link>
          )}
        </form>
      </section>

      <NearbyToggle
        active={!!location}
        currentRadiusKm={location?.radiusKm ?? 25}
        currentLabel={
          location
            ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
            : undefined
        }
      />

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
          {(filters.cityId || filters.q || sort !== 'name_asc') && (
            <span className="text-[11.5px] text-ink-3" data-testid="vitrin-filter-summary">
              {filters.q && <span>Arama: <strong>{filters.q}</strong></span>}
              {filters.cityId && filters.q && <span> · </span>}
              {filters.cityId && (
                <span>
                  Şehir:{' '}
                  <strong>
                    {cityList.find((c) => c.id === filters.cityId)?.name ?? '—'}
                  </strong>
                </span>
              )}
              {sort !== 'name_asc' && (
                <span>
                  {(filters.cityId || filters.q) && ' · '}Sıra:{' '}
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
                : 'Bu filtre için pet shop bulamadık'}
            </h2>
            <p className="mt-2 text-sm text-ink-3">
              {page > totalPages && totalCount > 0
                ? `Toplam ${totalPages} sayfa var, ilk sayfaya dön.`
                : "Filtreyi temizleyerek tüm pet shop'ları gör veya farklı bir arama dene."}
            </p>
            <Link
              href={
                (page > totalPages && totalCount > 0
                  ? buildPageUrl(1)
                  : '/vitrin') as never
              }
              className="mt-4 inline-block rounded-xl bg-cat px-4 py-2 text-sm font-bold text-white"
            >
              {page > totalPages && totalCount > 0
                ? 'İlk sayfaya dön'
                : 'Tümünü gör'}
            </Link>
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
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="truncate text-base font-bold text-cart">
                        {s.name}
                      </h3>
                      {s.distanceKm !== null && (
                        <span
                          data-distance-km={s.distanceKm}
                          className="shrink-0 rounded-full bg-cat-soft px-2 py-0.5 text-[10px] font-bold text-cart"
                        >
                          {s.distanceKm < 1
                            ? `${Math.round(s.distanceKm * 1000)} m`
                            : `${s.distanceKm.toFixed(1)} km`}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-ink-3">
                      📍{' '}
                      {[s.districtName, s.cityName].filter(Boolean).join(', ') ||
                        'Konum belirtilmemiş'}
                    </p>
                    {s.aboutShort && (
                      <p className="mt-2 line-clamp-3 text-[12px] text-ink-2">
                        {s.aboutShort}
                      </p>
                    )}
                    <p className="mt-3 flex gap-3 text-[11px] text-ink-3">
                      <span>
                        🐾 <strong className="text-cat">{s.productCount}</strong>{' '}
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
                    <a
                      href={wa}
                      target="_blank"
                      rel="noreferrer noopener"
                      data-testid={`wa-${s.slug}`}
                      className="mt-3 rounded-xl bg-arrow px-3 py-2 text-center text-xs font-bold text-white hover:bg-arrow-7 transition-colors"
                    >
                      💬 WhatsApp ile yaz
                    </a>
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
                aria-label="Önceki sayfa"
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
                aria-label="Sonraki sayfa"
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

      {activeCategories.length > 0 && (
        <section
          data-testid="vitrin-active-categories"
          className="rounded-2xl border border-line bg-line-soft/50 p-5"
        >
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
            🛍 Kategoriler ({activeCategories.length})
          </h2>
          <ul className="flex flex-wrap gap-2">
            {activeCategories.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/vitrin/kategori/${c.slug}` as never}
                  data-category-slug={c.slug}
                  data-product-count={c.productCount}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-[11.5px] font-bold text-cart hover:border-cat hover:bg-cat-soft transition-colors"
                >
                  <span aria-hidden>{c.emoji}</span>
                  <span>{c.name}</span>
                  <span className="rounded-full bg-cat-soft px-1.5 py-0.5 text-[9.5px] text-cart">
                    {c.productCount}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {activeCities.length > 0 && (
        <section
          data-testid="vitrin-active-cities"
          className="rounded-2xl border border-line bg-line-soft/50 p-5"
        >
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
            🗺 Pet shop&apos;u olan şehirler ({activeCities.length})
          </h2>
          <ul className="flex flex-wrap gap-2">
            {activeCities.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/vitrin/${c.slug}` as never}
                  data-city-slug={c.slug}
                  className="inline-flex items-center rounded-full border border-line bg-paper px-3 py-1.5 text-[11.5px] font-bold text-cart hover:border-cat hover:bg-cat-soft transition-colors"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

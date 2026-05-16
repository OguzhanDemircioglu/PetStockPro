import Link from 'next/link';
import { headers } from 'next/headers';
import { db } from '@/lib/db/client';
import {
  buildWhatsappLink,
  listPublicStorefronts,
  type ListStorefrontsFilters,
} from '@/lib/vitrin/public';
import { cities as citiesTable } from '@/db/schema';
import { trackVitrinEventAsync } from '@/lib/vitrin/track';
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
}

const PAGE_SIZE = 24;

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
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  filters.limit = PAGE_SIZE;
  filters.offset = (page - 1) * PAGE_SIZE;

  const [storefronts, cityList] = await Promise.all([
    listPublicStorefronts(db, filters),
    db
      .select({ id: citiesTable.id, name: citiesTable.name })
      .from(citiesTable)
      .orderBy(asc(citiesTable.name)),
  ]);

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
              className="w-full rounded-xl border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
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
              className="w-full rounded-xl border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-cat px-5 py-2.5 text-sm font-bold text-white shadow-sm"
          >
            🔍 Filtrele
          </button>
          {(filters.cityId || filters.q) && (
            <Link
              href={'/vitrin' as never}
              className="rounded-xl border border-line bg-white px-3 py-2.5 text-xs font-bold text-ink-3 hover:bg-line-soft"
              data-testid="vitrin-clear"
            >
              × Temizle
            </Link>
          )}
        </form>
      </section>

      <section data-testid="vitrin-results">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-ink-3">
            {storefronts.length > 0
              ? `${storefronts.length} pet shop`
              : 'Sonuç yok'}
          </h2>
          {(filters.cityId || filters.q) && (
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
            </span>
          )}
        </div>

        {storefronts.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-line bg-white py-16 text-center">
            <div className="text-6xl">🔎</div>
            <h2 className="mt-4 text-xl font-bold text-cart">
              Bu filtre için pet shop bulamadık
            </h2>
            <p className="mt-2 text-sm text-ink-3">
              Filtreyi temizleyerek tüm pet shop&apos;ları gör veya farklı bir
              arama dene.
            </p>
            <Link
              href={'/vitrin' as never}
              className="mt-4 inline-block rounded-xl bg-cat px-4 py-2 text-sm font-bold text-white"
            >
              Tümünü gör
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
                  className="flex flex-col rounded-2xl border border-line bg-white p-4 hover:border-cat hover:shadow-md transition-all"
                >
                  <Link
                    href={`/vitrin/magaza/${s.slug}` as never}
                    className="flex-1 min-w-0"
                  >
                    <h3 className="truncate text-base font-bold text-cart">
                      {s.name}
                    </h3>
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

        {storefronts.length === PAGE_SIZE && (
          <div className="mt-6 flex justify-center">
            <Link
              href={
                `/vitrin?${new URLSearchParams({
                  ...(filters.cityId ? { city: String(filters.cityId) } : {}),
                  ...(filters.q ? { q: filters.q } : {}),
                  page: String(page + 1),
                }).toString()}` as never
              }
              className="rounded-xl border border-line bg-white px-5 py-2 text-sm font-bold text-cart hover:bg-cat-soft"
            >
              Sonraki sayfa →
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}

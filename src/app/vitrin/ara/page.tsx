import Link from 'next/link';
import Image from 'next/image';
import { db } from '@/lib/db/client';
import {
  searchPublicProducts,
  countSearchResults,
  parseSearchQuery,
} from '@/lib/vitrin/search';
import { buildVitrinPageMetadata } from '@/lib/vitrin/page-metadata';
import { buildBreadcrumbLd } from '@/lib/vitrin/schema-org';
import { getPublicBaseUrl } from '@/lib/vitrin/sitemap-data';
import { getCityBySlug, listCitiesWithStorefronts } from '@/lib/vitrin/public';
import {
  getCategoryInfoBySlug,
  listCategoriesWithStorefrontProducts,
} from '@/lib/vitrin/category-listings';

export const dynamic = 'force-dynamic';

interface SearchParams {
  q?: string;
  page?: string;
  il?: string;
  kategori?: string;
}

const PAGE_SIZE = 24;
const TR_NUMBER = new Intl.NumberFormat('tr-TR');

function formatPrice(value: string | null): string | null {
  if (!value) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return `${TR_NUMBER.format(num)} ₺`;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const q = (params.q ?? '').trim();
  const ilSlug = (params.il ?? '').trim();
  const cityLabel = ilSlug ? ` · ${ilSlug.charAt(0).toUpperCase()}${ilSlug.slice(1)}` : '';
  const ilQs = ilSlug ? `&il=${encodeURIComponent(ilSlug)}` : '';
  return buildVitrinPageMetadata({
    title: q
      ? `"${q}"${cityLabel} için arama sonuçları — PetStockPro Vitrin`
      : `Vitrin arama${cityLabel} — PetStockPro`,
    description: q
      ? `${q} ile ilgili pet shop ürünleri${cityLabel}. Yakınındaki pet shop'tan WhatsApp ile sor.`
      : 'Pet shop ürünleri ve markalar arasında ara. Yakınındaki pet shop\'tan al.',
    path: q ? `/vitrin/ara?q=${encodeURIComponent(q)}${ilQs}` : '/vitrin/ara',
  });
}

export default async function VitrinSearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const rawQuery = (params.q ?? '').trim();
  const parsed = parseSearchQuery(rawQuery);
  const pageRaw = parseInt(params.page ?? '1', 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const offset = (page - 1) * PAGE_SIZE;

  // İl filtresi — slug verildiyse city lookup; bilinmeyen slug atlanır (filter no-op)
  const ilSlug = (params.il ?? '').trim().toLowerCase();
  const cityFilter = ilSlug ? await getCityBySlug(ilSlug, db) : null;
  const cityId = cityFilter?.id;

  // Kategori filtresi — slug verildiyse info lookup; bilinmeyen slug "Diğer" döner
  // ama filter no-op olsun istiyoruz — slug DEFAULT_CATEGORIES'te yoksa atla
  const categorySlugRaw = (params.kategori ?? '').trim().toLowerCase();
  const categoryInfo = categorySlugRaw ? getCategoryInfoBySlug(categorySlugRaw) : null;
  const categorySlug = categoryInfo?.isDefault ? categoryInfo.slug : undefined;
  const activeCategories = await listCategoriesWithStorefrontProducts(db);

  // City select için pet shop'u olan tüm şehirler
  const activeCities = await listCitiesWithStorefronts(db);

  const [results, totalCount] = parsed.valid
    ? await Promise.all([
        searchPublicProducts(parsed.raw, db, { limit: PAGE_SIZE, offset, cityId, categorySlug }),
        countSearchResults(parsed.raw, db, { cityId, categorySlug }),
      ])
    : [[], 0];

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const baseUrl = getPublicBaseUrl();
  const breadcrumb = buildBreadcrumbLd(
    [
      { name: 'Vitrin', url: '/vitrin' },
      { name: 'Arama', url: '/vitrin/ara' },
      ...(parsed.raw
        ? [{ name: `"${parsed.raw}"`, url: `/vitrin/ara?q=${encodeURIComponent(parsed.raw)}` }]
        : []),
    ],
    baseUrl,
  );

  const buildPageUrl = (newPage: number) => {
    const sp = new URLSearchParams();
    if (parsed.raw) sp.set('q', parsed.raw);
    if (cityFilter) sp.set('il', cityFilter.slug);
    if (categorySlug) sp.set('kategori', categorySlug);
    if (newPage > 1) sp.set('page', String(newPage));
    const qs = sp.toString();
    return `/vitrin/ara${qs ? `?${qs}` : ''}`;
  };

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[12.5px] text-ink-3" aria-label="Breadcrumb">
        <Link href={'/vitrin' as never} className="hover:text-cart">
          Vitrin
        </Link>
        <span aria-hidden>›</span>
        <span className="font-bold text-ink-2">Arama</span>
      </nav>

      {/* Header + form */}
      <header className="rounded-2xl bg-gradient-to-br from-cat to-cart px-7 py-8 text-white shadow-[var(--shadow-cat)]">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {parsed.valid ? (
            <>
              &quot;{parsed.raw}&quot;
              {cityFilter && (
                <span className="opacity-90"> · {cityFilter.name}</span>
              )}{' '}
              için{' '}
              <span className="opacity-80">{TR_NUMBER.format(totalCount)} sonuç</span>
            </>
          ) : (
            <>
              Pet shop ürünlerinde ara
              {cityFilter && <span className="opacity-90"> · {cityFilter.name}</span>}
            </>
          )}
        </h1>
        <p className="mt-1.5 text-[14px] opacity-85">
          Ürün adı veya marka yazın —{' '}
          {cityFilter
            ? `${cityFilter.name} şehrindeki pet shop'tan WhatsApp ile sorabilirsin.`
            : 'pet shop\'tan WhatsApp ile sorabilirsin.'}
        </p>

        <form
          method="get"
          action="/vitrin/ara"
          className="mt-5 flex flex-wrap items-stretch gap-2 rounded-2xl bg-paper p-2 shadow-md"
          data-testid="vitrin-search-form"
        >
          <input
            type="search"
            name="q"
            defaultValue={parsed.raw}
            maxLength={100}
            required
            placeholder="Royal Canin, mama, oyuncak, akvaryum..."
            data-testid="vitrin-search-input"
            className="min-w-[180px] flex-1 rounded-xl bg-transparent px-3 py-2.5 text-[15px] text-ink placeholder:text-ink-4 focus:outline-none"
          />
          <select
            name="il"
            defaultValue={cityFilter?.slug ?? ''}
            data-testid="vitrin-search-city"
            aria-label="Şehir filtresi"
            className="min-w-[140px] rounded-xl border-l border-line bg-paper px-3 py-2.5 text-[14px] text-ink focus:outline-none"
          >
            <option value="">Tüm şehirler</option>
            {activeCities.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            name="kategori"
            defaultValue={categorySlug ?? ''}
            data-testid="vitrin-search-category"
            aria-label="Kategori filtresi"
            className="min-w-[150px] rounded-xl border-l border-line bg-paper px-3 py-2.5 text-[14px] text-ink focus:outline-none"
          >
            <option value="">Tüm kategoriler</option>
            {activeCategories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-5 py-2.5 text-[14px] font-bold text-white shadow-sm hover:-translate-y-px transition-transform"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            Ara
          </button>
        </form>

        {/* Aktif filter chip'leri + temizleme */}
        {(cityFilter || categorySlug) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
            {cityFilter && (
              <>
                <span className="rounded-full bg-paper/20 px-3 py-1 font-bold text-white backdrop-blur-sm">
                  📍 {cityFilter.name}
                </span>
                <Link
                  href={
                    (() => {
                      const sp = new URLSearchParams();
                      if (parsed.raw) sp.set('q', parsed.raw);
                      if (categorySlug) sp.set('kategori', categorySlug);
                      const qs = sp.toString();
                      return `/vitrin/ara${qs ? `?${qs}` : ''}` as never;
                    })()
                  }
                  className="rounded-full bg-paper/10 px-3 py-1 font-bold text-white opacity-80 hover:bg-paper/20 hover:opacity-100"
                  data-testid="vitrin-search-clear-city"
                >
                  × Şehri kaldır
                </Link>
              </>
            )}
            {categoryInfo && categorySlug && (
              <>
                <span className="rounded-full bg-paper/20 px-3 py-1 font-bold text-white backdrop-blur-sm">
                  {categoryInfo.emoji} {categoryInfo.name}
                </span>
                <Link
                  href={
                    (() => {
                      const sp = new URLSearchParams();
                      if (parsed.raw) sp.set('q', parsed.raw);
                      if (cityFilter) sp.set('il', cityFilter.slug);
                      const qs = sp.toString();
                      return `/vitrin/ara${qs ? `?${qs}` : ''}` as never;
                    })()
                  }
                  className="rounded-full bg-paper/10 px-3 py-1 font-bold text-white opacity-80 hover:bg-paper/20 hover:opacity-100"
                  data-testid="vitrin-search-clear-category"
                >
                  × Kategoriyi kaldır
                </Link>
              </>
            )}
          </div>
        )}
      </header>

      {/* Empty state — query yok veya kısa */}
      {!parsed.valid && (
        <div
          className="rounded-2xl border border-line bg-paper p-8 text-center"
          data-testid="empty-no-query"
        >
          <div className="text-3xl">🔎</div>
          <p className="mt-3 text-[15px] font-bold text-cart">
            Aramak için en az 2 karakter yaz.
          </p>
          <p className="mt-1.5 text-[13px] text-ink-3">
            Marka ismi, ürün adı veya kategori (örn. <em>Royal Canin</em>, <em>mama</em>, <em>akvaryum</em>) deneyebilirsin.
          </p>
        </div>
      )}

      {/* Empty state — query var ama sonuç yok */}
      {parsed.valid && totalCount === 0 && (
        <div
          className="rounded-2xl border border-line bg-paper p-8 text-center"
          data-testid="empty-no-result"
        >
          <Image
            src="/logo.webp"
            alt="PetStockPro"
            width={56}
            height={56}
            className="mx-auto h-14 w-14 object-contain"
          />
          <p className="mt-3 text-[15px] font-bold text-cart">
            &quot;{parsed.raw}&quot; ile eşleşen ürün yok.
          </p>
          <p className="mt-1.5 text-[13px] text-ink-3">
            Farklı bir arama dene veya{' '}
            <Link href={'/vitrin' as never} className="font-bold text-cat underline">
              tüm pet shop&apos;lara bak →
            </Link>
          </p>
        </div>
      )}

      {/* Results grid */}
      {parsed.valid && results.length > 0 && (
        <>
          <div
            className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"
            data-testid="search-results-grid"
          >
            {results.map((r) => {
              const price = formatPrice(r.defaultSalePrice);
              const location = [r.cityName, r.districtName].filter(Boolean).join(' / ');
              return (
                <Link
                  key={r.productId}
                  href={`/vitrin/magaza/${r.companySlug}/urun/${r.productSlug}` as never}
                  className="group flex flex-col gap-2 rounded-2xl border border-line bg-paper p-4 transition-all hover:-translate-y-0.5 hover:border-cat/30 hover:shadow-md"
                  data-testid="search-result-card"
                >
                  <div className="flex items-center gap-2 text-[11.5px] text-ink-3">
                    {r.brandName && (
                      <span className="rounded bg-cat-soft px-1.5 py-0.5 font-bold text-cart">
                        {r.brandName}
                      </span>
                    )}
                    {r.categoryName && <span>{r.categoryName}</span>}
                  </div>
                  <h3 className="text-[15px] font-bold leading-snug text-ink group-hover:text-cart">
                    {r.productName}
                  </h3>
                  <div className="flex items-end justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-[11.5px] text-ink-4">{r.companyName}</span>
                      {location && <span className="text-[11px] text-ink-4">📍 {location}</span>}
                    </div>
                    {price && (
                      <span className="text-[14px] font-bold text-cart">{price}</span>
                    )}
                  </div>
                  {r.defaultVariantLabel && r.defaultVariantLabel !== 'Standart' && (
                    <span className="text-[11px] text-ink-4">📦 {r.defaultVariantLabel}</span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-3" data-testid="search-pagination">
              {page > 1 && (
                <Link
                  href={buildPageUrl(page - 1) as never}
                  className="rounded-xl border border-line bg-paper px-3 py-2 text-[13px] font-bold text-ink-2 hover:bg-line-soft"
                >
                  ← Önceki
                </Link>
              )}
              <span className="text-[13px] text-ink-3">
                Sayfa <strong className="text-cart">{page}</strong> / {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={buildPageUrl(page + 1) as never}
                  className="rounded-xl border border-line bg-paper px-3 py-2 text-[13px] font-bold text-ink-2 hover:bg-line-soft"
                >
                  Sonraki →
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </main>
  );
}

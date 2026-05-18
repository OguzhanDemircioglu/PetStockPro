import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db/client';
import {
  getBrandByNameSlug,
  listProductsByBrandSlug,
  countProductsByBrandSlug,
} from '@/lib/vitrin/brand-listings';
import { getCityBySlug, listCitiesWithStorefronts } from '@/lib/vitrin/public';
import { buildVitrinPageMetadata } from '@/lib/vitrin/page-metadata';
import { buildBreadcrumbLd } from '@/lib/vitrin/schema-org';
import { getPublicBaseUrl } from '@/lib/vitrin/sitemap-data';

export const dynamic = 'force-dynamic';

interface PageParams {
  brand: string;
}

interface SearchParams {
  page?: string;
  il?: string;
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
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ brand: brandSlug }, qp] = await Promise.all([params, searchParams]);
  const brand = await getBrandByNameSlug(brandSlug, db);
  if (!brand) {
    return buildVitrinPageMetadata({
      title: 'Sayfa bulunamadı — PetStockPro',
      description: 'Aradığın marka vitrin dizininde yok.',
      path: `/vitrin/marka/${brandSlug}`,
      index: false,
    });
  }
  const cityFilter = qp.il ? await getCityBySlug(qp.il, db) : null;
  const citySuffix = cityFilter ? ` · ${cityFilter.name}` : '';
  return buildVitrinPageMetadata({
    title: `${brand.name}${citySuffix} ürünleri — PetStockPro Vitrin`,
    description: `${brand.name} markası${citySuffix} pet shop'larda satışta. WhatsApp ile satıcıya direkt sor.`,
    path: cityFilter
      ? `/vitrin/marka/${brandSlug}?il=${cityFilter.slug}`
      : `/vitrin/marka/${brandSlug}`,
  });
}

export default async function VitrinBrandPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ brand: brandSlug }, qp] = await Promise.all([params, searchParams]);
  const brand = await getBrandByNameSlug(brandSlug, db);
  if (!brand) {
    notFound();
  }

  const ilSlug = (qp.il ?? '').trim().toLowerCase();
  const cityFilter = ilSlug ? await getCityBySlug(ilSlug, db) : null;
  const cityId = cityFilter?.id;

  const pageRaw = parseInt(qp.page ?? '1', 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const offset = (page - 1) * PAGE_SIZE;

  const [results, totalCount, activeCities] = await Promise.all([
    listProductsByBrandSlug(brandSlug, db, { limit: PAGE_SIZE, offset, cityId }),
    countProductsByBrandSlug(brandSlug, db, { cityId }),
    listCitiesWithStorefronts(db),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const baseUrl = getPublicBaseUrl();
  const breadcrumb = buildBreadcrumbLd(
    [
      { name: 'Vitrin', url: '/vitrin' },
      { name: 'Markalar', url: '/vitrin' },
      { name: brand!.name, url: `/vitrin/marka/${brandSlug}` },
    ],
    baseUrl,
  );

  const buildPageUrl = (newPage: number) => {
    const sp = new URLSearchParams();
    if (cityFilter) sp.set('il', cityFilter.slug);
    if (newPage > 1) sp.set('page', String(newPage));
    const qs = sp.toString();
    return `/vitrin/marka/${brandSlug}${qs ? `?${qs}` : ''}`;
  };

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[12.5px] text-ink-3" aria-label="Breadcrumb">
        <Link href={'/vitrin' as never} className="hover:text-cart">
          Vitrin
        </Link>
        <span aria-hidden>›</span>
        <span className="font-bold text-ink-2">{brand!.name}</span>
      </nav>

      {/* Header */}
      <header className="rounded-2xl bg-gradient-to-br from-bars to-cart px-7 py-8 text-white shadow-[var(--shadow-cat)]">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            🏷 {brand!.name}
          </h1>
          <span className="text-[14px] opacity-90">
            {TR_NUMBER.format(brand!.productCount)} ürün cross-tenant
          </span>
        </div>
        <p className="mt-1.5 text-[14px] opacity-85">
          {`${brand!.name} markası ürünleri ve onları satan pet shop'lar tek dizinde.`}
        </p>

        <form
          method="get"
          action={`/vitrin/marka/${brandSlug}`}
          className="mt-5 flex flex-wrap items-stretch gap-2 rounded-2xl bg-paper p-2 shadow-md"
          data-testid="vitrin-brand-filter-form"
        >
          <select
            name="il"
            defaultValue={cityFilter?.slug ?? ''}
            data-testid="vitrin-brand-city"
            aria-label="Şehir filtresi"
            className="min-w-[180px] flex-1 rounded-xl bg-transparent px-3 py-2.5 text-[15px] text-ink focus:outline-none"
          >
            <option value="">Tüm şehirler</option>
            {activeCities.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-5 py-2.5 text-[14px] font-bold text-white shadow-sm hover:-translate-y-px transition-transform"
          >
            🔍 Filtrele
          </button>
        </form>

        {cityFilter && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
            <span className="rounded-full bg-paper/20 px-3 py-1 font-bold text-white backdrop-blur-sm">
              📍 {cityFilter.name}
            </span>
            <Link
              href={`/vitrin/marka/${brandSlug}` as never}
              className="rounded-full bg-paper/10 px-3 py-1 font-bold text-white opacity-80 hover:bg-paper/20 hover:opacity-100"
              data-testid="vitrin-brand-clear-city"
            >
              × Şehir filtresini kaldır
            </Link>
          </div>
        )}
      </header>

      {/* Empty state */}
      {totalCount === 0 && (
        <div
          className="rounded-2xl border border-line bg-paper p-8 text-center"
          data-testid="empty-no-result"
        >
          <div className="text-3xl">🐾</div>
          <p className="mt-3 text-[15px] font-bold text-cart">
            {cityFilter
              ? `${brand!.name} · ${cityFilter.name} için ürün yok.`
              : `${brand!.name} için ürün yok.`}
          </p>
          <p className="mt-1.5 text-[13px] text-ink-3">
            {cityFilter ? (
              <Link href={`/vitrin/marka/${brandSlug}` as never} className="font-bold text-cat underline">
                Tüm şehirlere bak →
              </Link>
            ) : (
              <Link href={'/vitrin' as never} className="font-bold text-cat underline">
                Diğer markalara göz at →
              </Link>
            )}
          </p>
        </div>
      )}

      {/* Results grid */}
      {totalCount > 0 && (
        <>
          <div
            className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"
            data-testid="brand-results-grid"
          >
            {results.map((r) => {
              const price = formatPrice(r.defaultSalePrice);
              const location = [r.cityName, r.districtName].filter(Boolean).join(' / ');
              return (
                <Link
                  key={r.productId}
                  href={`/vitrin/magaza/${r.companySlug}/urun/${r.productSlug}` as never}
                  className="group flex flex-col gap-2 rounded-2xl border border-line bg-paper p-4 transition-all hover:-translate-y-0.5 hover:border-cat/30 hover:shadow-md"
                  data-testid="brand-result-card"
                >
                  <div className="flex items-center gap-2 text-[11.5px] text-ink-3">
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
                    {price && <span className="text-[14px] font-bold text-cart">{price}</span>}
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
            <nav className="flex items-center justify-center gap-3" data-testid="brand-pagination">
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

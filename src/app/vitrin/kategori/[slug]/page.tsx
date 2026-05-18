import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db/client';
import {
  getCategoryInfoBySlug,
  listProductsByCategorySlug,
  countProductsByCategorySlug,
} from '@/lib/vitrin/category-listings';
import { getCityBySlug } from '@/lib/vitrin/public';
import { DEFAULT_CATEGORIES } from '@/lib/catalog/default-categories';
import { buildVitrinPageMetadata } from '@/lib/vitrin/page-metadata';
import { buildBreadcrumbLd } from '@/lib/vitrin/schema-org';
import { getPublicBaseUrl } from '@/lib/vitrin/sitemap-data';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  il?: string;
}

const PAGE_SIZE = 24;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const info = getCategoryInfoBySlug(slug);
  return buildVitrinPageMetadata({
    title: `${info.name} — Pet Shop'larda | PetStockPro Vitrin`,
    description: `${info.name} kategorisindeki ürünler — Türkiye geneli pet shop'lar tek dizinde. WhatsApp ile direkt fiyat sor.`,
    path: `/vitrin/kategori/${slug}`,
  });
}

const KNOWN_SLUGS = new Set(DEFAULT_CATEGORIES.map((c) => c.slug));

export default async function VitrinCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ slug }, qp] = await Promise.all([params, searchParams]);

  // Default slug listesinde değilse 404 (custom kategori URL'leri için
  // ileride esneklik: tablodan distinct slug lookup, ama MVP'de default'lar)
  if (!KNOWN_SLUGS.has(slug)) {
    notFound();
  }

  const info = getCategoryInfoBySlug(slug);

  // Şehir filtresi (?il=istanbul gibi) opsiyonel
  let cityFilter: { id: number; name: string; slug: string } | null = null;
  if (qp.il) {
    const city = await getCityBySlug(qp.il, db);
    if (city) cityFilter = city;
  }

  const page = Math.max(1, Number.parseInt(qp.page ?? '1', 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const cityId = cityFilter?.id;

  const [items, totalCount] = await Promise.all([
    listProductsByCategorySlug(slug, db, {
      limit: PAGE_SIZE,
      offset,
      cityId,
    }),
    countProductsByCategorySlug(slug, db, { cityId }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const isFirstPage = page <= 1;
  const isLastPage = page >= totalPages;

  const buildPageUrl = (n: number): string => {
    const params = new URLSearchParams();
    if (n > 1) params.set('page', String(n));
    if (cityFilter) params.set('il', cityFilter.slug);
    const q = params.toString();
    return `/vitrin/kategori/${slug}${q ? `?${q}` : ''}`;
  };

  // Schema.org breadcrumb JSON-LD — Google SERP'de breadcrumb yolu görünür hale getirir
  const breadcrumbLd = buildBreadcrumbLd(
    [
      { name: 'Vitrin', url: '/vitrin' },
      { name: info.name, url: `/vitrin/kategori/${slug}` },
      ...(cityFilter
        ? [{ name: cityFilter.name, url: `/vitrin/${cityFilter.slug}` }]
        : []),
    ],
    getPublicBaseUrl(),
  );

  return (
    <main
      className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8"
      data-testid="vitrin-category-page"
    >
      <script
        type="application/ld+json"
        // Breadcrumb JSON-LD — Google rich result için statik veri, XSS riski yok
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <nav
        aria-label="breadcrumb"
        className="flex flex-wrap gap-2 text-[13px] text-ink-3"
      >
        <Link href={'/vitrin' as never} className="hover:text-cart">
          Vitrin
        </Link>
        <span aria-hidden>›</span>
        <span className="text-cart font-bold" data-category-slug={slug}>
          {info.emoji} {info.name}
        </span>
        {cityFilter && (
          <>
            <span aria-hidden>·</span>
            <Link
              href={`/vitrin/${cityFilter.slug}` as never}
              className="hover:text-cart"
            >
              📍 {cityFilter.name}
            </Link>
          </>
        )}
      </nav>

      <section
        className="rounded-3xl bg-gradient-to-br from-cat-soft/30 to-arrow-soft/20 p-6 lg:p-8"
        data-testid="category-hero"
      >
        <p className="text-[13px] font-bold uppercase tracking-wider text-cat">
          Kategori sayfası
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-cart">
          {info.emoji} {info.name}
          {cityFilter && (
            <span className="ml-2 text-lg font-normal text-ink-2">
              · {cityFilter.name}
            </span>
          )}
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          {totalCount > 0
            ? `${totalCount} ürün · sayfa ${page} / ${totalPages}`
            : 'Bu kategoride şu an vitrin\'de ürün yok'}
        </p>
        {cityFilter && (
          <Link
            href={`/vitrin/kategori/${slug}` as never}
            className="mt-3 inline-block text-[13px] font-bold text-cat hover:underline"
            data-testid="clear-city-filter"
          >
            × Şehir filtresini kaldır (tüm Türkiye)
          </Link>
        )}
      </section>

      {items.length === 0 ? (
        <section
          className="rounded-2xl border border-line bg-paper p-8 text-center"
          data-testid="empty-category"
        >
          <p className="text-base text-ink-2">
            Bu kategoride şu an{' '}
            {cityFilter ? `${cityFilter.name}'da ` : ''}vitrin&apos;de ürün
            bulunmuyor.
          </p>
          <p className="mt-2 text-sm text-ink-3">
            {!isFirstPage && (
              <Link
                href={buildPageUrl(1) as never}
                className="text-cat hover:underline"
              >
                İlk sayfaya dön
              </Link>
            )}
            {isFirstPage && (
              <>
                Diğer kategorilere göz at:{' '}
                <Link
                  href={'/vitrin' as never}
                  className="font-bold text-cat hover:underline"
                >
                  Tüm pet shop&apos;lar →
                </Link>
              </>
            )}
          </p>
        </section>
      ) : (
        <section
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          data-testid="category-product-grid"
        >
          {items.map((p) => {
            const price = p.defaultSalePrice ? Number(p.defaultSalePrice) : null;
            return (
              <article
                key={p.productId}
                data-product-id={p.productId}
                className="flex flex-col gap-2 rounded-2xl border border-line bg-paper p-4 hover:border-cat/40 hover:shadow-md transition"
              >
                <Link
                  href={
                    `/vitrin/magaza/${p.companySlug}/urun/${p.productSlug}` as never
                  }
                  className="font-bold text-cart hover:underline"
                >
                  {p.productName}
                </Link>
                <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
                  {p.brandName && <span>🏷 {p.brandName}</span>}
                  {p.defaultVariantLabel && (
                    <>
                      {p.brandName && <span>·</span>}
                      <span>{p.defaultVariantLabel}</span>
                    </>
                  )}
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  {price !== null && price > 0 ? (
                    <span
                      className="font-mono text-base font-bold text-cart"
                      data-price={price}
                    >
                      {price.toLocaleString('tr-TR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      ₺
                    </span>
                  ) : (
                    <span className="text-[12.5px] text-ink-4">Fiyat için sor</span>
                  )}
                </div>
                <div className="mt-1 border-t border-line-soft pt-2 text-[12.5px] text-ink-3">
                  <Link
                    href={`/vitrin/magaza/${p.companySlug}` as never}
                    className="font-bold text-ink-2 hover:text-cart hover:underline"
                  >
                    {p.companyName}
                  </Link>
                  {(p.districtName || p.cityName) && (
                    <span className="block text-[11.5px] text-ink-4">
                      📍 {[p.districtName, p.cityName].filter(Boolean).join(', ')}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {totalPages > 1 && items.length > 0 && (
        <nav
          aria-label="Sayfa navigasyonu"
          className="flex items-center justify-between gap-2 text-sm"
          data-testid="category-pagination"
        >
          {isFirstPage ? (
            <span className="rounded-xl border border-line bg-line-soft px-3 py-1.5 text-[13.5px] font-bold text-ink-4">
              ← Önceki
            </span>
          ) : (
            <Link
              href={buildPageUrl(page - 1) as never}
              className="rounded-xl border border-line bg-paper px-3 py-1.5 text-[13.5px] font-bold text-cart hover:bg-cat-soft"
              data-page-prev
            >
              ← Önceki
            </Link>
          )}
          <span className="font-mono text-[12.5px] text-ink-3">
            {page} / {totalPages}
          </span>
          {isLastPage ? (
            <span className="rounded-xl border border-line bg-line-soft px-3 py-1.5 text-[13.5px] font-bold text-ink-4">
              Sonraki →
            </span>
          ) : (
            <Link
              href={buildPageUrl(page + 1) as never}
              className="rounded-xl border border-line bg-paper px-3 py-1.5 text-[13.5px] font-bold text-cart hover:bg-cat-soft"
              data-page-next
            >
              Sonraki →
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}

import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { eq, asc } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { listProducts } from '@/lib/catalog/products';
import { categories, brands, companies } from '@/db/schema';
import { hasExcelImport } from '@/lib/billing/plan-features';
import { ListRowToggle } from './list-row-toggle';
import { FilterBar } from './filter-bar';

/**
 * /admin/products list page.
 *
 * Sprint 3.5: search (?q=) + category/brand/status/vitrin filters.
 * Sprint 3.6+: pagination + bulk actions.
 */
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    updated?: string;
    deleted?: string;
    seed_image?: 'ok' | 'fail';
    reason?: string;
    moderation?: 'flagged';
    fields?: string;
    q?: string;
    category?: string;
    brand?: string;
    status?: 'active' | 'inactive' | 'all';
    vitrin?: 'on' | 'off';
  }>;
}) {
  const session = await auth();
  if (!session?.user?.companyId) {
    redirect('/login' as never);
  }

  const params = await searchParams;
  const justCreated = params.created === 'success';

  // Parallel: filtered list + filter options (category + brand) + plan
  const [items, categoryOptions, brandOptions, [companyRow]] = await Promise.all([
    listProducts(session.user.companyId, db, {
      query: params.q,
      categoryId: params.category,
      brandId: params.brand,
      status: params.status,
      vitrinPublished:
        params.vitrin === 'on' ? true : params.vitrin === 'off' ? false : undefined,
      limit: 100,
    }),
    db
      .select({ id: categories.id, name: categories.name, emoji: categories.emoji })
      .from(categories)
      .orderBy(asc(categories.displayOrder)),
    db
      .select({ id: brands.id, name: brands.name })
      .from(brands)
      .orderBy(asc(brands.name)),
    db
      .select({ plan: companies.plan })
      .from(companies)
      .where(eq(companies.id, session.user.companyId))
      .limit(1),
  ]);

  // 2026-05-22 Karar A revize — Excel import sadece PRO + PRO+ (FREE'de gizli)
  const showImportButton = hasExcelImport(companyRow?.plan ?? 'FREE');

  const hasActiveFilter =
    !!params.q ||
    !!params.category ||
    !!params.brand ||
    !!params.status ||
    !!params.vitrin;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12">
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[13px] font-bold uppercase tracking-wider text-cat">
            Admin · Ürünler
          </div>
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
            Ürün kataloğun
          </h1>
          <p className="mt-1 text-sm text-ink-3">
            {items.length} ürün
            {hasActiveFilter ? ' (filtreli)' : ' · FREE plan 50 ürün limit'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {showImportButton ? (
            <Link
              href={'/admin/products/import' as never}
              className="inline-flex items-center gap-2 rounded-xl border border-cat/40 bg-cat-soft px-4 py-2.5 text-sm font-bold text-cat-7 hover:bg-cat hover:text-white"
            >
              📥 Excel&apos;den içeri aktar
            </Link>
          ) : (
            <Link
              href={'/admin/products/import' as never}
              title="PRO planında Excel ile 500 ürün toplu import"
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-4 py-2.5 text-sm font-bold text-ink-4 hover:bg-cat-soft"
            >
              📥 Excel&apos;den içeri aktar <span className="text-[10px] uppercase tracking-wider text-cat">PRO</span>
            </Link>
          )}
          <Link
            href={'/admin/products/new' as never}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-5 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-cat)] hover:-translate-y-0.5 transition-transform"
          >
            + Yeni ürün
          </Link>
        </div>
      </header>

      {justCreated && (
        <div className="rounded-xl border border-arrow/40 bg-arrow-soft px-4 py-3 text-sm font-bold text-arrow-7">
          ✅ Ürün kataloğuna eklendi.
          {params.seed_image === 'ok' && (
            <span className="ml-1 font-normal">📷 Seed katalog görseli de otomatik yüklendi.</span>
          )}
          {params.seed_image === 'fail' && (
            <span className="ml-1 font-normal text-bars-7">
              ⚠ Seed katalog görseli yüklenemedi ({params.reason ?? 'unknown'}) — ürün detaydan manuel yükleyebilirsin.
            </span>
          )}
        </div>
      )}
      {params.moderation === 'flagged' && (
        <div
          role="alert"
          data-testid="moderation-warning"
          className="rounded-xl border border-bars/40 bg-bars-soft/60 px-4 py-3 text-sm text-bars-7"
        >
          <div className="font-bold">⚠ Uygunsuz olabilecek ifade tespit edildi</div>
          <p className="mt-1 text-[12.5px] leading-relaxed">
            Ürün kaydedildi ama içeriğini düzeltmeni öneririz — vitrin&apos;e açtığında müşteriler görür. Süperadmin&apos;e otomatik bildirildi.
          </p>
          {params.fields && (
            <p className="mt-1.5 text-[12.5px]">
              <strong>İlgili alan:</strong>{' '}
              <span className="rounded bg-paper/80 px-1.5 py-0.5 font-mono text-[11.5px]">
                {params.fields}
              </span>
            </p>
          )}
        </div>
      )}

      {params.updated === 'success' && (
        <div className="rounded-xl border border-arrow/40 bg-arrow-soft px-4 py-3 text-sm font-bold text-arrow-7">
          ✅ Ürün güncellendi.
        </div>
      )}

      {params.deleted === 'success' && (
        <div className="rounded-xl border border-cat/40 bg-cat-soft px-4 py-3 text-sm font-bold text-cart">
          🗑 Ürün silindi (soft delete — raporlarda görünür).
        </div>
      )}

      <FilterBar
        categories={categoryOptions}
        brands={brandOptions}
        initial={{
          q: params.q ?? '',
          category: params.category ?? '',
          brand: params.brand ?? '',
          status: params.status ?? 'all',
          vitrin: params.vitrin ?? '',
        }}
      />

      {items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-line bg-paper py-16 text-center">
          <Image
            src="/logo.webp"
            alt="PetStockPro"
            width={96}
            height={96}
            className="mx-auto h-24 w-24 object-contain"
          />
          <h2 className="mt-4 text-xl font-bold text-cart">
            {hasActiveFilter ? 'Filtreye uyan ürün yok' : 'Henüz ürün yok'}
          </h2>
          <p className="mt-2 text-sm text-ink-3">
            {hasActiveFilter
              ? 'Filtreleri temizle veya farklı bir arama dene.'
              : 'İlk ürününü ekleyerek başla — Royal Canin 2kg, kedi kumu, oyuncak vs.'}
          </p>
          <Link
            href={hasActiveFilter ? ('/admin/products' as never) : ('/admin/products/new' as never)}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-5 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-cat)]"
          >
            {hasActiveFilter ? '× Filtreyi temizle' : '+ İlk ürünü ekle'}
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-paper">
          <table className="w-full">
            <thead className="bg-paper">
              <tr className="text-left text-[12px] font-bold uppercase tracking-wider text-ink-3">
                <th className="px-4 py-3">Ürün</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Marka</th>
                <th className="px-4 py-3 text-right">Variant</th>
                <th className="px-4 py-3 text-right">Stok</th>
                <th className="px-4 py-3 text-right">Fiyat (₺)</th>
                <th className="px-4 py-3 text-right">Vitrin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft text-sm">
              {items.map((item) => (
                <tr key={item.id} className={`hover:bg-line-soft ${!item.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/products/${item.id}` as never}
                      className="font-bold text-ink hover:text-cart"
                    >
                      {item.name}
                    </Link>
                    <div className="font-mono text-[12px] text-ink-4">{item.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-ink-2">{item.categoryName ?? '—'}</td>
                  <td className="px-4 py-3 text-ink-2">{item.brandName ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-mono text-ink-2">{item.variantCount}</td>
                  <td
                    className={`px-4 py-3 text-right font-mono font-bold ${
                      item.totalStockQty === 0 ? 'text-danger-7' : 'text-ink'
                    }`}
                  >
                    {item.totalStockQty}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-ink-2">
                    {item.defaultSalePrice ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ListRowToggle
                      productId={item.id}
                      initialPublished={item.vitrinPublished}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Link
        href={'/' as never}
        className="text-center text-xs text-ink-4 hover:text-cart"
      >
        ← Panele dön
      </Link>
    </main>
  );
}

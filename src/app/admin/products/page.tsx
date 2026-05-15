import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { listProducts } from '@/lib/catalog/products';
import { ListRowToggle } from './list-row-toggle';

/**
 * /admin/products — Sprint 3.0 minimal list
 *
 * Server component: products list table.
 * Sprint 3.1+: search/filter/pagination + bulk actions + grid view.
 */
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; updated?: string; deleted?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.companyId) {
    redirect('/login' as never);
  }

  const items = await listProducts(session.user.companyId, db);
  const params = await searchParams;
  const justCreated = params.created === 'success';

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12">
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[11.5px] font-bold uppercase tracking-wider text-cat">
            Admin · Ürünler
          </div>
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
            Ürün kataloğun
          </h1>
          <p className="mt-1 text-sm text-ink-3">
            {items.length} ürün · FREE plan 50 ürün limit
          </p>
        </div>
        <Link
          href={'/admin/products/new' as never}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-5 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-cat)] hover:-translate-y-0.5 transition-transform"
        >
          + Yeni ürün
        </Link>
      </header>

      {justCreated && (
        <div className="rounded-xl border border-arrow/40 bg-arrow-soft px-4 py-3 text-sm font-bold text-arrow-7">
          ✅ Ürün kataloğuna eklendi.
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

      {items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-line bg-paper py-16 text-center">
          <div className="text-6xl">🐾</div>
          <h2 className="mt-4 text-xl font-bold text-cart">Henüz ürün yok</h2>
          <p className="mt-2 text-sm text-ink-3">
            İlk ürününü ekleyerek başla — Royal Canin 2kg, kedi kumu, oyuncak vs.
          </p>
          <Link
            href={'/admin/products/new' as never}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-5 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-cat)]"
          >
            + İlk ürünü ekle
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <table className="w-full">
            <thead className="bg-paper">
              <tr className="text-left text-[10.5px] font-bold uppercase tracking-wider text-ink-3">
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
                      href={`/admin/products/${item.id}/edit` as never}
                      className="font-bold text-ink hover:text-cart"
                    >
                      {item.name}
                    </Link>
                    <div className="font-mono text-[10.5px] text-ink-4">{item.slug}</div>
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

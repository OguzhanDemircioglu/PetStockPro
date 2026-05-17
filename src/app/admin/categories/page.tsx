import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { listCategories } from '@/lib/categories/manage';
import { DeleteCategoryButton } from './delete-category-button';

const VAT_LABEL: Record<string, string> = {
  '1.00': '%1',
  '8.00': '%8',
  '10.00': '%10',
  '20.00': '%20',
};

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; updated?: string; q?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const allItems = await listCategories(session.user.companyId, db);
  const params = await searchParams;
  const q = params.q?.trim().toLowerCase() ?? '';
  const items = q
    ? allItems.filter(
        (c) => c.name.toLowerCase().includes(q) || c.slug.includes(q),
      )
    : allItems;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[13px] font-bold uppercase tracking-wider text-cat">
            Admin · Kategoriler
          </div>
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
            Kategoriler
          </h1>
          <p className="mt-1 text-sm text-ink-3">
            {q
              ? `${items.length}/${allItems.length} kategori (filtreli)`
              : `${items.length} kategori · 16 default + kullanıcı eklemeleri`}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/admin/categories/export"
            download
            className="rounded-xl border border-line bg-paper px-3 py-2.5 text-xs font-bold text-cart hover:bg-cat-soft"
          >
            ⬇ CSV
          </a>
          <Link
            href={'/admin/categories/new' as never}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-5 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-cat)] hover:-translate-y-0.5 transition-transform"
            data-testid="add-category"
          >
            + Yeni kategori
          </Link>
        </div>
      </header>

      {params.created === 'success' && (
        <div className="rounded-xl border border-arrow/40 bg-arrow-soft px-4 py-3 text-sm font-bold text-arrow-7">
          ✅ Kategori eklendi.
        </div>
      )}
      {params.updated === 'success' && (
        <div className="rounded-xl border border-arrow/40 bg-arrow-soft px-4 py-3 text-sm font-bold text-arrow-7">
          ✅ Kategori güncellendi.
        </div>
      )}

      <form className="flex gap-2" action="/admin/categories" method="get">
        <input
          type="search"
          name="q"
          defaultValue={params.q ?? ''}
          placeholder="🔍 Kategori veya slug ara..."
          data-testid="category-search"
          className="flex-1 rounded-xl border-[1.5px] border-line bg-paper px-4 py-2.5 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
        />
        {q && (
          <a
            href="/admin/categories"
            className="rounded-xl border border-line bg-paper px-3 py-2.5 text-xs font-bold text-ink-3 hover:bg-line-soft"
          >
            × Temizle
          </a>
        )}
      </form>

      {items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-line bg-paper py-16 text-center">
          <div className="text-6xl">📂</div>
          <h2 className="mt-4 text-xl font-bold text-cart">Henüz kategori yok</h2>
          <p className="mt-2 text-sm text-ink-3">
            Yeni hesap açtığında 16 default kategori otomatik eklenir.
            Kendi kategorini de ekleyebilirsin.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-paper">
          <table className="w-full text-sm">
            <thead className="bg-paper">
              <tr className="text-left text-[12px] font-bold uppercase tracking-wider text-ink-3">
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">KDV</th>
                <th className="px-4 py-3">SKT</th>
                <th className="px-4 py-3 text-right">Sıra</th>
                <th className="px-4 py-3 text-right">Ürün</th>
                <th className="px-4 py-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {items.map((c) => (
                <tr key={c.id} data-category-id={c.id} className="hover:bg-line-soft">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/categories/${c.id}/edit` as never}
                      className="font-bold text-cart hover:underline"
                    >
                      {c.emoji ? `${c.emoji} ` : ''}{c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px] text-ink-3">
                    {c.slug}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {c.vatRate ? (
                      <span className="rounded bg-line-soft px-1.5 py-0.5 font-bold text-ink-2">
                        {VAT_LABEL[c.vatRate] ?? c.vatRate}
                      </span>
                    ) : (
                      <span className="text-ink-4">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {c.sktRequired ? (
                      <span className="rounded bg-cat-soft px-1.5 py-0.5 font-bold text-cart">
                        ⏳ Gerekli
                      </span>
                    ) : (
                      <span className="text-ink-4">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-ink-3">
                    {c.displayOrder}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-ink">
                    {c.productCount > 0 ? (
                      <Link
                        href={`/admin/products?category=${c.id}` as never}
                        className="text-cat hover:underline"
                        title="Bu kategorideki ürünleri göster"
                      >
                        {c.productCount}
                      </Link>
                    ) : (
                      <span className="text-ink-4">{c.productCount}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DeleteCategoryButton
                      categoryId={c.id}
                      categoryName={c.name}
                      productCount={c.productCount}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Link
        href={'/admin' as never}
        className="text-center text-xs text-ink-4 hover:text-cart"
      >
        ← Pano&apos;ya dön
      </Link>
    </main>
  );
}

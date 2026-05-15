import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { listBrands } from '@/lib/brands/manage';
import { DeleteBrandButton } from './delete-brand-button';

export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; updated?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const items = await listBrands(session.user.companyId, db);
  const params = await searchParams;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11.5px] font-bold uppercase tracking-wider text-cat">
            Admin · Markalar
          </div>
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
            Markalar
          </h1>
          <p className="mt-1 text-sm text-ink-3">
            {items.length === 0
              ? 'Henüz marka yok'
              : `${items.length} marka tanımlı`}
          </p>
        </div>
        <Link
          href={'/admin/brands/new' as never}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-5 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-cat)] hover:-translate-y-0.5 transition-transform"
          data-testid="add-brand"
        >
          + Yeni marka
        </Link>
      </header>

      {params.created === 'success' && (
        <div className="rounded-xl border border-arrow/40 bg-arrow-soft px-4 py-3 text-sm font-bold text-arrow-7">
          ✅ Marka eklendi.
        </div>
      )}
      {params.updated === 'success' && (
        <div className="rounded-xl border border-arrow/40 bg-arrow-soft px-4 py-3 text-sm font-bold text-arrow-7">
          ✅ Marka güncellendi.
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-line bg-paper py-16 text-center">
          <div className="text-6xl">🏷</div>
          <h2 className="mt-4 text-xl font-bold text-cart">Henüz marka yok</h2>
          <p className="mt-2 text-sm text-ink-3">
            Royal Canin, Hill&apos;s, Catit gibi markaları ekleyince ürünlere
            atayabilirsin.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead className="bg-paper">
              <tr className="text-left text-[10.5px] font-bold uppercase tracking-wider text-ink-3">
                <th className="px-4 py-3">Marka</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3 text-right">Ürün sayısı</th>
                <th className="px-4 py-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {items.map((b) => (
                <tr key={b.id} data-brand-id={b.id} className="hover:bg-line-soft">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/brands/${b.id}/edit` as never}
                      className="font-bold text-cart hover:underline"
                    >
                      {b.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11.5px] text-ink-3">
                    {b.slug}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-ink">
                    {b.productCount}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DeleteBrandButton
                      brandId={b.id}
                      brandName={b.name}
                      productCount={b.productCount}
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

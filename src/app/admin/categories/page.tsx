import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { listCategories, type CategoryListItem } from '@/lib/categories/manage';
import { isSuperadmin } from '@/lib/superadmin/access';
import { ModerationQueryBanner } from '@/components/moderation/moderation-query-banner';
import { DeleteCategoryButton } from './delete-category-button';
import { ResetMyCategoriesButton } from './reset-categories-button';

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    updated?: string;
    q?: string;
    moderation?: 'flagged';
    fields?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const allItems = await listCategories(session.user.companyId, db);
  const params = await searchParams;
  const q = params.q?.trim().toLowerCase() ?? '';
  // Kategori CRUD + sıfırla + CSV indir: sadece SUPERADMIN
  const canManage = isSuperadmin(session);
  const hasNoChildren = !allItems.some((c) => c.parentId);

  // Filtreleme: arama varsa hem root hem child match olabilir; bir match'in
  // root'unu da göstermek için "match olmasa bile parent'ı match'in alındır"
  // şeklinde mantık yürütmek karışır. Şimdilik: filtreleme aktifken düz liste,
  // filtre boşken parent-child gruplama göster.
  const filtered = q
    ? allItems.filter(
        (c) => c.name.toLowerCase().includes(q) || c.slug.includes(q),
      )
    : allItems;

  // Parent-child gruplama
  const roots = allItems.filter((c) => !c.parentId);
  const childrenByParent = new Map<string, CategoryListItem[]>();
  for (const c of allItems) {
    if (!c.parentId) continue;
    const list = childrenByParent.get(c.parentId) ?? [];
    list.push(c);
    childrenByParent.set(c.parentId, list);
  }
  // Orphan child'lar (parent yok / silinmiş) — diğer kategori olarak grup altı
  const orphans = allItems.filter(
    (c) => c.parentId && !allItems.find((r) => r.id === c.parentId),
  );

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
              ? `${filtered.length}/${allItems.length} kategori (filtreli)`
              : `${roots.length} üst kategori · ${allItems.length - roots.length} alt kategori · ${allItems.length} toplam`}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <a
              href="/admin/categories/export"
              download
              className="rounded-xl border border-line bg-paper px-3 py-2.5 text-xs font-bold text-cart hover:bg-cat-soft"
            >
              ⬇ Excel
            </a>
            <Link
              href={'/admin/categories/new' as never}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-5 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-cat)] hover:-translate-y-0.5 transition-transform"
              data-testid="add-category"
            >
              + Yeni kategori
            </Link>
          </div>
        )}
      </header>

      {params.created === 'success' && (
        <div className="rounded-xl border border-arrow/40 bg-arrow-soft px-4 py-3 text-sm font-bold text-arrow-7">
          ✅ Kategori eklendi.
        </div>
      )}
      <ModerationQueryBanner
        moderation={params.moderation}
        fields={params.fields}
        entityLabel="Kategori"
      />
      {params.updated === 'success' && (
        <div className="rounded-xl border border-arrow/40 bg-arrow-soft px-4 py-3 text-sm font-bold text-arrow-7">
          ✅ Kategori güncellendi.
        </div>
      )}


      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-4">
        <div className="flex items-start gap-3 text-[13px]">
          <span aria-hidden className="text-base">🗂</span>
          <p className="text-ink-3">
            Kategori yapısı <strong className="text-cart">2 seviyeli</strong>:
            6 üst kategori (Kedi / Köpek / Kuş / Akvaryum / Kemirgen / Sürüngen)
            altında alt kategoriler. Üst kategori sadece gruplama içindir —
            ürünler genellikle alt kategoriye atanır.
          </p>
        </div>
        {canManage && hasNoChildren && allItems.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-cat/30 bg-cat-soft px-3 py-2.5">
            <span aria-hidden className="text-base">⚠</span>
            <p className="flex-1 text-[12.5px] text-cart">
              Mevcut kategorilerin <strong>eski tek-seviyeli yapıda</strong>.
              Yeni 49 hiyerarşik default&apos;a sıfırlamak istersen:
            </p>
            <ResetMyCategoriesButton />
          </div>
        )}
        {canManage && !hasNoChildren && (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line-soft pt-3">
            <ResetMyCategoriesButton />
          </div>
        )}
      </div>

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

      {allItems.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-line bg-paper py-16 text-center">
          <div className="text-6xl">📂</div>
          <h2 className="mt-4 text-xl font-bold text-cart">Henüz kategori yok</h2>
          <p className="mt-2 text-sm text-ink-3">
            Yeni hesap açtığında 49 default kategori (6 üst + 43 alt) otomatik
            eklenir. Kendi kategorini de ekleyebilirsin.
          </p>
        </div>
      ) : q ? (
        // Filtre aktifken düz tablo (parent-child gruplama atlanır)
        <FlatTable items={filtered} canManage={canManage} />
      ) : (
        // Filtre boşken parent-child gruplama
        <div className="flex flex-col gap-4">
          {roots.map((root) => (
            <RootCategoryGroup
              key={root.id}
              root={root}
              items={childrenByParent.get(root.id) ?? []}
              canManage={canManage}
            />
          ))}
          {orphans.length > 0 && (
            <RootCategoryGroup
              root={null}
              items={orphans}
              canManage={canManage}
            />
          )}
        </div>
      )}
    </main>
  );
}

function RootCategoryGroup({
  root,
  items,
  canManage,
}: {
  root: CategoryListItem | null;
  items: CategoryListItem[];
  canManage: boolean;
}) {
  const childCount = items.length;
  return (
    <section
      data-root-category={root?.id ?? 'orphan'}
      className="overflow-hidden rounded-2xl border border-line bg-paper"
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-line-soft/40 px-4 py-3">
        <span aria-hidden className="text-xl">
          {root?.emoji ?? '🗂'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {root ? (
              canManage ? (
                <Link
                  href={`/admin/categories/${root.id}/edit` as never}
                  className="text-base font-bold text-cart hover:underline"
                >
                  {root.name}
                </Link>
              ) : (
                <span className="text-base font-bold text-cart">{root.name}</span>
              )
            ) : (
              <span className="text-base font-bold text-ink-3">
                Bağımsız (üst kategori silinmiş)
              </span>
            )}
            <span className="rounded-full bg-cat-soft px-2 py-0.5 text-[11px] font-bold text-cart">
              {childCount} alt
            </span>
          </div>
        </div>
        {root && (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-paper px-2 py-0.5 text-[10.5px] font-bold text-ink-3">
              ürün: {root.productCount}
            </span>
            {canManage && (
              <DeleteCategoryButton
                categoryId={root.id}
                categoryName={root.name}
                productCount={root.productCount + childCount}
              />
            )}
          </div>
        )}
      </header>

      {childCount === 0 ? (
        <p className="px-4 py-6 text-center text-[12px] text-ink-4">
          Henüz alt kategori yok.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-paper">
            <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-ink-3">
              <th className="px-4 py-2.5">Alt kategori</th>
              <th className="px-4 py-2.5">SKT</th>
              <th className="px-4 py-2.5 text-right">Sıra</th>
              <th className="px-4 py-2.5 text-right">Ürün</th>
              {canManage && <th className="px-4 py-2.5 text-right">İşlem</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {items.map((c) => (
              <CategoryRow key={c.id} c={c} canManage={canManage} />
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function FlatTable({
  items,
  canManage,
}: {
  items: CategoryListItem[];
  canManage: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-paper">
      <table className="w-full text-sm">
        <thead className="bg-paper">
          <tr className="text-left text-[12px] font-bold uppercase tracking-wider text-ink-3">
            <th className="px-4 py-3">Kategori</th>
            <th className="px-4 py-3">SKT</th>
            <th className="px-4 py-3 text-right">Sıra</th>
            <th className="px-4 py-3 text-right">Ürün</th>
            {canManage && <th className="px-4 py-3 text-right">İşlem</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {items.map((c) => (
            <CategoryRow key={c.id} c={c} canManage={canManage} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CategoryRow({
  c,
  canManage,
}: {
  c: CategoryListItem;
  canManage: boolean;
}) {
  return (
    <tr data-category-id={c.id} className="hover:bg-line-soft">
      <td className="px-4 py-3">
        {canManage ? (
          <Link
            href={`/admin/categories/${c.id}/edit` as never}
            className="font-bold text-cart hover:underline"
          >
            {c.emoji ? `${c.emoji} ` : ''}
            {c.name}
          </Link>
        ) : (
          <span className="font-bold text-cart">
            {c.emoji ? `${c.emoji} ` : ''}
            {c.name}
          </span>
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
      {canManage && (
        <td className="px-4 py-3 text-right">
          <DeleteCategoryButton
            categoryId={c.id}
            categoryName={c.name}
            productCount={c.productCount}
          />
        </td>
      )}
    </tr>
  );
}

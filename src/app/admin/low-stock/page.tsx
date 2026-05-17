import { redirect } from 'next/navigation';
import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { listLowStock } from '@/lib/dashboard/stats';
import { getTransferSuggestionsBulk } from '@/lib/stock/transfer-suggestions';
import { branches as branchesTable, categories as categoriesTable } from '@/db/schema';

export default async function LowStockPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; branch?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const params = await searchParams;
  const filters = {
    categoryId: params.category && /^[0-9a-f-]{36}$/i.test(params.category)
      ? params.category
      : undefined,
    branchId: params.branch && /^[0-9a-f-]{36}$/i.test(params.branch)
      ? params.branch
      : undefined,
  };
  const hasFilter = !!filters.categoryId || !!filters.branchId;

  const [items, categoryList, branchList] = await Promise.all([
    listLowStock(session.user.companyId, db, { limit: 200, ...filters }),
    db
      .select({ id: categoriesTable.id, name: categoriesTable.name })
      .from(categoriesTable)
      .where(eq(categoriesTable.companyId, session.user.companyId))
      .orderBy(asc(categoriesTable.name)),
    db
      .select({ id: branchesTable.id, name: branchesTable.name })
      .from(branchesTable)
      .where(eq(branchesTable.companyId, session.user.companyId))
      .orderBy(asc(branchesTable.name)),
  ]);

  // Variant ID'lerini topla + transfer önerilerini getir
  const variantIds = Array.from(new Set(items.map((i) => i.variantId)));
  const suggestionsByVariant = await getTransferSuggestionsBulk(
    session.user.companyId,
    variantIds,
    db,
  );

  // Variant bazında grupla (aynı variant farklı şubelerde olabilir)
  const groups = new Map<
    string,
    { productName: string; variantLabel: string; sku: string; branches: typeof items }
  >();
  for (const item of items) {
    const key = item.variantId;
    if (!groups.has(key)) {
      groups.set(key, {
        productName: item.productName,
        variantLabel: item.variantLabel,
        sku: item.sku,
        branches: [],
      });
    }
    groups.get(key)!.branches.push(item);
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12">
      <header>
        <div className="text-[13px] font-bold uppercase tracking-wider text-cat">
          Admin · Düşük Stok
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          ⚠ Düşük stok variantları
        </h1>
        <p className="mt-1 text-sm text-ink-3">
          {items.length === 0
            ? '✓ Hiç düşük stok yok.'
            : `${items.length} satır · ${groups.size} variant`}{' '}
          · Eşik altı ve sıfır stoklar{hasFilter ? ' (filtreli)' : ''}
        </p>
      </header>

      <form
        method="get"
        action="/admin/low-stock"
        data-testid="low-stock-filter"
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-paper p-4"
      >
        <div className="min-w-[200px] flex-1">
          <label
            htmlFor="category"
            className="mb-1 block text-[12px] font-bold uppercase tracking-wider text-ink-3"
          >
            Kategori
          </label>
          <select
            id="category"
            name="category"
            defaultValue={filters.categoryId ?? ''}
            data-testid="ls-category"
            className="w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-2.5 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          >
            <option value="">Tüm kategoriler</option>
            {categoryList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[200px] flex-1">
          <label
            htmlFor="branch"
            className="mb-1 block text-[12px] font-bold uppercase tracking-wider text-ink-3"
          >
            Şube
          </label>
          <select
            id="branch"
            name="branch"
            defaultValue={filters.branchId ?? ''}
            data-testid="ls-branch"
            className="w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-2.5 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          >
            <option value="">Tüm şubeler</option>
            {branchList.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
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
        {hasFilter && (
          <Link
            href={'/admin/low-stock' as never}
            className="rounded-xl border border-line bg-paper px-3 py-2.5 text-xs font-bold text-ink-3 hover:bg-line-soft"
            data-testid="ls-clear"
          >
            × Temizle
          </Link>
        )}
      </form>

      {items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-line bg-arrow-soft/30 py-16 text-center">
          <div className="text-6xl">✓</div>
          <h2 className="mt-4 text-xl font-bold text-arrow-7">Tüm stoklar yeterli</h2>
          <p className="mt-2 text-sm text-ink-3">
            Eşik altı variant yok. Sipariş gerektiren durum oluşmadı.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {Array.from(groups.entries()).map(([variantId, group]) => (
            <article
              key={variantId}
              data-variant-id={variantId}
              className="rounded-2xl border border-cat/30 bg-cat-soft/30 p-5"
            >
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-cart">{group.productName}</h2>
                  <div className="mt-0.5 text-xs text-ink-3">
                    {group.variantLabel} · <span className="font-mono">SKU {group.sku}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/admin/stock-movements?variant=${variantId}` as never}
                    className="rounded-xl border border-line bg-paper px-3 py-2 text-[12.5px] font-bold text-cart hover:bg-cat-soft"
                    data-testid={`history-${variantId}`}
                  >
                    🕒 Geçmiş
                  </Link>
                  <Link
                    href={`/admin/stock-movements` as never}
                    className="rounded-xl bg-gradient-to-br from-arrow to-arrow-2 px-4 py-2 text-xs font-bold text-white shadow-sm hover:-translate-y-0.5 transition-transform"
                    data-testid={`stock-in-${variantId}`}
                  >
                    📥 Stok girişi yap →
                  </Link>
                </div>
              </header>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {group.branches.map((b) => {
                  const isZero = b.stockQty === 0;
                  return (
                    <div
                      key={`${b.variantId}-${b.branchId}`}
                      data-branch-id={b.branchId}
                      className={`rounded-xl border bg-paper p-3 ${
                        isZero ? 'border-danger/40' : 'border-line'
                      }`}
                    >
                      <div className="text-[12.5px] font-bold uppercase tracking-wider text-ink-3">
                        {b.branchName}
                      </div>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span
                          className={`font-mono text-2xl font-bold ${
                            isZero ? 'text-danger-7' : 'text-cat'
                          }`}
                        >
                          {b.stockQty}
                        </span>
                        <span className="text-[11.5px] text-ink-4">
                          / {b.threshold} eşik
                        </span>
                      </div>
                      {isZero && (
                        <p className="mt-1 text-[12px] font-bold text-danger-7">
                          ⚠ Sıfır stok — vitrin&apos;den otomatik düşmüş olabilir
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {(() => {
                const suggestions = suggestionsByVariant.get(variantId);
                if (!suggestions || suggestions.length === 0) return null;
                return (
                  <div
                    className="mt-3 rounded-xl border border-arrow/30 bg-arrow-soft/30 p-3"
                    data-testid={`transfer-suggestion-${variantId}`}
                  >
                    <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wider text-arrow-7">
                      🔁 Önerilen transfer
                    </div>
                    <ul className="flex flex-col gap-1 text-[13px] text-ink-2">
                      {suggestions.map((s, idx) => (
                        <li
                          key={`${s.sourceBranchId}-${s.targetBranchId}-${idx}`}
                          data-suggestion={`${s.sourceBranchId}-${s.targetBranchId}`}
                          className="flex flex-wrap items-center gap-1.5"
                        >
                          <strong className="text-arrow-7">{s.sourceBranchName}</strong>
                          <span className="font-mono text-[11.5px] text-ink-3">
                            (stok {s.sourceStock})
                          </span>
                          <span>→</span>
                          <strong className="text-cart">{s.targetBranchName}</strong>
                          <span className="font-mono text-[11.5px] text-ink-3">
                            (stok {s.targetStock})
                          </span>
                          <span className="ml-auto rounded-full bg-arrow px-2 py-0.5 text-[11.5px] font-bold text-white">
                            +{s.suggestedQty} adet
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {suggestions.map((s, idx) => (
                        <Link
                          key={`open-${s.sourceBranchId}-${s.targetBranchId}-${idx}`}
                          href={
                            `/admin/stock-movements?openTransfer=1&from=${s.sourceBranchId}&to=${s.targetBranchId}&variant=${variantId}&qty=${s.suggestedQty}` as never
                          }
                          data-testid={`open-transfer-${s.sourceBranchId}-${s.targetBranchId}`}
                          className="rounded-lg border border-arrow/40 bg-paper px-2 py-1 text-[11.5px] font-bold text-arrow-7 hover:bg-arrow-soft"
                        >
                          ▶ {s.sourceBranchName} → {s.targetBranchName} ({s.suggestedQty} ad)
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </article>
          ))}
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

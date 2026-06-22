import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { withTenant } from '@/lib/db/with-tenant';
import {
  getProductDetailFull,
  getProductVariantMatrix,
  listProductRecentMovements,
} from '@/lib/catalog/product-detail';

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  stock_in: { label: '📥', cls: 'bg-arrow-soft text-arrow-7' },
  stock_out: { label: '📤', cls: 'bg-cat-soft text-cart' },
  transfer: { label: '🔁', cls: 'bg-line-soft text-ink-2' },
  stocktake: { label: '📋', cls: 'bg-line-soft text-ink-2' },
  stocktake_initial: { label: '🗂', cls: 'bg-line-soft text-ink-2' },
};

const AUTO_UNPUBLISH_REASON_LABEL: Record<string, string> = {
  stock_zero: 'Stok 0 düştü',
  manual: 'Manuel kapatıldı',
};

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const { id } = await params;
  const companyId = session.user.companyId;
  const [product, matrix, movements] = await withTenant(companyId, (tx) =>
    Promise.all([
      getProductDetailFull(companyId, id, tx),
      getProductVariantMatrix(companyId, id, tx),
      listProductRecentMovements(companyId, id, tx, 12),
    ]),
  );

  if (!product) notFound();

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold uppercase tracking-wider text-cat">
            Admin · Ürünler · Detay
          </div>
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
            {product.name}
          </h1>
          <p className="mt-1 text-sm text-ink-3">
            <span className="font-mono">{product.slug}</span>
            {product.categoryName && <span> · {product.categoryName}</span>}
            {product.brandName && <span> · {product.brandName}</span>}
          </p>
        </div>
        <Link
          href={`/admin/products/${product.id}/edit` as never}
          className="rounded-xl border border-line bg-paper px-4 py-2 text-xs font-bold text-cart hover:bg-cat-soft"
        >
          ✎ Ürünü düzenle
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI title="Toplam stok" value={product.totalStockQty} emoji="📦" />
        <KPI title="Variant sayısı" value={matrix.variants.length} emoji="🏷" />
        <KPI
          title="Durum"
          value={product.isActive ? 'Aktif' : 'Pasif'}
          emoji={product.isActive ? '✓' : '⏸'}
          accent={product.isActive ? 'arrow' : 'cat'}
        />
        <KPI
          title="Vitrin"
          value={product.vitrinPublished ? 'Yayında' : 'Kapalı'}
          emoji={product.vitrinPublished ? '🌐' : '🔒'}
          accent={product.vitrinPublished ? 'arrow' : 'cat'}
        />
      </section>

      {!product.vitrinPublished && product.vitrinAutoUnpublishedReason && (
        <div
          role="status"
          className="rounded-xl border border-cat/30 bg-cat-soft/30 px-4 py-3 text-sm text-cart"
        >
          🔒 Vitrin kapanma sebebi:{' '}
          <strong>
            {AUTO_UNPUBLISH_REASON_LABEL[product.vitrinAutoUnpublishedReason] ??
              product.vitrinAutoUnpublishedReason}
          </strong>
          {product.vitrinAutoUnpublishedReason === 'stock_zero' && (
            <span> — Stok girişi yapıp tekrar &quot;Satışa Aç&quot; toggle ile aç.</span>
          )}
        </div>
      )}

      {product.description && (
        <section className="rounded-2xl border border-line bg-paper p-5">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">
            Açıklama
          </h2>
          <p className="text-sm leading-relaxed text-ink-2 whitespace-pre-wrap">
            {product.description}
          </p>
        </section>
      )}

      <section
        className="overflow-x-auto rounded-2xl border border-line bg-paper"
        data-testid="variant-matrix"
      >
        <table className="w-full text-sm">
          <thead className="bg-paper">
            <tr className="text-left text-[12px] font-bold uppercase tracking-wider text-ink-3">
              <th className="px-4 py-3">Variant</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3 text-right">Fiyat</th>
              <th className="px-4 py-3 text-right">Eşik</th>
              {matrix.branches.map((b) => (
                <th key={b.id} className="px-4 py-3 text-right">
                  {b.name}
                </th>
              ))}
              <th className="px-4 py-3 text-right">Toplam</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {matrix.variants.length === 0 ? (
              <tr>
                <td
                  colSpan={5 + matrix.branches.length}
                  className="py-8 text-center text-xs text-ink-3"
                >
                  Bu ürün için variant yok.
                </td>
              </tr>
            ) : (
              matrix.variants.map((v) => (
                <tr
                  key={v.variantId}
                  data-variant-id={v.variantId}
                  data-inactive={v.isActive ? '0' : '1'}
                  className={v.isActive ? '' : 'opacity-50'}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {v.isDefault && (
                        <span className="rounded-full bg-cat-soft px-1.5 py-0.5 text-[10.5px] font-bold text-cart">
                          DEFAULT
                        </span>
                      )}
                      {!v.isActive && (
                        <span className="rounded-full bg-line-soft px-1.5 py-0.5 text-[10.5px] font-bold text-ink-3">
                          PASİF
                        </span>
                      )}
                      <span className="font-bold text-ink">{v.variantLabel}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[12.5px] text-ink-3">{v.sku}</td>
                  <td className="px-4 py-3 text-right font-mono text-[13.5px] text-cart">
                    {Number(v.salePrice).toLocaleString('tr-TR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    ₺
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[12.5px] text-ink-3">
                    {v.threshold}
                  </td>
                  {v.branches.map((br) => {
                    const isLow = br.stockQty <= v.threshold && v.threshold > 0;
                    const isZero = br.stockQty === 0;
                    return (
                      <td
                        key={br.branchId}
                        className="px-4 py-3 text-right font-mono text-[13.5px]"
                        data-branch-cell={br.branchId}
                        data-stock={br.stockQty}
                      >
                        <span
                          className={`font-bold ${
                            isZero ? 'text-danger-7' : isLow ? 'text-cart' : 'text-ink'
                          }`}
                        >
                          {br.stockQty}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-right font-mono font-bold text-cart">
                    {v.totalStockQty}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-line bg-paper p-5" data-testid="product-movements">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-3">
            🕒 Son hareketler
          </h2>
          <Link
            href={`/admin/stock-movements?variant=${matrix.variants[0]?.variantId ?? ''}` as never}
            className="text-[12.5px] font-bold text-cat hover:underline"
          >
            Tümü →
          </Link>
        </div>
        {movements.length === 0 ? (
          <p className="rounded-lg bg-line-soft px-3 py-4 text-center text-xs text-ink-3">
            Bu ürün için hareket yok.
          </p>
        ) : (
          <ul className="divide-y divide-line-soft text-xs">
            {movements.map((m) => {
              const badge = TYPE_BADGE[m.type] ?? {
                label: m.type,
                cls: 'bg-line-soft text-ink-2',
              };
              return (
                <li key={m.id} className="flex items-center gap-2 py-2">
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-bold ${badge.cls}`}
                  >
                    {badge.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-bold text-ink">{m.variantLabel}</div>
                    <div className="text-[11.5px] text-ink-3">
                      {m.branchName} ·{' '}
                      {new Date(m.createdAt).toLocaleString('tr-TR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <div
                    className={`font-mono text-sm font-bold ${
                      m.quantity > 0 ? 'text-arrow-7' : 'text-cart'
                    }`}
                  >
                    {m.quantity > 0 ? '+' : ''}
                    {m.quantity}
                    <span className="ml-1 text-[11.5px] text-ink-3">→ {m.afterQty}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Link
        href={'/admin/products' as never}
        className="text-center text-xs text-ink-4 hover:text-cart"
      >
        ← Ürün listesi
      </Link>
    </main>
  );
}

function KPI({
  title,
  value,
  emoji,
  accent = 'arrow',
}: {
  title: string;
  value: number | string;
  emoji: string;
  accent?: 'cat' | 'arrow' | 'danger';
}) {
  const cls: Record<string, string> = {
    cat: 'border-cat/30 bg-cat-soft/40',
    arrow: 'border-arrow/30 bg-arrow-soft/40',
    danger: 'border-danger/30 bg-danger-soft/40',
  };
  return (
    <article className={`flex flex-col gap-2 rounded-2xl border p-5 ${cls[accent]}`}>
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold uppercase tracking-wider text-ink-3">
          {title}
        </span>
        <span className="text-xl">{emoji}</span>
      </div>
      <div className="font-mono text-2xl font-bold text-cart">{value}</div>
    </article>
  );
}

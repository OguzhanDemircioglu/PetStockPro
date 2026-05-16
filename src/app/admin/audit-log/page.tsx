import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { listAuditLogs } from '@/lib/audit/list';
import { SettingsShell } from '@/components/settings-shell';

const ACTION_LABELS: Record<string, { label: string; cls: string }> = {
  'product.created': { label: '🐾 Ürün eklendi', cls: 'bg-arrow-soft text-arrow-7' },
  'product.updated': { label: '✎ Ürün güncellendi', cls: 'bg-line-soft text-ink-2' },
  'product.deleted': { label: '🗑 Ürün silindi', cls: 'bg-danger-soft text-danger-7' },
  'stock.in': { label: '📥 Stok girişi', cls: 'bg-arrow-soft text-arrow-7' },
  'stock.out': { label: '📤 Stok çıkışı', cls: 'bg-cat-soft text-cart' },
  'stock.transfer': { label: '🔁 Transfer', cls: 'bg-line-soft text-ink-2' },
  'stock.stocktake': { label: '📋 Sayım', cls: 'bg-line-soft text-ink-2' },
  'stock.reversed': { label: '↶ Geri alma', cls: 'bg-cat-soft text-cart' },
  'stocktake.started': { label: '🟢 Sayım başlatıldı', cls: 'bg-cat-soft text-cart' },
  'stocktake.completed': { label: '✅ Sayım tamamlandı', cls: 'bg-arrow-soft text-arrow-7' },
  'stocktake.cancelled': { label: '× Sayım iptal', cls: 'bg-danger-soft text-danger-7' },
  'storefront.published': { label: '🌐 Vitrin açıldı', cls: 'bg-arrow-soft text-arrow-7' },
  'storefront.unpublished': { label: '🔒 Vitrin kapatıldı', cls: 'bg-line-soft text-ink-2' },
  'branch.created': { label: '🏪 Şube eklendi', cls: 'bg-arrow-soft text-arrow-7' },
  'branch.updated': { label: '✎ Şube güncellendi', cls: 'bg-line-soft text-ink-2' },
  'branch.activated': { label: '↺ Şube aktif', cls: 'bg-arrow-soft text-arrow-7' },
  'branch.deactivated': { label: '⏸ Şube pasif', cls: 'bg-line-soft text-ink-2' },
  'supplier.created': { label: '🏢 Tedarikçi eklendi', cls: 'bg-arrow-soft text-arrow-7' },
  'supplier.updated': { label: '✎ Tedarikçi güncellendi', cls: 'bg-line-soft text-ink-2' },
  'supplier.activated': { label: '↺ Tedarikçi aktif', cls: 'bg-arrow-soft text-arrow-7' },
  'supplier.deactivated': { label: '⏸ Tedarikçi pasif', cls: 'bg-line-soft text-ink-2' },
  'brand.created': { label: '🏷 Marka eklendi', cls: 'bg-arrow-soft text-arrow-7' },
  'brand.updated': { label: '✎ Marka güncellendi', cls: 'bg-line-soft text-ink-2' },
  'brand.deleted': { label: '🗑 Marka silindi', cls: 'bg-danger-soft text-danger-7' },
  'category.created': { label: '📂 Kategori eklendi', cls: 'bg-arrow-soft text-arrow-7' },
  'category.updated': { label: '✎ Kategori güncellendi', cls: 'bg-line-soft text-ink-2' },
  'category.deleted': { label: '🗑 Kategori silindi', cls: 'bg-danger-soft text-danger-7' },
  'company.updated': { label: '⚙ Firma güncellendi', cls: 'bg-line-soft text-ink-2' },
  'company.vat_no_set': { label: '⚙ Vergi no atandı', cls: 'bg-arrow-soft text-arrow-7' },
};

const ACTION_GROUPS: { value: string; label: string }[] = [
  { value: '', label: 'Tüm aksiyonlar' },
  { value: 'product.created', label: '🐾 Ürün eklendi' },
  { value: 'product.updated', label: '✎ Ürün güncellendi' },
  { value: 'product.deleted', label: '🗑 Ürün silindi' },
  { value: 'stock.in', label: '📥 Stok girişi' },
  { value: 'stock.out', label: '📤 Stok çıkışı' },
  { value: 'stock.transfer', label: '🔁 Transfer' },
  { value: 'stock.stocktake', label: '📋 Sayım' },
  { value: 'stock.reversed', label: '↶ Geri alma' },
  { value: 'storefront.published', label: '🌐 Vitrin açıldı' },
  { value: 'storefront.unpublished', label: '🔒 Vitrin kapatıldı' },
  { value: 'brand.created', label: '🏷 Marka eklendi' },
  { value: 'category.created', label: '📂 Kategori eklendi' },
  { value: 'supplier.created', label: '🏢 Tedarikçi eklendi' },
  { value: 'branch.created', label: '🏪 Şube eklendi' },
  { value: 'company.updated', label: '⚙ Firma güncellendi' },
];

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; entity?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const params = await searchParams;
  const validAction = ACTION_GROUPS.find((g) => g.value === params.action)?.value;

  const items = await listAuditLogs(session.user.companyId, db, {
    limit: 100,
    action: validAction || undefined,
    entityType: params.entity || undefined,
  });

  const hasFilter = !!validAction || !!params.entity;

  return (
    <SettingsShell
      current="audit"
      title="Audit log"
      description={`Son ${items.length} aksiyon${hasFilter ? ' (filtreli)' : ' · Append-only (KVKK 5 yıl saklama)'}`}
    >
      <div className="flex flex-col gap-6">
      <form
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-4"
        action="/admin/audit-log"
        method="get"
        data-testid="audit-filter"
      >
        <div className="min-w-[220px] flex-1">
          <label
            htmlFor="action-select"
            className="mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-ink-3"
          >
            Aksiyon
          </label>
          <select
            id="action-select"
            name="action"
            defaultValue={validAction ?? ''}
            data-testid="audit-action"
            className="w-full rounded-xl border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          >
            {ACTION_GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[180px]">
          <label
            htmlFor="entity-select"
            className="mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-ink-3"
          >
            Hedef türü
          </label>
          <select
            id="entity-select"
            name="entity"
            defaultValue={params.entity ?? ''}
            data-testid="audit-entity"
            className="w-full rounded-xl border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          >
            <option value="">Hepsi</option>
            <option value="product">Ürün</option>
            <option value="stock_movement">Stok hareketi</option>
            <option value="transfer_group">Transfer</option>
            <option value="brand">Marka</option>
            <option value="category">Kategori</option>
            <option value="supplier">Tedarikçi</option>
            <option value="branch">Şube</option>
            <option value="company">Firma</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-xl bg-cat px-5 py-2.5 text-sm font-bold text-white shadow-sm"
        >
          Filtrele
        </button>
        {hasFilter && (
          <Link
            href={'/admin/audit-log' as never}
            className="rounded-xl border border-line bg-white px-3 py-2.5 text-xs font-bold text-ink-3 hover:bg-line-soft"
          >
            × Temizle
          </Link>
        )}
        <a
          href={`/admin/audit-log/export${validAction || params.entity ? `?${new URLSearchParams({ ...(validAction ? { action: validAction } : {}), ...(params.entity ? { entity: params.entity } : {}) }).toString()}` : ''}`}
          download
          className="ml-auto rounded-xl border border-line bg-white px-3 py-2.5 text-xs font-bold text-cart hover:bg-cat-soft"
          data-testid="audit-export"
        >
          ⬇ CSV
        </a>
      </form>

      {items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-line bg-paper py-16 text-center">
          <div className="text-6xl">📜</div>
          <h2 className="mt-4 text-xl font-bold text-cart">
            {hasFilter ? 'Filtreye uyan kayıt yok' : 'Henüz audit kaydı yok'}
          </h2>
          <p className="mt-2 text-sm text-ink-3">
            {hasFilter
              ? 'Filtreyi temizleyerek tüm aksiyonları görüntüle.'
              : 'Ürün ekleme, stok hareketi gibi aksiyonlar otomatik kayıt olur.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead className="bg-paper">
              <tr className="text-left text-[10.5px] font-bold uppercase tracking-wider text-ink-3">
                <th className="px-4 py-3">Tarih</th>
                <th className="px-4 py-3">Aksiyon</th>
                <th className="px-4 py-3">Kullanıcı</th>
                <th className="px-4 py-3">Hedef</th>
                <th className="px-4 py-3">Değişiklik</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {items.map((row) => {
                const badge = ACTION_LABELS[row.action] ?? {
                  label: row.action,
                  cls: 'bg-line-soft text-ink-2',
                };
                return (
                  <tr key={row.id} data-audit-id={row.id} className="hover:bg-line-soft">
                    <td className="px-4 py-3 text-[11px] text-ink-3 whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleString('tr-TR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                      {row.performedAsSuperadmin && (
                        <span className="ml-2 rounded bg-cat-soft px-1.5 py-0.5 text-[9px] font-bold text-cart">
                          🛡 Süperadmin
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-ink-3">
                      {row.userEmail ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-[11px] font-mono text-ink-4">
                      <EntityCell entityType={row.entityType} entityId={row.entityId} />
                    </td>
                    <td className="px-4 py-3 text-[11px] text-ink-3">
                      {row.afterState ? (
                        <details>
                          <summary className="cursor-pointer text-cat hover:underline">
                            Göster
                          </summary>
                          <pre className="mt-2 max-w-[280px] overflow-x-auto rounded bg-paper p-2 text-[10px] font-mono text-ink-2">
                            {JSON.stringify(row.afterState, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      </div>
    </SettingsShell>
  );
}

/**
 * Audit entity link — entityType'a göre ilgili sayfaya götürür.
 * Silinmiş entity'ler hala link verir (soft delete olabilir).
 */
function EntityCell({
  entityType,
  entityId,
}: {
  entityType: string | null;
  entityId: string | null;
}) {
  if (!entityType) return <>—</>;

  const href = (() => {
    if (!entityId) return null;
    switch (entityType) {
      case 'product':
        return `/admin/products/${entityId}/edit`;
      case 'brand':
        return `/admin/brands/${entityId}/edit`;
      case 'category':
        return `/admin/categories/${entityId}/edit`;
      case 'supplier':
        return `/admin/suppliers/${entityId}/edit`;
      case 'branch':
        return `/admin/branches/${entityId}/edit`;
      case 'stock_movement':
      case 'transfer_group':
        return `/admin/stock-movements`;
      default:
        return null;
    }
  })();

  const shortId = entityId ? entityId.slice(0, 8) : '';

  if (href) {
    return (
      <Link
        href={href as never}
        className="text-cat hover:underline"
      >
        {entityType}
        {shortId && <span className="text-[9px]"> ({shortId})</span>}
      </Link>
    );
  }

  return (
    <>
      {entityType}
      {shortId && <span className="text-[9px]"> ({shortId})</span>}
    </>
  );
}

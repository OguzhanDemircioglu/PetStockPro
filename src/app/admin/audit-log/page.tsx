import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { listAuditLogs } from '@/lib/audit/list';

const ACTION_LABELS: Record<string, { label: string; cls: string }> = {
  'product.created': { label: '🐾 Ürün eklendi', cls: 'bg-arrow-soft text-arrow-7' },
  'product.updated': { label: '✎ Ürün güncellendi', cls: 'bg-line-soft text-ink-2' },
  'product.deleted': { label: '🗑 Ürün silindi', cls: 'bg-danger-soft text-danger-7' },
  'stock.in': { label: '📥 Stok girişi', cls: 'bg-arrow-soft text-arrow-7' },
  'stock.out': { label: '📤 Stok çıkışı', cls: 'bg-cat-soft text-cart' },
  'stock.transfer': { label: '🔁 Transfer', cls: 'bg-line-soft text-ink-2' },
  'stock.stocktake': { label: '📋 Sayım', cls: 'bg-line-soft text-ink-2' },
  'stock.reversed': { label: '↶ Geri alma', cls: 'bg-cat-soft text-cart' },
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

export default async function AuditLogPage() {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const items = await listAuditLogs(session.user.companyId, db, { limit: 100 });

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12">
      <header>
        <div className="text-[11.5px] font-bold uppercase tracking-wider text-cat">
          Admin · Denetim Kayıtları
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          Audit log
        </h1>
        <p className="mt-1 text-sm text-ink-3">
          Son {items.length} aksiyon · Append-only (KVKK 5 yıl saklama)
        </p>
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-line bg-paper py-16 text-center">
          <div className="text-6xl">📜</div>
          <h2 className="mt-4 text-xl font-bold text-cart">
            Henüz audit kaydı yok
          </h2>
          <p className="mt-2 text-sm text-ink-3">
            Ürün ekleme, stok hareketi gibi aksiyonlar otomatik kayıt olur.
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
                      {row.entityType ? (
                        <>
                          {row.entityType}
                          {row.entityId && (
                            <span className="text-[9px]">
                              {' '}
                              ({row.entityId.slice(0, 8)})
                            </span>
                          )}
                        </>
                      ) : (
                        '—'
                      )}
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

      <Link
        href={'/admin' as never}
        className="text-center text-xs text-ink-4 hover:text-cart"
      >
        ← Pano&apos;ya dön
      </Link>
    </main>
  );
}

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { listSuppliers } from '@/lib/suppliers/manage';
import { ModerationQueryBanner } from '@/components/moderation/moderation-query-banner';
import { ToggleSupplierActive } from './toggle-supplier-active';

const PAYMENT_LABEL: Record<string, string> = {
  cash: '💵 Peşin',
  net_30: '📆 30 gün',
  net_60: '📆 60 gün',
  other: '➕ Diğer',
};

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    updated?: string;
    moderation?: 'flagged';
    fields?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const items = await listSuppliers(session.user.companyId, db);
  const params = await searchParams;
  const activeCount = items.filter((s) => s.isActive).length;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[13px] font-bold uppercase tracking-wider text-cat">
            Admin · Tedarikçiler
          </div>
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
            Tedarikçilerin
          </h1>
          <p className="mt-1 text-sm text-ink-3">
            {items.length} tedarikçi · {activeCount} aktif
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/admin/suppliers/export"
            download
            className="rounded-xl border border-line bg-paper px-3 py-2.5 text-xs font-bold text-cart hover:bg-cat-soft"
          >
            ⬇ CSV
          </a>
          <Link
            href={'/admin/suppliers/new' as never}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-5 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-cat)] hover:-translate-y-0.5 transition-transform"
            data-testid="add-supplier"
          >
            + Yeni Tedarikçi
          </Link>
        </div>
      </header>

      {params.created === 'success' && (
        <div className="rounded-xl border border-arrow/40 bg-arrow-soft px-4 py-3 text-sm font-bold text-arrow-7">
          ✅ Tedarikçi eklendi.
        </div>
      )}
      <ModerationQueryBanner
        moderation={params.moderation}
        fields={params.fields}
        entityLabel="Tedarikçi"
      />
      {params.updated === 'success' && (
        <div className="rounded-xl border border-arrow/40 bg-arrow-soft px-4 py-3 text-sm font-bold text-arrow-7">
          ✅ Tedarikçi güncellendi.
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-line bg-paper py-16 text-center">
          <div className="text-6xl">🏢</div>
          <h2 className="mt-4 text-xl font-bold text-cart">Henüz tedarikçi yok</h2>
          <p className="mt-2 text-sm text-ink-3">
            Stok girişi yaparken seçebilmek için tedarikçi ekle.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-paper">
          <table className="w-full text-sm">
            <thead className="bg-paper">
              <tr className="text-left text-[12px] font-bold uppercase tracking-wider text-ink-3">
                <th className="px-4 py-3">Ad</th>
                <th className="px-4 py-3">VKN</th>
                <th className="px-4 py-3">İletişim</th>
                <th className="px-4 py-3 text-right">Lead</th>
                <th className="px-4 py-3">Ödeme</th>
                <th className="px-4 py-3 text-right">Toplam giriş</th>
                <th className="px-4 py-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {items.map((s) => (
                <tr
                  key={s.id}
                  data-supplier-id={s.id}
                  className={`hover:bg-line-soft ${!s.isActive ? 'opacity-60' : ''}`}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/suppliers/${s.id}/edit` as never}
                      className="font-bold text-cart hover:underline"
                    >
                      {s.name}
                    </Link>
                    {!s.isActive && (
                      <span className="ml-2 rounded bg-line-soft px-1.5 py-0.5 text-[11.5px] font-bold text-ink-4">
                        Pasif
                      </span>
                    )}
                    {s.contactName && (
                      <div className="text-[12.5px] text-ink-3">{s.contactName}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-2">
                    {s.vatNo ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-3">
                    {s.phone && <div className="font-mono">📞 {s.phone}</div>}
                    {s.email && <div>✉ {s.email}</div>}
                    {!s.phone && !s.email && '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-ink-2">
                    {s.leadTimeDays} gün
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {PAYMENT_LABEL[s.paymentTerms] ?? s.paymentTerms}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    <strong className="text-ink">{s.totalIncomingQty}</strong>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ToggleSupplierActive
                      supplierId={s.id}
                      currentlyActive={s.isActive}
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

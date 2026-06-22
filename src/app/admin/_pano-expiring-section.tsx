/**
 * Pano deferred section — PetPro Asistanı · SKT Yaklaşan
 *
 * Tur 12 (P2-3 Suspense streaming): listExpiringSuggestions JSONB-heavy
 * query'i (expiryDate filter + per-branch ürün) pano FCP'i bekletiyordu.
 * Bu component Suspense altında stream — pano hero/KPI/alert anında
 * görünür, SKT öneri arka planda yüklenir.
 */
import Link from 'next/link';
import { withTenant } from '@/lib/db/with-tenant';
import {
  listExpiringSuggestions,
  formatExpiryLabel,
  type ExpirySeverity,
} from '@/lib/assistant/expiring-suggestions';

interface Props {
  companyId: string;
}

export async function PanoExpiringSection({ companyId }: Props) {
  const expiringSuggestions = await withTenant(companyId, (tx) =>
    listExpiringSuggestions(companyId, tx, 6),
  );
  if (expiringSuggestions.length === 0) return null;

  const toneClass: Record<ExpirySeverity, string> = {
    expired: 'text-danger-7 font-bold',
    critical: 'text-danger-7 font-bold',
    warning: 'text-cart font-bold',
  };
  const badgeClass: Record<ExpirySeverity, string> = {
    expired: 'bg-danger text-white',
    critical: 'bg-danger-soft text-danger-7',
    warning: 'bg-cat-soft text-cart',
  };
  const badgeLabel: Record<ExpirySeverity, string> = {
    expired: '🚨 GEÇTİ',
    critical: '⏱ ≤7 gün',
    warning: '⚠ ≤30 gün',
  };

  return (
    <section data-testid="petpro-expiring-suggestions">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-cat">
          🤖 PetPro Asistanı · SKT Yaklaşan
        </h2>
        <Link
          href={'/admin/stock-movements' as never}
          className="text-[12.5px] font-bold text-cat hover:underline"
        >
          Hareketleri aç →
        </Link>
      </div>
      <article className="rounded-2xl border-2 border-danger/30 bg-gradient-to-br from-danger-soft/30 to-cat-soft/20 p-4">
        <p className="mb-3 text-[12.5px] text-ink-3">
          SKT&apos;si yaklaşan (≤30 gün) veya geçmiş stok satırları — fire kaydı al veya indirimle hızlandır:
        </p>
        <ul className="divide-y divide-line-soft text-xs">
          {expiringSuggestions.map((e) => (
            <li
              key={`${e.variantId}-${e.branchId}`}
              data-expiring-suggestion={e.variantId}
              data-severity={e.severity}
              className="flex items-center gap-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-bold text-ink">
                  {e.productName}{' '}
                  {e.variantLabel && (
                    <span className="text-[11.5px] font-normal text-ink-3">
                      · {e.variantLabel}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-3">
                  <span>📍 {e.branchName}</span>
                  <span>·</span>
                  <span className="font-bold text-cart">📦 {e.stockQty} adet</span>
                  <span>·</span>
                  <span className={toneClass[e.severity]}>
                    📅 {e.expiryDate} · {formatExpiryLabel(e.daysUntilExpiry)}
                  </span>
                </div>
              </div>
              <span
                data-expiring-badge
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${badgeClass[e.severity]}`}
              >
                {badgeLabel[e.severity]}
              </span>
              <Link
                href={
                  `/admin/stock-movements?variant=${e.variantId}&branch=${e.branchId}` as never
                }
                className="rounded-lg border border-danger/40 bg-paper px-2.5 py-1.5 text-[12px] font-bold text-danger-7 hover:bg-danger hover:text-white transition-colors"
              >
                📤 Fire kaydı
              </Link>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}

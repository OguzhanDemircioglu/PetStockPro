import type { StockMovementListItem } from '@/lib/stock/list';
import { ReverseButton } from './reverse-button';

const REVERSAL_WINDOW_MS = 24 * 60 * 60 * 1000;

interface Props {
  movements: StockMovementListItem[];
  /** Server'da set edildi — render anındaki zaman (Date.now() client'ta forbidden) */
  now?: Date;
}

const TYPE_BADGES: Record<string, { label: string; classes: string }> = {
  stock_in: { label: '📥 Giriş', classes: 'bg-arrow-soft text-arrow-7' },
  stock_out: { label: '📤 Çıkış', classes: 'bg-cat-soft text-cart' },
  transfer: { label: '🔁 Transfer', classes: 'bg-line-soft text-ink-2' },
  stocktake: { label: '📋 Sayım', classes: 'bg-line-soft text-ink-2' },
  stocktake_initial: { label: '🗂 İlk Sayım', classes: 'bg-line-soft text-ink-2' },
};

const SUBTYPE_LABEL: Record<string, string> = {
  sale: 'Satış',
  waste: 'Fire',
  gift: 'Hediye',
  sample: 'Numune',
  return: 'İade',
  internal_use: 'Dahili',
  other: 'Diğer',
};

const PAYMENT_LABEL: Record<string, string> = {
  cash: '💵 Nakit',
  card: '💳 Kart',
  bank_transfer: '🏦 Havale',
  credit: '📝 Veresiye',
};

export function MovementsTable({ movements, now }: Props) {
  const nowMs = (now ?? new Date()).getTime();
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
      <table className="w-full text-sm">
        <thead className="bg-paper">
          <tr className="text-left text-[10.5px] font-bold uppercase tracking-wider text-ink-3">
            <th className="px-4 py-3">Tarih</th>
            <th className="px-4 py-3">Tür</th>
            <th className="px-4 py-3">Ürün</th>
            <th className="px-4 py-3">Şube</th>
            <th className="px-4 py-3 text-right">Önce</th>
            <th className="px-4 py-3 text-right">Δ</th>
            <th className="px-4 py-3 text-right">Sonra</th>
            <th className="px-4 py-3">Notlar</th>
            <th className="px-4 py-3 text-right">İşlem</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {movements.map((m) => {
            const badge = TYPE_BADGES[m.type] ?? {
              label: m.type,
              classes: 'bg-line-soft text-ink-2',
            };
            const subtypeLabel = m.subtype ? SUBTYPE_LABEL[m.subtype] ?? m.subtype : null;
            const reversed = !!m.reversedById;
            return (
              <tr
                key={m.id}
                className={`hover:bg-line-soft ${reversed ? 'opacity-50 line-through' : ''}`}
                data-movement-id={m.id}
              >
                <td className="px-4 py-3 text-[11px] text-ink-3 whitespace-nowrap">
                  {new Date(m.createdAt).toLocaleString('tr-TR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.classes}`}
                  >
                    {badge.label}
                  </span>
                  {subtypeLabel && (
                    <span className="ml-1.5 text-[10px] text-ink-4">
                      · {subtypeLabel}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="font-bold text-ink">{m.productName}</div>
                  <div className="text-[10.5px] text-ink-4">{m.variantLabel}</div>
                </td>
                <td className="px-4 py-3 text-ink-2">{m.branchName}</td>
                <td className="px-4 py-3 text-right font-mono text-ink-3">
                  {m.beforeQty}
                </td>
                <td
                  className={`px-4 py-3 text-right font-mono font-bold ${
                    m.quantity > 0 ? 'text-arrow-7' : 'text-danger-7'
                  }`}
                >
                  {m.quantity > 0 ? '+' : ''}
                  {m.quantity}
                </td>
                <td className="px-4 py-3 text-right font-mono font-bold text-ink">
                  {m.afterQty}
                </td>
                <td className="px-4 py-3 text-[11px] text-ink-3">
                  {m.unitPrice && (
                    <span className="mr-2">
                      <strong className="text-cart">{m.unitPrice}₺</strong>/adet
                    </span>
                  )}
                  {m.unitCost && (
                    <span className="mr-2 text-ink-4">alış {m.unitCost}₺</span>
                  )}
                  {m.supplierName && (
                    <span className="mr-2">🏢 {m.supplierName}</span>
                  )}
                  {m.customerRef && (
                    <span className="mr-2">👤 {m.customerRef}</span>
                  )}
                  {m.paymentMethod && (
                    <span className="mr-2">{PAYMENT_LABEL[m.paymentMethod]}</span>
                  )}
                  {m.documentNo && (
                    <span className="mr-2 font-mono">№ {m.documentNo}</span>
                  )}
                  {m.reason && <span className="italic">{m.reason}</span>}
                  {m.transferGroupId && (
                    <span className="ml-1 text-[10px] text-ink-4">
                      (TG:{m.transferGroupId.slice(0, 6)})
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {reversed ? (
                    <span className="text-[10px] font-bold text-ink-4">
                      ✓ Geri alındı
                    </span>
                  ) : m.reversesId ? (
                    <span
                      className="text-[10px] text-ink-4"
                      title="Bu kayıt zaten bir geri alma"
                    >
                      ↶ Geri alma
                    </span>
                  ) : (
                    <ReverseButton
                      movementId={m.id}
                      withinWindow={
                        nowMs - new Date(m.createdAt).getTime() <=
                        REVERSAL_WINDOW_MS
                      }
                      isTransfer={m.type === 'transfer'}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

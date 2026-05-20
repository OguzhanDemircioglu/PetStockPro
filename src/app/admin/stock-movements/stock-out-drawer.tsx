'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useSwalOnError } from '@/lib/ui/use-swal-on-error';
import type { BranchOption, VariantOption } from '@/lib/stock/options';
import { DrawerShell } from './drawer-shell';
import { stockOutAction, type MovementActionState } from './actions';

interface Props {
  branches: BranchOption[];
  variants: VariantOption[];
  onClose: () => void;
}

const SUBTYPE_OPTIONS = [
  { value: 'sale', label: '💰 Satış', priceField: true, customerField: true },
  { value: 'waste', label: '🗑 Fire', priceField: false, customerField: false },
  { value: 'gift', label: '🎁 Hediye', priceField: false, customerField: true },
  { value: 'sample', label: '🧪 Numune', priceField: false, customerField: true },
  { value: 'return', label: '↩ İade', priceField: true, customerField: true },
  { value: 'internal_use', label: '🏪 Dahili Kullanım', priceField: false, customerField: false },
  { value: 'other', label: '➕ Diğer', priceField: false, customerField: false },
] as const;

export function StockOutDrawer({ branches, variants, onClose }: Props) {
  const [state, formAction, pending] = useActionState<
    MovementActionState | null,
    FormData
  >(stockOutAction, null);

  const errorState = useMemo(() => {
    if (!state || state.ok || !state.message) return null;
    const detail: string[] = [];
    if (state.meta?.available !== undefined) {
      detail.push(
        `Mevcut: ${state.meta.available}, istenen: ${state.meta.requested}`,
      );
    }
    return {
      error: state.message,
      issues: [...detail, ...state.issues],
    };
  }, [state]);
  useSwalOnError(errorState);

  // Field-level kızartma — submit sonrası hata varsa zorunlu alanlar (branchId,
  // variantId, subtype, quantity, conditional customerRef) aria-invalid alır.
  const hasError = !!errorState;

  const [subtype, setSubtype] = useState<string>('sale');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');

  useEffect(() => {
    if (state?.ok) {
      const t = setTimeout(onClose, 800);
      return () => clearTimeout(t);
    }
  }, [state, onClose]);

  const cfg = SUBTYPE_OPTIONS.find((o) => o.value === subtype);
  const requiresCustomerForCredit = subtype === 'sale' && paymentMethod === 'credit';

  return (
    <DrawerShell
      title="📤 Çıkış / Satış"
      subtitle="Satış, fire, hediye, numune veya iade kaydı"
      onClose={onClose}
      testid="stock-out-drawer"
    >
      <form action={formAction} className="flex flex-col gap-4">
        <Field label="Şube *" htmlFor="branchId">
          <select
            id="branchId"
            name="branchId"
            required
            defaultValue={branches[0]?.id ?? ''}
            aria-invalid={hasError || undefined}
            className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Ürün / Variant *" htmlFor="variantId">
          <select
            id="variantId"
            name="variantId"
            required
            defaultValue=""
            aria-invalid={hasError || undefined}
            className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          >
            <option value="" disabled>
              — Seç —
            </option>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.productName} · {v.variantLabel} ({v.sku}) — {v.defaultSalePrice}₺
              </option>
            ))}
          </select>
        </Field>

        <Field label="Çıkış türü *" htmlFor="subtype">
          <select
            id="subtype"
            name="subtype"
            required
            value={subtype}
            onChange={(e) => setSubtype(e.target.value)}
            aria-invalid={hasError || undefined}
            className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          >
            {SUBTYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Miktar *" htmlFor="quantity">
            <input
              id="quantity"
              name="quantity"
              type="number"
              min={1}
              max={1000000}
              required
              aria-invalid={hasError || undefined}
              data-testid="quantity"
              className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 font-mono text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
            />
          </Field>
          {cfg?.priceField && (
            <Field label="Birim Satış (₺)" htmlFor="unitPrice">
              <input
                id="unitPrice"
                name="unitPrice"
                type="text"
                inputMode="decimal"
                pattern="^\d+(\.\d{1,2})?$"
                placeholder="180.50"
                className="w-full rounded-xl border-[1.5px] border-cat bg-paper px-4 py-3 font-mono text-sm font-bold text-cart focus:outline-none focus:ring-4 focus:ring-cat/15"
              />
            </Field>
          )}
        </div>

        {subtype === 'sale' && (
          <Field label="Ödeme yöntemi" htmlFor="paymentMethod">
            <select
              id="paymentMethod"
              name="paymentMethod"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
            >
              <option value="cash">💵 Nakit</option>
              <option value="card">💳 Kart</option>
              <option value="bank_transfer">🏦 Havale/EFT</option>
              <option value="credit">📝 Veresiye</option>
            </select>
          </Field>
        )}

        {cfg?.customerField && (
          <Field
            label={`${requiresCustomerForCredit ? 'Müşteri *' : 'Müşteri / Alıcı'}`}
            htmlFor="customerRef"
          >
            <input
              id="customerRef"
              name="customerRef"
              type="text"
              maxLength={100}
              required={requiresCustomerForCredit}
              placeholder="Ad veya telefon"
              aria-invalid={(requiresCustomerForCredit && hasError) || undefined}
              className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
            />
            {requiresCustomerForCredit && (
              <p className="mt-1 text-[12.5px] text-cat">
                ⚠ Veresiye satışta müşteri zorunlu
              </p>
            )}
          </Field>
        )}

        {(subtype === 'waste' || subtype === 'other') && (
          <Field label="Sebep" htmlFor="reason">
            <input
              id="reason"
              name="reason"
              type="text"
              maxLength={500}
              placeholder="SKT geçti, kırıldı, ..."
              className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
            />
          </Field>
        )}

        <Field label="Not" htmlFor="note">
          <textarea
            id="note"
            name="note"
            rows={2}
            maxLength={500}
            className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          />
        </Field>

        {state?.ok && state.message && (
          <p
            role="status"
            className="rounded-lg bg-arrow-soft px-3 py-2 text-sm font-bold text-arrow-7"
            data-testid="stock-out-alert"
          >
            ✓ {state.message}
            {state.meta?.afterQty !== undefined && (
              <span className="ml-2 font-mono text-[12.5px]">
                kalan: {state.meta.afterQty}
              </span>
            )}
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={pending}
            data-testid="submit-stock-out"
            className="flex-1 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-6 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-60"
          >
            {pending ? 'Kaydediliyor...' : 'Çıkışı Kaydet'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-line bg-paper px-5 py-3 text-sm font-bold text-ink-3 hover:bg-line-soft"
          >
            Vazgeç
          </button>
        </div>
      </form>
    </DrawerShell>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

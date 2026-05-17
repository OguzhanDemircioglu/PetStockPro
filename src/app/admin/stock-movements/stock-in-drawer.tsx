'use client';

import { useActionState, useEffect } from 'react';
import type {
  BranchOption,
  VariantOption,
  SupplierOption,
} from '@/lib/stock/options';
import { DrawerShell } from './drawer-shell';
import { stockInAction, type MovementActionState } from './actions';

interface Props {
  branches: BranchOption[];
  variants: VariantOption[];
  suppliers: SupplierOption[];
  onClose: () => void;
}

export function StockInDrawer({ branches, variants, suppliers, onClose }: Props) {
  const [state, formAction, pending] = useActionState<
    MovementActionState | null,
    FormData
  >(stockInAction, null);

  useEffect(() => {
    if (state?.ok) {
      const t = setTimeout(onClose, 800);
      return () => clearTimeout(t);
    }
  }, [state, onClose]);

  return (
    <DrawerShell
      title="📥 Stok Girişi"
      subtitle="Tedarikçiden gelen ürünü stoğa al"
      onClose={onClose}
      testid="stock-in-drawer"
    >
      <form action={formAction} className="flex flex-col gap-4">
        <Field label="Şube *" htmlFor="branchId">
          <select
            id="branchId"
            name="branchId"
            required
            defaultValue={branches[0]?.id ?? ''}
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
            className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          >
            <option value="" disabled>
              — Seç —
            </option>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.productName} · {v.variantLabel} ({v.sku})
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
              className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 font-mono text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
              data-testid="quantity"
            />
          </Field>
          <Field label="Birim Alış (₺)" htmlFor="unitCost">
            <input
              id="unitCost"
              name="unitCost"
              type="text"
              inputMode="decimal"
              pattern="^\d+(\.\d{1,2})?$"
              placeholder="120.50"
              className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 font-mono text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
            />
          </Field>
        </div>

        <Field
          label={`Tedarikçi ${suppliers.length === 0 ? '(henüz yok)' : ''}`}
          htmlFor="supplierId"
        >
          <select
            id="supplierId"
            name="supplierId"
            disabled={suppliers.length === 0}
            defaultValue=""
            className="w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15 disabled:opacity-50"
          >
            <option value="">— Seçilmedi —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Belge no" htmlFor="documentNo">
            <input
              id="documentNo"
              name="documentNo"
              type="text"
              maxLength={100}
              placeholder="İrsaliye no"
              className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 font-mono text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
            />
          </Field>
          <Field label="Lot no" htmlFor="lotNumber">
            <input
              id="lotNumber"
              name="lotNumber"
              type="text"
              maxLength={100}
              className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 font-mono text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
            />
          </Field>
        </div>

        <Field label="SKT (YYYY-AA-GG)" htmlFor="expiryDate">
          <input
            id="expiryDate"
            name="expiryDate"
            type="date"
            className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 font-mono text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          />
        </Field>

        <Field label="Not" htmlFor="note">
          <textarea
            id="note"
            name="note"
            rows={2}
            maxLength={500}
            className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          />
        </Field>

        {state?.message && (
          <p
            role="alert"
            className={`rounded-lg px-3 py-2 text-sm font-bold ${
              state.ok
                ? 'bg-arrow-soft text-arrow-7'
                : 'bg-danger-soft text-danger-7'
            }`}
            data-testid="stock-in-alert"
          >
            {state.ok ? '✓' : '✕'} {state.message}
            {state.ok && state.meta?.afterQty !== undefined && (
              <span className="ml-2 font-mono text-[12.5px]">
                yeni stok: {state.meta.afterQty}
              </span>
            )}
            {state.issues.length > 0 && (
              <ul className="mt-1 list-inside list-disc text-[12.5px] font-normal">
                {state.issues.map((i, k) => (
                  <li key={k}>{i}</li>
                ))}
              </ul>
            )}
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={pending}
            data-testid="submit-stock-in"
            className="flex-1 rounded-xl bg-gradient-to-br from-arrow to-arrow-2 px-6 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-60"
          >
            {pending ? 'Kaydediliyor...' : 'Stok Girişini Kaydet'}
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

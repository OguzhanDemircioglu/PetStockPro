'use client';

import { useActionState, useEffect, useMemo } from 'react';
import { useSwalOnError } from '@/lib/ui/use-swal-on-error';
import type { BranchOption, VariantOption } from '@/lib/stock/options';
import { DrawerShell } from './drawer-shell';
import { stocktakeAction, type MovementActionState } from './actions';

interface Props {
  branches: BranchOption[];
  variants: VariantOption[];
  onClose: () => void;
}

export function StocktakeDrawer({ branches, variants, onClose }: Props) {
  const [state, formAction, pending] = useActionState<
    MovementActionState | null,
    FormData
  >(stocktakeAction, null);

  const errorState = useMemo(
    () =>
      state && !state.ok && state.message
        ? { error: state.message, issues: state.issues }
        : null,
    [state],
  );
  useSwalOnError(errorState);

  useEffect(() => {
    if (state?.ok) {
      const t = setTimeout(onClose, 1200);
      return () => clearTimeout(t);
    }
  }, [state, onClose]);

  return (
    <DrawerShell
      title="📋 Sayım Düzeltme"
      subtitle="Sayımda bulduğun miktarı gir — sistem otomatik farkı kaydeder"
      onClose={onClose}
      testid="stocktake-drawer"
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

        <Field label="Sayımda bulunan miktar *" htmlFor="countedQty">
          <input
            id="countedQty"
            name="countedQty"
            type="number"
            min={0}
            max={1000000}
            required
            data-testid="countedQty"
            className="w-full rounded-xl border-[1.5px] border-cat bg-paper px-4 py-3 font-mono text-lg font-bold text-cart focus:outline-none focus:ring-4 focus:ring-cat/15"
          />
          <p className="mt-1 text-[12.5px] text-ink-3">
            0 yazarsan stok sıfırlanır. Sistemdeki değerle aynıysa kayıt yapılmaz.
          </p>
        </Field>

        <Field label="Sayım sebebi" htmlFor="reason">
          <input
            id="reason"
            name="reason"
            type="text"
            maxLength={500}
            placeholder="Aylık sayım, anlık kontrol, ..."
            className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
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

        {state?.ok && state.message && (
          <p
            role="status"
            className="rounded-lg bg-arrow-soft px-3 py-2 text-sm font-bold text-arrow-7"
            data-testid="stocktake-alert"
          >
            ✓ {state.message}
            {state.meta?.delta !== undefined && (
              <span className="ml-2 font-mono text-[12.5px]">
                Δ {state.meta.delta > 0 ? '+' : ''}
                {state.meta.delta} → yeni stok {state.meta.afterQty}
              </span>
            )}
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={pending}
            data-testid="submit-stocktake"
            className="flex-1 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-6 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-60"
          >
            {pending ? 'Kaydediliyor...' : 'Sayımı Kaydet'}
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

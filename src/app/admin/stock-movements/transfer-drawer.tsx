'use client';

import { useActionState, useEffect } from 'react';
import type { BranchOption, VariantOption } from '@/lib/stock/options';
import { DrawerShell } from './drawer-shell';
import { transferAction, type MovementActionState } from './actions';

interface Props {
  branches: BranchOption[];
  variants: VariantOption[];
  onClose: () => void;
  initial?: {
    sourceBranchId?: string;
    targetBranchId?: string;
    variantId?: string;
    quantity?: number;
  };
}

export function TransferDrawer({ branches, variants, onClose, initial }: Props) {
  const [state, formAction, pending] = useActionState<
    MovementActionState | null,
    FormData
  >(transferAction, null);

  useEffect(() => {
    if (state?.ok) {
      const t = setTimeout(onClose, 1200);
      return () => clearTimeout(t);
    }
  }, [state, onClose]);

  return (
    <DrawerShell
      title="🔁 Şubeler arası transfer"
      subtitle="Kaynak şubeden hedef şubeye stok aktar"
      onClose={onClose}
      testid="transfer-drawer"
    >
      <form action={formAction} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kaynak şube *" htmlFor="sourceBranchId">
            <select
              id="sourceBranchId"
              name="sourceBranchId"
              required
              defaultValue={initial?.sourceBranchId ?? ''}
              className="w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
            >
              <option value="" disabled>
                — Seç —
              </option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Hedef şube *" htmlFor="targetBranchId">
            <select
              id="targetBranchId"
              name="targetBranchId"
              required
              defaultValue={initial?.targetBranchId ?? ''}
              className="w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
            >
              <option value="" disabled>
                — Seç —
              </option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Ürün / Variant *" htmlFor="variantId">
          <select
            id="variantId"
            name="variantId"
            required
            defaultValue={initial?.variantId ?? ''}
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

        <Field label="Miktar *" htmlFor="quantity">
          <input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            max={1000000}
            required
            defaultValue={initial?.quantity ?? ''}
            data-testid="quantity"
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
            data-testid="transfer-alert"
          >
            {state.ok ? '✓' : '✕'} {state.message}
            {state.meta?.available !== undefined && (
              <span className="ml-2 font-mono text-[12.5px]">
                (mevcut: {state.meta.available}, istenen: {state.meta.requested})
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
            data-testid="submit-transfer"
            className="flex-1 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-6 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-60"
          >
            {pending ? 'Aktarılıyor...' : 'Transferi Kaydet'}
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

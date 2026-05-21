'use client';

import { useActionState, useEffect, useMemo } from 'react';
import { useSwalOnError } from '@/lib/ui/use-swal-on-error';
import type { BranchOption, VariantOption } from '@/lib/stock/options';
import { PetSpinner } from '@/components/ui/pet-spinner';
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

  // Field-level kızartma — submit sonrası hata varsa zorunlu alanlar
  // (sourceBranchId, targetBranchId, variantId, quantity) aria-invalid alır.
  const hasError = !!errorState;

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
              aria-invalid={hasError || undefined}
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
              aria-invalid={hasError || undefined}
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
            aria-invalid={hasError || undefined}
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
            aria-invalid={hasError || undefined}
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

        {state?.ok && state.message && (
          <p
            role="status"
            className="rounded-lg bg-arrow-soft px-3 py-2 text-sm font-bold text-arrow-7"
            data-testid="transfer-alert"
          >
            ✓ {state.message}
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={pending}
            data-testid="submit-transfer"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-6 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-60"
          >
            {pending ? (
              <>
                <PetSpinner size="sm" inline tone="cat" label="Aktarılıyor" />
                Aktarılıyor…
              </>
            ) : (
              'Transferi Kaydet'
            )}
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

'use client';

import { useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { BranchOption, VariantOption } from '@/lib/stock/options';

interface Initial {
  branch: string;
  variant: string;
  type: string;
}

interface Props {
  branches: BranchOption[];
  variants: VariantOption[];
  initial: Initial;
}

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Tüm türler' },
  { value: 'stock_in', label: '📥 Stok girişi' },
  { value: 'stock_out', label: '📤 Stok çıkışı' },
  { value: 'transfer', label: '🔁 Transfer' },
  { value: 'stocktake', label: '📋 Sayım' },
];

export function MovementsFilterBar({ branches, variants, initial }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const apply = (override: Partial<Initial>) => {
    const next = new URLSearchParams(params?.toString() ?? '');
    const merged = { ...initial, ...override };

    if (merged.branch) next.set('branch', merged.branch);
    else next.delete('branch');
    if (merged.variant) next.set('variant', merged.variant);
    else next.delete('variant');
    if (merged.type) next.set('type', merged.type);
    else next.delete('type');

    const qs = next.toString();
    startTransition(() => {
      router.push(
        (qs.length > 0
          ? `/admin/stock-movements?${qs}`
          : '/admin/stock-movements') as never,
      );
    });
  };

  const activeCount = [initial.branch, initial.variant, initial.type].filter(
    Boolean,
  ).length;

  return (
    <section
      className="rounded-2xl border border-line bg-white p-4"
      data-testid="movements-filter-bar"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <label
            htmlFor="mv-branch"
            className="mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-ink-3"
          >
            Şube
          </label>
          <select
            id="mv-branch"
            value={initial.branch}
            onChange={(e) => apply({ branch: e.target.value })}
            disabled={pending}
            data-testid="mv-branch"
            className="w-full rounded-xl border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          >
            <option value="">Tüm şubeler</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[260px] flex-1">
          <label
            htmlFor="mv-variant"
            className="mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-ink-3"
          >
            Ürün/Variant
          </label>
          <select
            id="mv-variant"
            value={initial.variant}
            onChange={(e) => apply({ variant: e.target.value })}
            disabled={pending}
            data-testid="mv-variant"
            className="w-full rounded-xl border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          >
            <option value="">Tüm variantlar</option>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.productName} · {v.variantLabel} ({v.sku})
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[170px]">
          <label
            htmlFor="mv-type"
            className="mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-ink-3"
          >
            Tür
          </label>
          <select
            id="mv-type"
            value={initial.type}
            onChange={(e) => apply({ type: e.target.value })}
            disabled={pending}
            data-testid="mv-type"
            className="w-full rounded-xl border-[1.5px] border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => apply({ branch: '', variant: '', type: '' })}
            disabled={pending}
            data-testid="mv-filter-clear"
            className="rounded-xl border border-line bg-white px-3 py-2.5 text-xs font-bold text-ink-3 hover:bg-line-soft disabled:opacity-50"
          >
            × Temizle ({activeCount})
          </button>
        )}
        <a
          href={`/admin/stock-movements/export${
            activeCount > 0
              ? `?${new URLSearchParams({
                  ...(initial.branch ? { branch: initial.branch } : {}),
                  ...(initial.variant ? { variant: initial.variant } : {}),
                  ...(initial.type ? { type: initial.type } : {}),
                }).toString()}`
              : ''
          }`}
          download
          data-testid="mv-export"
          className="ml-auto rounded-xl border border-line bg-white px-3 py-2.5 text-xs font-bold text-cart hover:bg-cat-soft"
        >
          ⬇ CSV
        </a>
      </div>
    </section>
  );
}

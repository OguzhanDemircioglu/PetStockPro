'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { useSwalOnError } from '@/lib/ui/use-swal-on-error';
import { negativeStockAction, type NegativeStockState } from './actions';

export function NegativeStockForm() {
  const [state, formAction, pending] = useActionState<NegativeStockState | null, FormData>(
    negativeStockAction,
    null,
  );
  useSwalOnError(state);
  const hasError = !!state?.error;

  if (state?.ok) {
    return (
      <div className="rounded-2xl border border-arrow/40 bg-arrow-soft p-6">
        <h2 className="text-xl font-bold text-arrow-7">✓ Negatif stok hareketi yazıldı</h2>
        <p className="mt-2 font-mono text-sm leading-relaxed text-ink-2">
          Önce: <strong>{state.beforeQty}</strong> → Sonra: <strong>{state.afterQty}</strong>
        </p>
        <div className="mt-4 flex gap-2">
          <Link href={'/admin/stock-movements' as never} className="rounded-xl bg-cat px-4 py-2 text-xs font-bold text-white">
            Ledger
          </Link>
          <Link href={'/admin/audit-log' as never} className="rounded-xl border border-line bg-paper px-4 py-2 text-xs font-bold text-ink-2">
            Audit log
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl border border-line bg-paper p-6">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="branchId" className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3">
            Şube UUID *
          </label>
          <input
            id="branchId"
            name="branchId"
            type="text"
            required
            disabled={pending}
            data-testid="branch-id"
            aria-invalid={hasError || undefined}
            className="w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-2 font-mono text-[12.5px] focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          />
        </div>
        <div>
          <label htmlFor="quantity" className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3">
            Düşür (adet) *
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            max={1000000}
            required
            disabled={pending}
            data-testid="quantity"
            aria-invalid={hasError || undefined}
            className="w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-2 text-right font-mono text-sm focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          />
        </div>
      </div>
      <div>
        <label htmlFor="variantId" className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3">
          Variant UUID *
        </label>
        <input
          id="variantId"
          name="variantId"
          type="text"
          required
          disabled={pending}
          data-testid="variant-id"
          aria-invalid={hasError || undefined}
          className="w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-2 font-mono text-[12.5px] focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
        />
        <p className="mt-1 text-[12px] text-ink-4">
          Ürün detay sayfasından variant.id&apos;yi kopyala. Quantity adet kadar branch_inventory
          satırı azaltılır (negatif olabilir).
        </p>
      </div>

      <div>
        <label htmlFor="reason" className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3">
          Zorunlu sebep * (min 10 karakter)
        </label>
        <textarea
          id="reason"
          name="reason"
          required
          minLength={10}
          maxLength={500}
          rows={3}
          placeholder="Örn: Muhasebe kaydında 5 adet satış ama sistemde yok, fiziksel stok kontrol edildi düzeltiliyor"
          disabled={pending}
          data-testid="reason"
          aria-invalid={hasError || undefined}
          className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-sm focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
        />
      </div>

      <div>
        <label htmlFor="superadminPassword" className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3">
          Süperadmin şifren * (re-auth)
        </label>
        <input
          id="superadminPassword"
          name="superadminPassword"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          disabled={pending}
          data-testid="superadmin-password"
          aria-invalid={hasError || undefined}
          className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-2.5 text-sm focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        data-testid="submit"
        className="rounded-xl bg-gradient-to-br from-danger to-danger-2 px-5 py-3 text-sm font-bold text-white shadow-lg hover:-translate-y-0.5 transition-transform disabled:opacity-60"
      >
        {pending ? '⏳ İşleniyor...' : '🚨 Bypass — eksi stok yaz'}
      </button>
    </form>
  );
}

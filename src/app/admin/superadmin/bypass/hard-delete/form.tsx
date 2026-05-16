'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { hardDeleteAction, type HardDeleteState } from './actions';

export function HardDeleteForm() {
  const [state, formAction, pending] = useActionState<HardDeleteState | null, FormData>(
    hardDeleteAction,
    null,
  );

  if (state?.ok) {
    return (
      <div className="rounded-2xl border border-arrow/40 bg-arrow-soft p-6">
        <h2 className="text-xl font-bold text-arrow-7">✓ Ürün hard delete edildi</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          <strong>{state.productName}</strong> DB&apos;den kaldırıldı. Variantlar/görseller/inventory
          cascade silindi. Audit log&apos;da kayıtlı.
        </p>
        <div className="mt-4 flex gap-2">
          <Link href={'/admin/products' as never} className="rounded-xl bg-cat px-4 py-2 text-xs font-bold text-white">
            Ürünler
          </Link>
          <Link href={'/admin/audit-log' as never} className="rounded-xl border border-line bg-white px-4 py-2 text-xs font-bold text-ink-2">
            Audit log
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6">
      <div>
        <label htmlFor="productId" className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-ink-3">
          Ürün UUID *
        </label>
        <input
          id="productId"
          name="productId"
          type="text"
          required
          placeholder="00000000-0000-0000-0000-000000000000"
          disabled={pending}
          data-testid="product-id"
          className="w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-2.5 font-mono text-sm focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
        />
        <p className="mt-1 text-[10.5px] text-ink-4">
          Ürün listesinden soft-deleted ürünün ID&apos;sini al (products.deletedAt set olmalı).
        </p>
      </div>

      <div>
        <label htmlFor="reason" className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-ink-3">
          Zorunlu sebep * (min 10 karakter)
        </label>
        <textarea
          id="reason"
          name="reason"
          required
          minLength={10}
          maxLength={500}
          rows={3}
          placeholder="Örn: Test ürünü yanlış kaydedildi, tamamen kaldırılması gerek"
          disabled={pending}
          data-testid="reason"
          className="w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-3 text-sm focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
        />
      </div>

      <div>
        <label htmlFor="superadminPassword" className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-ink-3">
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
          className="w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-2.5 text-sm focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
        />
      </div>

      {state?.error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-bold text-danger-7"
        >
          ✕ {state.error}
          {state.issues && state.issues.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-[11px] font-normal">
              {state.issues.map((i, idx) => (
                <li key={idx}>{i}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        data-testid="submit"
        className="rounded-xl bg-gradient-to-br from-danger to-danger-2 px-5 py-3 text-sm font-bold text-white shadow-lg hover:-translate-y-0.5 transition-transform disabled:opacity-60"
      >
        {pending ? '⏳ Siliniyor...' : '🚨 Bypass — ürünü kalıcı sil'}
      </button>
    </form>
  );
}

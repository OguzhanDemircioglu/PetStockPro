'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { stocktakeUndoAction, type StocktakeUndoState } from './actions';

export function StocktakeUndoForm() {
  const [state, formAction, pending] = useActionState<StocktakeUndoState | null, FormData>(
    stocktakeUndoAction,
    null,
  );

  if (state?.ok) {
    return (
      <div className="rounded-2xl border border-arrow/40 bg-arrow-soft p-6">
        <h2 className="text-xl font-bold text-arrow-7">✓ Sayım rollback uygulandı</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Sayım <code className="text-[12.5px]">{state.stocktakeId?.slice(0, 8)}…</code>{' '}
          status&apos;u <strong>cancelled</strong> olarak güncellendi.
        </p>
        <p className="mt-2 text-sm text-ink-2">
          <strong>{state.movementsReversed}</strong> / {state.movementsTotal} stok hareketi
          başarıyla geri alındı.
        </p>
        {state.movementsReversed !== state.movementsTotal && (
          <p className="mt-2 text-[13px] text-danger-7">
            ⚠ {(state.movementsTotal ?? 0) - (state.movementsReversed ?? 0)} hareket reverse
            edilemedi (zaten reversed veya yetersiz stok). Audit log&apos;dan detaylara bak.
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <Link
            href={`/admin/stocktake/${state.stocktakeId}` as never}
            className="rounded-xl bg-cat px-4 py-2 text-xs font-bold text-white"
          >
            Sayım detayı
          </Link>
          <Link
            href={'/admin/stock-movements' as never}
            className="rounded-xl border border-line bg-paper px-4 py-2 text-xs font-bold text-ink-2"
          >
            Ledger
          </Link>
          <Link
            href={'/admin/audit-log' as never}
            className="rounded-xl border border-line bg-paper px-4 py-2 text-xs font-bold text-ink-2"
          >
            Audit log
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl border border-line bg-paper p-6">
      <div>
        <label htmlFor="stocktakeId" className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3">
          Sayım UUID *
        </label>
        <input
          id="stocktakeId"
          name="stocktakeId"
          type="text"
          required
          disabled={pending}
          data-testid="stocktake-id"
          className="w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-2 font-mono text-[12.5px] focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
        />
        <p className="mt-1 text-[12px] text-ink-4">
          <code>/admin/stocktake</code> sayfasından completed sayımın URL son
          parçasını kopyala.
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
          placeholder="Örn: Yanlış şubede sayım yapıldı — kayıtlar geri alınıyor, doğru şubede tekrar sayılacak"
          disabled={pending}
          data-testid="reason"
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
          className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-2.5 text-sm focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
        />
      </div>

      {state?.error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-bold text-danger-7"
        >
          ✕ {state.error}
          {state.issues && state.issues.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-[12.5px] font-normal">
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
        {pending ? '⏳ İşleniyor...' : '🔄 Sayım rollback uygula'}
      </button>
    </form>
  );
}

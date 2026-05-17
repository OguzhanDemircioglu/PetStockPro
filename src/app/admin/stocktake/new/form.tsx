'use client';

import { useActionState } from 'react';
import { startStocktakeAction, type StartStocktakeState } from './actions';

interface Props {
  branches: { id: string; name: string }[];
}

export function StartStocktakeForm({ branches }: Props) {
  const [state, formAction, pending] = useActionState<StartStocktakeState | null, FormData>(
    startStocktakeAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl border border-line bg-paper p-6">
      <div>
        <label
          htmlFor="branchId"
          className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-ink-3"
        >
          Şube *
        </label>
        <select
          id="branchId"
          name="branchId"
          required
          disabled={pending}
          className="w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-2.5 text-sm focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
        >
          <option value="" disabled>
            — şube seç —
          </option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <span className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-ink-3">
          Sayım modu
        </span>
        <div className="rounded-xl bg-paper px-4 py-3 text-xs text-ink-3">
          <strong className="text-cart">📋 Tam</strong> · Şubedeki tüm aktif variant&apos;lar
          snapshot alınır.
          <br />
          <span className="text-[10.5px] text-ink-4">
            Kategori + manuel mod Faz 2&apos;de eklenecek.
          </span>
        </div>
      </div>

      <div>
        <label
          htmlFor="note"
          className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-ink-3"
        >
          Not (opsiyonel)
        </label>
        <input
          id="note"
          name="note"
          type="text"
          placeholder="Aylık sayım"
          maxLength={500}
          disabled={pending}
          className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-2.5 text-sm focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
        />
      </div>

      {state?.error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-bold text-danger-7"
        >
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-gradient-to-br from-cat to-cat-2 px-5 py-3 text-sm font-bold text-white shadow-[var(--shadow-cat)] hover:-translate-y-0.5 transition-transform disabled:opacity-60"
      >
        {pending ? 'Başlatılıyor...' : 'Sayımı Başlat →'}
      </button>
    </form>
  );
}

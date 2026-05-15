'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import type { BrandActionState } from './actions';

interface Initial {
  name?: string;
  logoUrl?: string | null;
}

interface Props {
  action: (
    prev: BrandActionState | null,
    formData: FormData,
  ) => Promise<BrandActionState>;
  initial?: Initial;
  submitLabel: string;
}

export function BrandForm({ action, initial, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState<
    BrandActionState | null,
    FormData
  >(action, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label
          htmlFor="name"
          className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-ink-3"
        >
          Marka adı *
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          minLength={1}
          maxLength={100}
          defaultValue={initial?.name ?? ''}
          placeholder="Royal Canin, Hill's, Catit ..."
          data-testid="brand-name"
          className="w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
        />
      </div>

      <div>
        <label
          htmlFor="logoUrl"
          className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-ink-3"
        >
          Logo URL (opsiyonel)
        </label>
        <input
          id="logoUrl"
          name="logoUrl"
          type="url"
          maxLength={500}
          defaultValue={initial?.logoUrl ?? ''}
          placeholder="https://..."
          className="w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
        />
        <p className="mt-1 text-[11px] text-ink-4">
          Image upload Sprint 3.3 sonrası. Şimdilik tam URL.
        </p>
      </div>

      {state?.message && (
        <div
          role="alert"
          className={`rounded-lg px-3 py-2 text-sm font-bold ${
            state.ok ? 'bg-arrow-soft text-arrow-7' : 'bg-danger-soft text-danger-7'
          }`}
          data-testid="brand-alert"
        >
          <p>{state.ok ? '✓' : '✕'} {state.message}</p>
          {state.issues.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-[11px] font-normal">
              {state.issues.map((i, k) => (
                <li key={k}>{i}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          data-testid="brand-submit"
          className="flex-1 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-6 py-3 text-sm font-bold text-white shadow-[var(--shadow-cat)] disabled:opacity-60"
        >
          {pending ? 'Kaydediliyor...' : submitLabel}
        </button>
        <Link
          href={'/admin/brands' as never}
          className="rounded-xl border border-line bg-white px-6 py-3 text-sm font-bold text-ink-3 hover:bg-line-soft"
        >
          Vazgeç
        </Link>
      </div>
    </form>
  );
}

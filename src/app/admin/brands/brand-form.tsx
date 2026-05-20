'use client';

import { useActionState, useMemo } from 'react';
import Link from 'next/link';
import { useSwalOnError } from '@/lib/ui/use-swal-on-error';
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
  const errorState = useMemo(
    () =>
      state && !state.ok && state.message
        ? { error: state.message, issues: state.issues }
        : null,
    [state],
  );
  useSwalOnError(errorState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label
          htmlFor="name"
          className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
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
          className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
        />
      </div>

      <div>
        <label
          htmlFor="logoUrl"
          className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
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
          className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
        />
        <p className="mt-1 text-[12.5px] text-ink-4">
          Image upload Sprint 3.3 sonrası. Şimdilik tam URL.
        </p>
      </div>

      {state?.ok && state.message && (
        <div
          role="status"
          className="rounded-lg bg-arrow-soft px-3 py-2 text-sm font-bold text-arrow-7"
          data-testid="brand-alert"
        >
          <p>✓ {state.message}</p>
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
          className="rounded-xl border border-line bg-paper px-6 py-3 text-sm font-bold text-ink-3 hover:bg-line-soft"
        >
          Vazgeç
        </Link>
      </div>
    </form>
  );
}

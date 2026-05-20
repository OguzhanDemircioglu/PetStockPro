'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { useSwalOnError } from '@/lib/ui/use-swal-on-error';
import { reverseExpiredAction, type ReverseExpiredState } from './actions';

export function ReverseExpiredForm() {
  const [state, formAction, pending] = useActionState<ReverseExpiredState | null, FormData>(
    reverseExpiredAction,
    null,
  );
  useSwalOnError(state);

  if (state?.ok) {
    return (
      <div className="rounded-2xl border border-arrow/40 bg-arrow-soft p-6">
        <h2 className="text-xl font-bold text-arrow-7">✓ Hareket geri alındı</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Orijinal: <code className="font-mono text-[12.5px]">{state.movementId?.slice(0, 8)}…</code>
          <br />
          Reversal: <code className="font-mono text-[12.5px]">{state.reversalMovementId?.slice(0, 8)}…</code>
        </p>
        <div className="mt-4 flex gap-2">
          <Link
            href={'/admin/stock-movements' as never}
            className="rounded-xl bg-cat px-4 py-2 text-xs font-bold text-white"
          >
            Ledger&apos;a git
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
        <label
          htmlFor="movementId"
          className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
        >
          Hareket UUID *
        </label>
        <input
          id="movementId"
          name="movementId"
          type="text"
          required
          placeholder="00000000-0000-0000-0000-000000000000"
          disabled={pending}
          data-testid="movement-id"
          className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-2.5 font-mono text-sm focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
        />
        <p className="mt-1 text-[12px] text-ink-4">
          Stok hareketleri ledger&apos;daki hareketin UUID&apos;sini kopyala.
        </p>
      </div>

      <div>
        <label
          htmlFor="reason"
          className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
        >
          Zorunlu sebep * (min 10 karakter)
        </label>
        <textarea
          id="reason"
          name="reason"
          required
          minLength={10}
          maxLength={500}
          rows={3}
          placeholder="Örn: Kullanıcı 26 saat sonra fark etti, müşteri iade talebi, ürün hasarlı çıktı"
          disabled={pending}
          data-testid="reason"
          className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-sm focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
        />
      </div>

      <div>
        <label
          htmlFor="superadminPassword"
          className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
        >
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

      <button
        type="submit"
        disabled={pending}
        data-testid="submit"
        className="rounded-xl bg-gradient-to-br from-danger to-danger-2 px-5 py-3 text-sm font-bold text-white shadow-lg hover:-translate-y-0.5 transition-transform disabled:opacity-60"
      >
        {pending ? '⏳ Geri alınıyor...' : '🚨 Bypass — hareket geri al'}
      </button>
    </form>
  );
}

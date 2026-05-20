'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { useSwalOnError } from '@/lib/ui/use-swal-on-error';
import { resetPasswordAction, type ResetPasswordState } from './actions';

interface ResetFormProps {
  token: string;
  email: string;
}

/**
 * Reset Password Form — client component
 *
 * Server component (page.tsx) token validity'i doğruladıktan sonra render edilir.
 * Form submit edilince action çalışır + DB update + Brevo email + /login redirect.
 */
export function ResetForm({ token, email }: ResetFormProps) {
  const [state, formAction, pending] = useActionState<ResetPasswordState | null, FormData>(
    resetPasswordAction,
    null,
  );
  useSwalOnError(state);
  // Field-level kızartma — error varsa password + passwordRepeat input'una aria-invalid set et.
  const hasError = !!state?.error;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cat-soft via-bg to-bars-soft px-6 py-16">
      <div className="w-full max-w-md rounded-3xl bg-white p-10 shadow-[var(--shadow-lg)]">
        <div className="mb-6 flex justify-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-cat-soft text-3xl">
            🔐
          </div>
        </div>

        <h1 className="text-center text-2xl font-bold leading-tight tracking-tight text-cart">
          Yeni şifre belirle
        </h1>

        <p className="mt-3 text-center text-sm leading-relaxed text-ink-3">
          <strong className="text-cart">{email}</strong> için yeni şifre belirle.
        </p>

        <form action={formAction} className="mt-6 flex flex-col gap-4">
          <input type="hidden" name="token" value={token} />

          <div>
            <label
              className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
              htmlFor="password"
            >
              Yeni şifre
            </label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="En az 8 karakter, 1 büyük + 1 rakam"
              autoComplete="new-password"
              required
              disabled={pending}
              minLength={8}
              aria-invalid={hasError || undefined}
              className="w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-3 text-sm text-ink transition-all focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
            />
          </div>

          <div>
            <label
              className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
              htmlFor="passwordRepeat"
            >
              Şifreyi tekrar gir
            </label>
            <input
              id="passwordRepeat"
              name="passwordRepeat"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              required
              disabled={pending}
              minLength={8}
              aria-invalid={hasError || undefined}
              className="w-full rounded-xl border-[1.5px] border-line bg-white px-4 py-3 text-sm text-ink transition-all focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
            />
          </div>

          <div className="rounded-xl bg-paper px-4 py-3 text-[13px] leading-relaxed text-ink-3">
            ⚠ Şifreni değiştirdiğinde tüm aktif oturumların kapanır (güvenlik gereği,
            Sprint 9&apos;da aktif).
          </div>

          <button
            type="submit"
            disabled={pending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-6 py-3.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(212,74,20,0.34)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {pending ? (
              <span className="text-xs tracking-wider">Güncelleniyor...</span>
            ) : (
              <>Şifremi güncelle →</>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-ink-4">
          <Link
            href={'/login' as never}
            className="border-b border-dashed border-cart font-bold text-cart hover:text-cat hover:border-cat"
          >
            Giriş ekranına dön
          </Link>
        </div>
      </div>
    </main>
  );
}

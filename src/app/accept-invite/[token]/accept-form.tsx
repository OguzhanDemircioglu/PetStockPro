'use client';

/**
 * Accept Invite Form — şifre belirle + ekibe katıl.
 *
 * /reset-password action'ını kullanır (completePasswordReset). emailVerifiedAt
 * COALESCE NULL → now bu davet kabul akışını da kapsar.
 */

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { resetPasswordAction, type ResetPasswordState } from '@/app/reset-password/[token]/actions';

interface Props {
  token: string;
  email: string;
  companyName: string;
}

export function AcceptInviteForm({ token, email, companyName }: Props) {
  const [state, formAction, pending] = useActionState<ResetPasswordState | null, FormData>(
    resetPasswordAction,
    null,
  );
  const [password, setPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-arrow-soft via-bg to-cat-soft px-6 py-16">
      <div className="w-full max-w-md rounded-3xl bg-white p-10 shadow-[var(--shadow-lg)]">
        <div className="mb-6 text-center">
          <div className="text-4xl">🎉</div>
          <h1 className="mt-3 text-2xl font-bold leading-tight tracking-tight text-cart">
            Ekibe hoş geldin
          </h1>
          <p className="mt-2 text-sm text-ink-3">
            <strong>{companyName}</strong> PetStockPro ekibine seni davet etti.
            Şifreni belirle ve hesabını aktive et.
          </p>
        </div>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="token" value={token} />
          <div>
            <label htmlFor="email" className="mb-1 block text-[12.5px] font-bold uppercase tracking-wider text-ink-3">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              readOnly
              data-testid="accept-email"
              className="w-full rounded-lg border-[1.5px] border-line bg-paper px-3 py-2 text-sm text-ink-3"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-[12.5px] font-bold uppercase tracking-wider text-ink-3">
              Şifre
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={pending}
              data-testid="accept-password"
              autoComplete="new-password"
              className="w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2 text-sm focus:border-cat focus:outline-none focus:ring-2 focus:ring-cat/15"
            />
          </div>
          <div>
            <label htmlFor="passwordRepeat" className="mb-1 block text-[12.5px] font-bold uppercase tracking-wider text-ink-3">
              Şifre (tekrar)
            </label>
            <input
              id="passwordRepeat"
              name="passwordRepeat"
              type="password"
              required
              minLength={8}
              value={passwordRepeat}
              onChange={(e) => setPasswordRepeat(e.target.value)}
              disabled={pending}
              data-testid="accept-password-repeat"
              autoComplete="new-password"
              className="w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2 text-sm focus:border-cat focus:outline-none focus:ring-2 focus:ring-cat/15"
            />
          </div>

          {state?.error && (
            <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-3 py-2 text-sm font-bold text-danger-7">
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
            disabled={pending || password.length < 8 || password !== passwordRepeat}
            data-testid="accept-submit"
            className="rounded-xl bg-gradient-to-br from-cat to-cat-2 px-5 py-3 text-sm font-bold text-white shadow-[var(--shadow-cat)] hover:-translate-y-0.5 transition-transform disabled:opacity-60"
          >
            {pending ? '⏳ Hesap aktive ediliyor...' : '🎉 Şifreyi belirle + ekibe katıl'}
          </button>
        </form>

        <p className="mt-6 text-center text-[12px] text-ink-4">
          Şifre min 8 karakter — HaveIBeenPwned k-anonymity check + güvenlik kuralları aktif.
          Onaylama sonrası <Link href={'/login' as never} className="text-cart font-bold">giriş</Link>{' '}
          ekranına yönlendirileceksin.
        </p>
      </div>
    </main>
  );
}

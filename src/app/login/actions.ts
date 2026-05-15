'use server';

/**
 * Login + Logout Server Actions
 *
 * Auth.js v5 signIn fn'ini wrap eder, hata handling + redirect logic.
 * Sprint 2.5: 2FA enabled hesaplarda TOTP step (requires2fa flag).
 *
 * Frontend useActionState ile bağlanır.
 */

import { signIn, signOut } from '@/lib/auth/auth';
import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export interface LoginState {
  ok: boolean;
  error: string | null;
  /** 2FA enabled hesap için TOTP input gösterilsin (form input persist edilir). */
  requires2fa: boolean;
  /** Form değerlerini koru (kullanıcı totp girerken email/şifre kaybolmasın). */
  email: string | null;
  password: string | null;
  /** Sprint 2.7 — kalan hak banner (3 ve aşağısında frontend banner gösterir). */
  remainingAttempts: number | null;
}

export async function loginAction(
  _prevState: LoginState | null,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get('email');
  const password = formData.get('password');
  const totp = formData.get('totp');

  if (typeof email !== 'string' || typeof password !== 'string') {
    return {
      ok: false,
      error: 'E-posta ve şifre zorunlu',
      requires2fa: false,
      email: typeof email === 'string' ? email : null,
      password: null,
      remainingAttempts: null,
    };
  }

  try {
    await signIn('credentials', {
      email,
      password,
      totp: typeof totp === 'string' ? totp : '',
      redirect: false,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      // CredentialsSignin alt sınıflarını code ile ayır
      const code = (err as AuthError & { code?: string }).code;

      if (code === '2fa_required') {
        return {
          ok: false,
          error: null,
          requires2fa: true,
          email,
          password,
          remainingAttempts: null,
        };
      }

      if (code === '2fa_invalid') {
        return {
          ok: false,
          error: '2FA kodu hatalı. Authenticator app\'ten güncel kodu gir.',
          requires2fa: true,
          email,
          password,
          remainingAttempts: null,
        };
      }

      // Sprint 2.7 — account_locked → /account-locked sayfasına redirect (lockedUntil cookie)
      if (code === 'account_locked') {
        // Auth.js v5 CredentialsSignin extend'i prod build'de minified field'lar kaybolabilir;
        // cookie ile lock state'i geçici taşı (5 dk TTL).
        const lockedErr = err as AuthError & { lockedSecondsRemaining?: number; lockedReason?: string };
        const cookieStore = await cookies();
        cookieStore.set(
          'pp_lock_state',
          JSON.stringify({
            email,
            secondsRemaining: lockedErr.lockedSecondsRemaining ?? 3600,
            reason: lockedErr.lockedReason ?? 'BRUTE_FORCE_1H',
            ts: Date.now(),
          }),
          { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 300, sameSite: 'lax' },
        );
        redirect('/account-locked' as never);
      }

      // Sprint 2.7 — invalid_credentials + remainingAttempts (banner için)
      if (code === 'invalid_credentials') {
        const invalidErr = err as AuthError & { remainingAttempts?: number };
        return {
          ok: false,
          error: 'E-posta veya şifre hatalı',
          requires2fa: false,
          email,
          password: null,
          remainingAttempts: invalidErr.remainingAttempts ?? null,
        };
      }

      // Generic CredentialsSignin → enumeration koruma
      return {
        ok: false,
        error: 'E-posta veya şifre hatalı',
        requires2fa: false,
        email,
        password: null,
        remainingAttempts: null,
      };
    }
    return {
      ok: false,
      error: 'Giriş yapılamadı, tekrar dene',
      requires2fa: false,
      email,
      password: null,
      remainingAttempts: null,
    };
  }

  redirect('/');
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirect: false });
  redirect('/login');
}

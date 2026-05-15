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

export interface LoginState {
  ok: boolean;
  error: string | null;
  /** 2FA enabled hesap için TOTP input gösterilsin (form input persist edilir). */
  requires2fa: boolean;
  /** Form değerlerini koru (kullanıcı totp girerken email/şifre kaybolmasın). */
  email: string | null;
  password: string | null;
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
      // CredentialsSignin alt sınıflarını code ile ayır (Sprint 2.5 — TwoFactorRequiredError vs)
      const code = (err as AuthError & { code?: string }).code;

      if (code === '2fa_required') {
        // Şifre doğru, TOTP gerekli — form'u totp input ile yeniden render et
        return {
          ok: false,
          error: null,
          requires2fa: true,
          email,
          password,
        };
      }

      if (code === '2fa_invalid') {
        return {
          ok: false,
          error: '2FA kodu hatalı. Authenticator app\'ten güncel kodu gir.',
          requires2fa: true,
          email,
          password,
        };
      }

      // Generic CredentialsSignin → enumeration koruma için aynı mesaj
      return {
        ok: false,
        error: 'E-posta veya şifre hatalı',
        requires2fa: false,
        email,
        password: null,
      };
    }
    return {
      ok: false,
      error: 'Giriş yapılamadı, tekrar dene',
      requires2fa: false,
      email,
      password: null,
    };
  }

  redirect('/');
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirect: false });
  redirect('/login');
}

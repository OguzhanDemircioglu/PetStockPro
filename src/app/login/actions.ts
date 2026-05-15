'use server';

/**
 * Login + Logout Server Actions
 *
 * Auth.js v5 signIn fn'ini wrap eder, hata handling + redirect logic.
 * Frontend useActionState ile bağlanır.
 */

import { signIn, signOut } from '@/lib/auth/auth';
import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';

export interface LoginState {
  ok: boolean;
  error: string | null;
}

export async function loginAction(
  _prevState: LoginState | null,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get('email');
  const password = formData.get('password');

  if (typeof email !== 'string' || typeof password !== 'string') {
    return { ok: false, error: 'E-posta ve şifre zorunlu' };
  }

  try {
    await signIn('credentials', {
      email,
      password,
      redirect: false, // manuel redirect — hata varsa form'da kalalım
    });
  } catch (err) {
    if (err instanceof AuthError) {
      // CredentialsSignin → generic message (email enumeration koruma)
      return { ok: false, error: 'E-posta veya şifre hatalı' };
    }
    // Unknown error
    return { ok: false, error: 'Giriş yapılamadı, tekrar dene' };
  }

  // signIn başarılı → redirect manuel (Next.js redirect throw eder ama bu beklenen)
  redirect('/');
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirect: false });
  redirect('/login');
}

'use server';

/**
 * Reset Password Server Action
 *
 * completePasswordReset'i çağırır + browser flow için state döner.
 * Success durumunda /login'e redirect (yeni şifreyle gir).
 */

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { completePasswordReset } from '@/lib/auth/reset-password';
import { db } from '@/lib/db/client';

export interface ResetPasswordState {
  error: string | null;
  /** Spesifik issue listesi (zayıf şifre kuralları için). */
  issues: string[];
  /** Token URL'den geldi — error case'lerinde geri formda göstermek için. */
  token: string | null;
}

export async function resetPasswordAction(
  _prevState: ResetPasswordState | null,
  formData: FormData,
): Promise<ResetPasswordState> {
  const token = formData.get('token');
  const password = formData.get('password');
  const passwordRepeat = formData.get('passwordRepeat');

  if (typeof token !== 'string' || typeof password !== 'string' || typeof passwordRepeat !== 'string') {
    return {
      error: 'Tüm alanlar zorunlu',
      issues: [],
      token: typeof token === 'string' ? token : null,
    };
  }

  if (password !== passwordRepeat) {
    return {
      error: 'Şifreler eşleşmiyor',
      issues: [],
      token,
    };
  }

  // IP'yi audit + email için yakala
  const headersList = await headers();
  const forwardedFor = headersList.get('x-forwarded-for');
  const realIp = headersList.get('x-real-ip');
  const ipAddress = forwardedFor?.split(',')[0]?.trim() ?? realIp ?? null;

  const result = await completePasswordReset({ token, password }, db, { ipAddress });

  if (!result.ok) {
    switch (result.reason) {
      case 'invalid_token':
        return {
          error: 'Sıfırlama bağlantısı geçersiz veya daha önce kullanılmış. Yeni bir bağlantı iste.',
          issues: [],
          token,
        };
      case 'expired':
        return {
          error: 'Sıfırlama bağlantısının süresi dolmuş (30 dakika). Yeni bir bağlantı iste.',
          issues: [],
          token,
        };
      case 'weak_password':
        return {
          error: result.issues?.[0] ?? 'Şifre güvenlik kriterlerini karşılamıyor',
          issues: result.issues ?? [],
          token,
        };
      default:
        return {
          error: 'Beklenmedik bir hata oluştu — tekrar dene.',
          issues: [],
          token,
        };
    }
  }

  // Başarılı — login'e redirect (yeni şifreyle gir)
  redirect('/login?reset=success' as never);
}

'use server';

/**
 * Register Server Action
 *
 * registerNewTenant'ı çağırır + form submit handling.
 * Email verification akışı Sprint 2.3'te aktive (şu an verify-email placeholder'a redirect).
 */

import { registerNewTenant } from '@/lib/auth/register';
import { db } from '@/lib/db/client';
import { redirect } from 'next/navigation';

export interface RegisterState {
  ok: boolean;
  error: string | null;
}

export async function registerAction(
  _prevState: RegisterState | null,
  formData: FormData,
): Promise<RegisterState> {
  const shopName = formData.get('shopName');
  const email = formData.get('email');
  const password = formData.get('password');
  const passwordConfirm = formData.get('passwordConfirm');
  const kvkkConsent = formData.get('kvkkConsent') === 'on';
  // AB veri işleme açık rızası kayıt akışında zımni (KVKK dokümanında belirtilir) — ayrı checkbox YOK (2026-06-10).
  const dataLocationConsent = true;

  if (typeof shopName !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
    return { ok: false, error: 'Tüm alanlar zorunlu' };
  }

  if (typeof passwordConfirm !== 'string' || password !== passwordConfirm) {
    return { ok: false, error: 'Şifreler eşleşmiyor — ikinci kez aynı şifreyi gir' };
  }

  const result = await registerNewTenant(
    {
      shopName,
      email,
      password,
      kvkkConsent: kvkkConsent as true,
      dataLocationConsent: dataLocationConsent as true,
    },
    db,
  );

  if (!result.ok) {
    return {
      ok: false,
      error: result.issues?.join(' · ') ?? 'Kayıt yapılamadı, tekrar dene',
    };
  }

  // TODO Sprint 2.3: email verification token üret + Brevo gönder
  // /verify-email page Sprint 2.3'te yaratılacak; typedRoutes uyarısı için cast
  redirect('/verify-email' as never);
}

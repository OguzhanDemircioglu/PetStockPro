'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { initEmailChange } from '@/lib/auth/change-email';

export interface ChangeEmailState {
  ok: boolean;
  error: string | null;
  pendingEmail: string | null;
}

export async function initChangeEmailAction(
  _prevState: ChangeEmailState | null,
  formData: FormData,
): Promise<ChangeEmailState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login' as never);
  }

  const newEmail = formData.get('newEmail');
  const currentPassword = formData.get('currentPassword');

  if (typeof newEmail !== 'string' || typeof currentPassword !== 'string') {
    return { ok: false, error: 'Tüm alanlar zorunlu', pendingEmail: null };
  }

  const result = await initEmailChange(
    session.user.id,
    { newEmail, currentPassword },
    db,
  );

  if (!result.ok) {
    const msg = {
      invalid_input: result.issues?.[0] ?? 'Geçerli bir e-posta gir',
      wrong_password: 'Şifre hatalı',
      same_email: 'Yeni e-posta mevcut ile aynı',
      taken: 'Bu e-posta başka bir hesap tarafından kullanılıyor',
      unknown: 'Beklenmedik bir hata oluştu',
    }[result.reason];
    return { ok: false, error: msg, pendingEmail: null };
  }

  return { ok: true, error: null, pendingEmail: newEmail };
}

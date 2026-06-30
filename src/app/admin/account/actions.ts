'use server';

import { redirect } from 'next/navigation';
import { auth, signOut } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { initEmailChange } from '@/lib/auth/change-email';
import { deleteOwnAccount } from '@/lib/account/delete-account';

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

export interface DeleteAccountState {
  ok: boolean;
  error: string | null;
}

/**
 * Hesabı (tenant'ı) kalıcı pasifleştir — yalnızca BAYI_SAHIBI. Şifre re-auth.
 * Başarıda oturum kapatılır + /login?deleted=1'e yönlendirilir.
 *
 * SUPERADMIN (impersonation dahil role='SUPERADMIN' kalır) + STAFF/OBSERVER:
 * UI'da bu form görünmez; yine de server-side gate (role + deleteOwnAccount DB check).
 */
export async function deleteAccountAction(
  _prevState: DeleteAccountState | null,
  formData: FormData,
): Promise<DeleteAccountState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login' as never);
  }

  if (session.user.role !== 'BAYI_SAHIBI') {
    return { ok: false, error: 'Bu işlem yalnızca işletme sahibinin hesabında yapılabilir.' };
  }

  const password = formData.get('password');
  if (typeof password !== 'string' || password.length === 0) {
    return { ok: false, error: 'Şifre zorunlu' };
  }

  const result = await deleteOwnAccount({ userId: session.user.id, password }, db);
  if (!result.ok) {
    const msg = {
      not_found: 'Hesap bulunamadı.',
      not_owner: 'Bu işlem yalnızca işletme sahibinin hesabında yapılabilir.',
      wrong_password: 'Şifre hatalı.',
      already_deleted: 'Hesap zaten silinmiş.',
      unknown: 'Beklenmedik bir hata oluştu, tekrar deneyin.',
    }[result.reason];
    return { ok: false, error: msg };
  }

  // Başarılı — oturumu kapat + login'e "hesabın silindi" mesajıyla yönlendir.
  // signOut redirect fırlatır; sonraki satıra ulaşılmaz.
  await signOut({ redirectTo: '/login?deleted=1' });
  return { ok: true, error: null };
}

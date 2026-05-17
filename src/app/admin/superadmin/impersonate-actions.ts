'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/auth';
import { isSuperadmin } from '@/lib/superadmin/access';
import {
  setImpersonationCookie,
  clearImpersonationCookie,
} from '@/lib/superadmin/impersonate';

/**
 * SUPERADMIN tenant impersonation başlat — cookie yaz + /admin'e redirect.
 *
 * SUPERADMIN gate: non-superadmin çağırırsa silent reject (cookie yazılmaz,
 * /admin/superadmin'a düşürülür).
 */
export async function startImpersonationAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email || !isSuperadmin(session)) {
    redirect('/admin' as never);
  }
  const companyId = formData.get('companyId');
  if (typeof companyId !== 'string' || !companyId) {
    redirect('/admin/superadmin' as never);
  }
  await setImpersonationCookie(companyId, session.user.id, session.user.email);
  revalidatePath('/admin');
  redirect('/admin' as never);
}

/**
 * Impersonation çıkışı — cookie sil + süperadmin tenant listesine redirect.
 *
 * Banner'da × Çıkış butonundan tetiklenir. Audit logs'a "stopped" event yazılır.
 */
export async function stopImpersonationAction() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    redirect('/login' as never);
  }
  await clearImpersonationCookie(session.user.id, session.user.email);
  revalidatePath('/admin');
  redirect('/admin/superadmin' as never);
}

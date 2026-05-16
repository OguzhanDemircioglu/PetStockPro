/**
 * Süperadmin erişim kontrolü — Sprint 7a foundation.
 *
 * JWT'de role='SUPERADMIN' claim olan kullanıcılar süperadmin sayfalarına erişebilir.
 * Tüm /admin/superadmin/* sayfalarında requireSuperadmin guard kullanılır.
 *
 * SUPERADMIN companies tablosunda satır olmadan da var olabilir (sistem geneline ait),
 * companyId NULLABLE users.company_id ile.
 */

import { redirect } from 'next/navigation';
import type { Session } from 'next-auth';
import { auth } from '@/lib/auth/auth';

/**
 * Session'da role='SUPERADMIN' mi?
 */
export function isSuperadmin(session: Session | null): boolean {
  if (!session?.user) return false;
  return (session.user as { role?: string }).role === 'SUPERADMIN';
}

/**
 * Süperadmin guard — sayfa başında çağrılır. Değilse /admin'e redirect.
 * Dönerse session garanti SUPERADMIN ve session.user.id set.
 */
export async function requireSuperadmin(): Promise<Session> {
  const session = await auth();
  if (!session?.user?.id) redirect('/login' as never);
  if (!isSuperadmin(session)) redirect('/admin' as never);
  return session;
}

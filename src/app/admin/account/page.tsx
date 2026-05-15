import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { users } from '@/db/schema';
import { AccountForm } from './form';

/**
 * /admin/account — Sprint 2.9 minimal
 *
 * Sprint 9 full settings sidebar gelince taşınır (sidebar: account / security / billing).
 * Şu an sadece email değiştirme + mevcut email gösterimi.
 */
export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login' as never);
  }

  const rows = await db
    .select({
      email: users.email,
      pendingEmail: users.pendingEmail,
      pendingEmailExpiresAt: users.pendingEmailExpiresAt,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  const user = rows[0];

  if (!user) {
    redirect('/login' as never);
  }

  return (
    <AccountForm
      currentEmail={user.email}
      pendingEmail={user.pendingEmail}
      pendingEmailExpiresAt={user.pendingEmailExpiresAt}
    />
  );
}

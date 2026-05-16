import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { users } from '@/db/schema';
import { SettingsShell } from '@/components/settings-shell';
import { AccountForm } from './form';

/**
 * /admin/account — Sprint 2.9 (Sprint 2.10 sidebar entegre).
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
    <SettingsShell
      current="account"
      title="Hesap bilgileri"
      description="Giriş e-postası ve hesap erişim ayarları"
    >
      <AccountForm
        currentEmail={user.email}
        pendingEmail={user.pendingEmail}
        pendingEmailExpiresAt={user.pendingEmailExpiresAt}
      />
    </SettingsShell>
  );
}

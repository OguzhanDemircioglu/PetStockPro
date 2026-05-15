import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { users } from '@/db/schema';
import { SecurityForms } from './forms';

/**
 * /admin/security — Sprint 2.8 minimal
 *
 * Sprint 9'da settings sidebar (account/security/notifications/billing) yapısı
 * gelecek. Şu an sadece 2FA disable + recovery codes regenerate.
 */
export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ '2fa'?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login' as never);
  }

  const rows = await db
    .select({
      email: users.email,
      twoFactorEnabled: users.twoFactorEnabled,
      twoFactorEnabledAt: users.twoFactorEnabledAt,
      twoFactorRecoveryCodes: users.twoFactorRecoveryCodes,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  const user = rows[0];

  if (!user) {
    redirect('/login' as never);
  }

  const params = await searchParams;
  const just2faDisabled = params['2fa'] === 'disabled';

  // Recovery codes durumu — kaç tane kullanılmamış kaldı?
  const remainingRecoveryCount = user.twoFactorRecoveryCodes
    ? user.twoFactorRecoveryCodes.filter((c) => !c.usedAt).length
    : 0;

  return (
    <SecurityForms
      email={user.email}
      twoFactorEnabled={user.twoFactorEnabled}
      twoFactorEnabledAt={user.twoFactorEnabledAt}
      remainingRecoveryCount={remainingRecoveryCount}
      just2faDisabled={just2faDisabled}
    />
  );
}

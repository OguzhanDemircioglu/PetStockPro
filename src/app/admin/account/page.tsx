import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { users } from '@/db/schema';
import { SettingsShell } from '@/components/settings-shell';
import { hasActivePaidSubscription } from '@/lib/account/delete-account';
import { AccountForm } from './form';
import { SecurityForms } from '../security/forms';
import { DeleteAccount } from './delete-account';

/**
 * /admin/account — Hesap & Güvenlik.
 *
 * 2026-06-27: /admin/security (2FA + recovery) buraya birleştirildi. İkisi de
 * kullanıcıya özel (giriş kimliği) olduğu için tek sekmede toplandı; eski
 * /admin/security URL'i bu sayfaya redirect eder.
 */
export default async function AccountPage({
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
      pendingEmail: users.pendingEmail,
      pendingEmailExpiresAt: users.pendingEmailExpiresAt,
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
  const remainingRecoveryCount = user.twoFactorRecoveryCodes
    ? user.twoFactorRecoveryCodes.filter((c) => !c.usedAt).length
    : 0;

  // "Hesabımı sil" yalnızca tenant sahibine. SUPERADMIN (companyId=NULL) +
  // STAFF/OBSERVER görmez. Sahipse aktif abonelik durumunu uyarı için çek.
  const showDelete = session.user.role === 'BAYI_SAHIBI' && !!session.user.companyId;
  const hasActiveSub = showDelete
    ? await hasActivePaidSubscription(session.user.companyId as string, db)
    : false;

  return (
    <SettingsShell
      current="account"
      title="Hesap & Güvenlik"
      description="Giriş e-postası, iki faktörlü doğrulama (2FA) ve recovery kodları"
    >
      <div className="flex flex-col gap-8">
        <AccountForm
          currentEmail={user.email}
          pendingEmail={user.pendingEmail}
          pendingEmailExpiresAt={user.pendingEmailExpiresAt}
        />
        <div className="max-w-2xl border-t border-line pt-8">
          <h2 className="mb-3 text-lg font-bold text-cart">🛡 Güvenlik</h2>
          <SecurityForms
            email={user.email}
            twoFactorEnabled={user.twoFactorEnabled}
            twoFactorEnabledAt={user.twoFactorEnabledAt}
            remainingRecoveryCount={remainingRecoveryCount}
            just2faDisabled={just2faDisabled}
          />
        </div>
        {showDelete && (
          <div className="max-w-2xl border-t border-line pt-8">
            <DeleteAccount hasActiveSubscription={hasActiveSub} />
          </div>
        )}
      </div>
    </SettingsShell>
  );
}

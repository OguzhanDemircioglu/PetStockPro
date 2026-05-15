import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { initTwoFactorSetup } from '@/lib/auth/two-factor-setup';
import { TwoFactorWizard } from './wizard';

/**
 * 2FA Setup Wizard — Server Component
 *
 * Akış (EKRAN-AUTH §7):
 *   1. Auth check → unauthenticated /login redirect
 *   2. initTwoFactorSetup → secret + QR + otpauth URI
 *   3. Client wizard render (props ile)
 *
 * Setup secret 10 dk geçici DB'de saklı. Kullanıcı 10 dk içinde tamamlamalı.
 */
export default async function TwoFactorSetupPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login' as never);
  }

  const setup = await initTwoFactorSetup(session.user.id, db);

  return (
    <TwoFactorWizard
      secret={setup.secret}
      qrCodeDataUrl={setup.qrCodeDataUrl}
      userEmail={session.user.email ?? ''}
    />
  );
}

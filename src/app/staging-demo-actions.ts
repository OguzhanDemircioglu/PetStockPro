'use server';

import { redirect } from 'next/navigation';
import { signIn } from '@/lib/auth/auth';

/**
 * Staging demo SUPERADMIN auto-login.
 *
 * Sadece NEXT_PUBLIC_STAGING_MODE=true iken çalışır. Production'da no-op.
 * Mockup ziyaretçisinin /admin/superadmin paneline anonim olarak göz atabilmesi
 * için pre-defined demo hesabıyla sign-in eder.
 *
 * Demo hesap credential'ları staging env'de set edilir:
 *   STAGING_DEMO_EMAIL=claude@petstockpro.local
 *   STAGING_DEMO_PASSWORD=Test1234!
 *
 * Production'da bu env'ler set EDİLMEZ → action no-op.
 */
export async function stagingDemoLoginAction(): Promise<void> {
  if (process.env.NEXT_PUBLIC_STAGING_MODE !== 'true') {
    redirect('/' as never);
  }

  const email = process.env.STAGING_DEMO_EMAIL;
  const password = process.env.STAGING_DEMO_PASSWORD;
  if (!email || !password) {
    redirect('/yapim-asamasinda' as never);
  }

  try {
    await signIn('credentials', {
      email,
      password,
      redirect: false,
    });
  } catch {
    // Sessizce başarısız ol — kullanıcı yapım aşaması sayfasına yönlendirilir.
    redirect('/yapim-asamasinda' as never);
  }

  redirect('/admin/superadmin' as never);
}

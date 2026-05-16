import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { getStorefrontSettings } from '@/lib/storefront/settings';
import { SettingsShell } from '@/components/settings-shell';
import { StorefrontForm } from './form';

export default async function StorefrontSettingsPage() {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const profile = await getStorefrontSettings(session.user.companyId, db);

  return (
    <SettingsShell
      current="storefront"
      title="Vitrin profili"
      description="Pet shop'unu petstockpro.com/vitrin'de tanıtan halka açık profili."
    >
      <StorefrontForm initial={profile} />
    </SettingsShell>
  );
}

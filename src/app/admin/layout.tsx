import { auth } from '@/lib/auth/auth';
import { isSuperadmin } from '@/lib/superadmin/access';
import { SuperadminToolbox } from '@/components/superadmin-toolbox';

/**
 * /admin/* layout — tüm admin sayfalarında SUPERADMIN ise Toolbox FAB ekler.
 * Diğer adminler için no-op (sadece children).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const showToolbox = isSuperadmin(session);

  return (
    <>
      {children}
      {showToolbox && <SuperadminToolbox />}
    </>
  );
}

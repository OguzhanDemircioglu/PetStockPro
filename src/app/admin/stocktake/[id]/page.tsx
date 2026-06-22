import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { withTenant } from '@/lib/db/with-tenant';
import { getStocktakeWithItems } from '@/lib/stocktake/sessions';
import { StocktakeWorkflow } from './workflow';

export default async function StocktakeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const { id } = await params;
  const companyId = session.user.companyId;
  const detail = await withTenant(companyId, (tx) => getStocktakeWithItems(companyId, id, tx));
  if (!detail) notFound();

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <Link
        href={'/admin/stocktake' as never}
        className="text-xs text-ink-4 hover:text-cart"
      >
        ← Sayım listesi
      </Link>

      <StocktakeWorkflow detail={detail} />
    </main>
  );
}

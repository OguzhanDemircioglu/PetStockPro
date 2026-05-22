import Link from 'next/link';
import { redirect } from 'next/navigation';
import { and, asc, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { branches } from '@/db/schema';
import { StartStocktakeForm } from './form';

export default async function NewStocktakePage() {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const branchList = await db
    .select({ id: branches.id, name: branches.name })
    .from(branches)
    .where(and(eq(branches.companyId, session.user.companyId), eq(branches.isActive, true)))
    .orderBy(asc(branches.name));

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header>
        <div className="text-[13px] font-bold uppercase tracking-wider text-cat">
          Admin · Sayım · Yeni
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          Yeni sayım başlat
        </h1>
        <p className="mt-1 text-sm text-ink-3">
          Şube seç, sistem stoğu snapshot alınsın, fiziksel sayımı kaydedip farkları
          stok hareketine dönüştür.
        </p>
      </header>

      {branchList.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-line bg-paper py-12 text-center">
          <div className="text-5xl">🏪</div>
          <h2 className="mt-3 text-lg font-bold text-cart">Aktif şube yok</h2>
          <p className="mt-1 text-xs text-ink-3">
            Sayım yapabilmek için önce en az 1 aktif şube ekle.
          </p>
          <Link
            href={'/admin/branches/new' as never}
            className="mt-3 inline-block rounded-xl bg-cat px-4 py-2 text-xs font-bold text-white"
          >
            + Yeni şube
          </Link>
        </div>
      ) : (
        <StartStocktakeForm branches={branchList} />
      )}

      <Link
        href={'/admin/stocktake' as never}
        className="text-center text-xs text-ink-4 hover:text-cart"
      >
        ← Sayım listesine dön
      </Link>
    </main>
  );
}

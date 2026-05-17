import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { cities } from '@/db/schema';
import { BranchForm } from '../branch-form';
import { addBranchAction } from '../actions';
import { asc } from 'drizzle-orm';

export default async function NewBranchPage() {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const cityList = await db
    .select({ id: cities.id, name: cities.name })
    .from(cities)
    .orderBy(asc(cities.name));

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      <header>
        <Link href={'/admin/branches' as never} className="text-xs text-ink-4 hover:text-cart">
          ← Şubelere dön
        </Link>
        <div className="mt-3 text-[13px] font-bold uppercase tracking-wider text-cat">
          Admin · Yeni Şube
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          Yeni şube ekle
        </h1>
        <p className="mt-1 text-sm text-ink-3">
          Çoklu şube transfer için + stok takip için kullanılır.
        </p>
      </header>

      <BranchForm
        action={addBranchAction}
        cities={cityList}
        submitLabel="Şubeyi ekle"
      />
    </main>
  );
}

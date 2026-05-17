import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { BrandForm } from '../brand-form';
import { addBrandAction } from '../actions';

export default async function NewBrandPage() {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      <header>
        <Link href={'/admin/brands' as never} className="text-xs text-ink-4 hover:text-cart">
          ← Markalara dön
        </Link>
        <div className="mt-3 text-[13px] font-bold uppercase tracking-wider text-cat">
          Admin · Yeni Marka
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          Yeni marka ekle
        </h1>
      </header>

      <BrandForm action={addBrandAction} submitLabel="Markayı ekle" />
    </main>
  );
}

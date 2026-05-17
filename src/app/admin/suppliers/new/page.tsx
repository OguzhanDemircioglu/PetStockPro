import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { SupplierForm } from '../supplier-form';
import { addSupplierAction } from '../actions';

export default async function NewSupplierPage() {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <header>
        <Link href={'/admin/suppliers' as never} className="text-xs text-ink-4 hover:text-cart">
          ← Tedarikçilere dön
        </Link>
        <div className="mt-3 text-[13px] font-bold uppercase tracking-wider text-cat">
          Admin · Yeni Tedarikçi
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          Yeni tedarikçi ekle
        </h1>
      </header>

      <SupplierForm action={addSupplierAction} submitLabel="Tedarikçiyi ekle" />
    </main>
  );
}

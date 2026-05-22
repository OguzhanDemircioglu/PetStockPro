import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { getBrandDetail } from '@/lib/brands/manage';
import { BrandForm } from '../../brand-form';
import { updateBrandAction } from '../../actions';

export default async function EditBrandPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const brand = await getBrandDetail(id, db);
  if (!brand) notFound();

  const boundUpdate = updateBrandAction.bind(null, id);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      <header>
        <Link href={'/admin/brands' as never} className="text-xs text-ink-4 hover:text-cart">
          ← Markalara dön
        </Link>
        <div className="mt-3 text-[13px] font-bold uppercase tracking-wider text-cat">
          Admin · Marka düzenle
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          {brand.name}
        </h1>
        <p className="mt-1 text-xs text-ink-3">
          {brand.productCount} ürün bu markada
        </p>
      </header>

      <BrandForm
        action={boundUpdate}
        initial={{ name: brand.name, logoUrl: brand.logoUrl }}
        submitLabel="Değişiklikleri kaydet"
      />
    </main>
  );
}

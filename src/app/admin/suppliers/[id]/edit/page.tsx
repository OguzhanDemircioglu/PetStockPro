import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { getSupplierDetail } from '@/lib/suppliers/manage';
import { SupplierForm } from '../../supplier-form';
import { updateSupplierAction } from '../../actions';

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const supplier = await getSupplierDetail(session.user.companyId, id, db);
  if (!supplier) notFound();

  const boundUpdate = updateSupplierAction.bind(null, id);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <header>
        <Link href={'/admin/suppliers' as never} className="text-xs text-ink-4 hover:text-cart">
          ← Tedarikçilere dön
        </Link>
        <div className="mt-3 text-[11.5px] font-bold uppercase tracking-wider text-cat">
          Admin · Tedarikçi düzenle
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          {supplier.name}
        </h1>
      </header>

      <SupplierForm
        action={boundUpdate}
        initial={{
          name: supplier.name,
          vatNo: supplier.vatNo,
          vatOffice: supplier.vatOffice,
          contactName: supplier.contactName,
          phone: supplier.phone,
          email: supplier.email,
          city: supplier.city,
          district: supplier.district,
          leadTimeDays: supplier.leadTimeDays,
          paymentTerms: supplier.paymentTerms,
          iban: supplier.iban,
        }}
        submitLabel="Değişiklikleri kaydet"
      />
    </main>
  );
}

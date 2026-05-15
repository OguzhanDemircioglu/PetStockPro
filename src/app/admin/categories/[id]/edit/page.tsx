import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { getCategoryDetail } from '@/lib/categories/manage';
import { CategoryForm } from '../../category-form';
import { updateCategoryAction } from '../../actions';

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const cat = await getCategoryDetail(session.user.companyId, id, db);
  if (!cat) notFound();

  const boundUpdate = updateCategoryAction.bind(null, id);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      <header>
        <Link
          href={'/admin/categories' as never}
          className="text-xs text-ink-4 hover:text-cart"
        >
          ← Kategorilere dön
        </Link>
        <div className="mt-3 text-[11.5px] font-bold uppercase tracking-wider text-cat">
          Admin · Kategori düzenle
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          {cat.emoji ? `${cat.emoji} ` : ''}{cat.name}
        </h1>
        <p className="mt-1 text-xs text-ink-3">
          {cat.productCount} ürün bu kategoride
        </p>
      </header>

      <CategoryForm
        action={boundUpdate}
        initial={{
          name: cat.name,
          emoji: cat.emoji,
          vatRate: cat.vatRate,
          sktRequired: cat.sktRequired,
          displayOrder: cat.displayOrder,
        }}
        submitLabel="Değişiklikleri kaydet"
      />
    </main>
  );
}

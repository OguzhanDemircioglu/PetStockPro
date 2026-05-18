import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { getCategoryDetail, listCategories } from '@/lib/categories/manage';
import { isSuperadmin } from '@/lib/superadmin/access';
import { CategoryForm, type ParentOption } from '../../category-form';
import { updateCategoryAction } from '../../actions';

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);
  if (!isSuperadmin(session)) redirect('/admin/categories' as never);

  const [cat, allCategories] = await Promise.all([
    getCategoryDetail(session.user.companyId, id, db),
    listCategories(session.user.companyId, db),
  ]);
  if (!cat) notFound();

  // Edit'te parent options: root kategoriler hariç bu kategorinin kendisi
  // (circular reference engellemek için).
  const parentOptions: ParentOption[] = allCategories
    .filter((c) => !c.parentId && c.id !== id)
    .map((c) => ({ id: c.id, name: c.name, emoji: c.emoji }));
  // Edit'te maxOrder mevcut max + 1, kendi displayOrder'ı dahil tut.
  const maxOrder =
    allCategories.length === 0
      ? 1
      : Math.max(...allCategories.map((c) => c.displayOrder)) + 1;

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
        <div className="mt-3 text-[13px] font-bold uppercase tracking-wider text-cat">
          Admin · Kategori düzenle
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          {cat.emoji ? `${cat.emoji} ` : ''}
          {cat.name}
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
          sktRequired: cat.sktRequired,
          displayOrder: cat.displayOrder,
          parentId: cat.parentId,
        }}
        submitLabel="Değişiklikleri kaydet"
        parentOptions={parentOptions}
        maxOrder={maxOrder}
      />
    </main>
  );
}

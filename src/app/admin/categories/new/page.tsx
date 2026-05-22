import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { listCategories } from '@/lib/categories/manage';
import { isSuperadmin } from '@/lib/superadmin/access';
import { CategoryForm, type ParentOption } from '../category-form';
import { addCategoryAction } from '../actions';

export default async function NewCategoryPage() {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);
  if (!isSuperadmin(session)) redirect('/admin/categories' as never);

  // Mevcut kategorileri çek: parent options + max(displayOrder) hesapla.
  const allCategories = await listCategories(db);
  // Sadece root kategoriler parent olabilir (2-seviye sistem, derinlik 1).
  const parentOptions: ParentOption[] = allCategories
    .filter((c) => !c.parentId)
    .map((c) => ({ id: c.id, name: c.name, emoji: c.emoji }));
  // En son sıra + 1 (yeni kategori için default)
  const maxOrder =
    allCategories.length === 0
      ? 1
      : Math.max(...allCategories.map((c) => c.displayOrder)) + 1;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header>
        <Link
          href={'/admin/categories' as never}
          className="text-xs text-ink-4 hover:text-cart"
        >
          ← Kategorilere dön
        </Link>
        <div className="mt-3 text-[13px] font-bold uppercase tracking-wider text-cat">
          Admin · Yeni Kategori
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          Yeni kategori ekle
        </h1>
      </header>

      <CategoryForm
        action={addCategoryAction}
        submitLabel="Kategoriyi ekle"
        parentOptions={parentOptions}
        maxOrder={maxOrder}
      />
    </main>
  );
}

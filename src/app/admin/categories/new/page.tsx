import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { CategoryForm } from '../category-form';
import { addCategoryAction } from '../actions';

export default async function NewCategoryPage() {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

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
          Admin · Yeni Kategori
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          Yeni kategori ekle
        </h1>
      </header>

      <CategoryForm action={addCategoryAction} submitLabel="Kategoriyi ekle" />
    </main>
  );
}

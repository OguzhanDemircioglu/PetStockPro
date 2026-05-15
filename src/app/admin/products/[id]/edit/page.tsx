import { notFound, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { brands, categories } from '@/db/schema';
import { getProductDetail } from '@/lib/catalog/products';
import { EditForm } from './form';

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.companyId) {
    redirect('/login' as never);
  }

  const product = await getProductDetail(session.user.companyId, id, db);
  if (!product || !product.defaultVariant) {
    notFound();
  }

  const [categoryList, brandList] = await Promise.all([
    db
      .select({ id: categories.id, name: categories.name, emoji: categories.emoji })
      .from(categories)
      .where(eq(categories.companyId, session.user.companyId))
      .orderBy(categories.displayOrder),
    db
      .select({ id: brands.id, name: brands.name })
      .from(brands)
      .where(eq(brands.companyId, session.user.companyId))
      .orderBy(brands.name),
  ]);

  return (
    <EditForm
      productId={product.id}
      variantId={product.defaultVariant.id}
      initial={{
        name: product.name,
        description: product.description,
        categoryId: product.categoryId,
        brandId: product.brandId,
        isActive: product.isActive,
        variant: product.defaultVariant,
      }}
      categories={categoryList}
      brands={brandList}
    />
  );
}

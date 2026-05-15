import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { brands, categories } from '@/db/schema';
import { ProductForm } from './form';

/**
 * /admin/products/new — Sprint 3.0 minimal create form
 *
 * SSR yükler:
 *   - Kategoriler (tenant'a ait, displayOrder sıralı)
 *   - Markalar (tenant'a ait)
 *
 * Form: name + description + categoryId (opsiyonel) + brandId (opsiyonel) +
 *       1 default variant (valueLabel + sku + barcode + costPrice + salePrice + threshold)
 */
export default async function NewProductPage() {
  const session = await auth();
  if (!session?.user?.companyId) {
    redirect('/login' as never);
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

  return <ProductForm categories={categoryList} brands={brandList} />;
}

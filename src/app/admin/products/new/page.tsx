import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { getCachedCategories, getCachedBrands } from '@/lib/cache/request-scoped';
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
    getCachedCategories(),
    getCachedBrands(),
  ]);

  // R2 public URL'i server-side env'den oku → client component'e prop olarak geç.
  // (NEXT_PUBLIC_ duplicate gerekmez, env tek tanım kalır.)
  const r2PublicUrl = process.env.R2_PUBLIC_URL ?? '';

  return (
    <ProductForm
      categories={categoryList}
      brands={brandList}
      r2PublicUrl={r2PublicUrl}
    />
  );
}

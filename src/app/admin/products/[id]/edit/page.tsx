import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { withTenant } from '@/lib/db/with-tenant';
import { getCachedCategories, getCachedBrands } from '@/lib/cache/request-scoped';
import { getProductDetail } from '@/lib/catalog/products';
import { listVariants, listBranchOptions } from '@/lib/catalog/variants';
import { validateForStorefront } from '@/lib/catalog/storefront';
import { listProductImages } from '@/lib/catalog/product-images';
import { EditForm } from './form';
import { VariantsSection } from './variants-section';
import { StorefrontSection } from './storefront-section';
import { ImagesSection } from './images-section';

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

  const companyId = session.user.companyId;
  const product = await withTenant(companyId, (tx) => getProductDetail(companyId, id, tx));
  if (!product || !product.defaultVariant) {
    notFound();
  }

  // Global cached (unstable_cache, db kullanmaz) — withTenant dışında.
  const [categoryList, brandList] = await Promise.all([
    getCachedCategories(),
    getCachedBrands(),
  ]);
  // Tenant okumalar tek withTenant'ta (GUC).
  const [variants, branchOptions, validation, images] = await withTenant(companyId, (tx) =>
    Promise.all([
      listVariants(companyId, id, tx),
      listBranchOptions(companyId, tx),
      // Sprint 3.3 aktif — requireImage=true ile vitrin'e açmak için en az 1 görsel zorunlu
      validateForStorefront(companyId, id, tx, { requireImage: true }),
      listProductImages(companyId, id, tx),
    ]),
  );

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
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

      <StorefrontSection
        productId={product.id}
        initialPublished={product.vitrinPublished}
        validation={validation}
        publishedAt={product.vitrinPublishedAt}
        unpublishedReason={product.vitrinAutoUnpublishedReason}
      />

      <ImagesSection productId={product.id} images={images} />

      <VariantsSection
        productId={product.id}
        variants={variants}
        branches={branchOptions}
      />
    </main>
  );
}

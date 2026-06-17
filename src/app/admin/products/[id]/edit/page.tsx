import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
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

  const product = await getProductDetail(session.user.companyId, id, db);
  if (!product || !product.defaultVariant) {
    notFound();
  }

  const [categoryList, brandList, variants, branchOptions, validation, images] =
    await Promise.all([
      getCachedCategories(),
      getCachedBrands(),
      listVariants(session.user.companyId, id, db),
      listBranchOptions(session.user.companyId, db),
      // Sprint 3.3 aktif — requireImage=true ile vitrin'e açmak için en az 1 görsel zorunlu
      validateForStorefront(session.user.companyId, id, db, {
        requireImage: true,
      }),
      listProductImages(session.user.companyId, id, db),
    ]);

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

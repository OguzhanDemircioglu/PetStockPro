import { notFound, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { brands, categories } from '@/db/schema';
import { getProductDetail } from '@/lib/catalog/products';
import { listVariants, listBranchOptions } from '@/lib/catalog/variants';
import { validateForStorefront } from '@/lib/catalog/storefront';
import { EditForm } from './form';
import { VariantsSection } from './variants-section';
import { StorefrontSection } from './storefront-section';

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

  const [categoryList, brandList, variants, branchOptions, validation] =
    await Promise.all([
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
      listVariants(session.user.companyId, id, db),
      listBranchOptions(session.user.companyId, db),
      // NOT: requireImage false — Sprint 3.3 image upload aktif olunca true yapılır
      validateForStorefront(session.user.companyId, id, db, {
        requireImage: false,
      }),
    ]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
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

      <VariantsSection
        productId={product.id}
        variants={variants}
        branches={branchOptions}
      />
    </main>
  );
}

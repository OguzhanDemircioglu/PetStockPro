import { redirect } from 'next/navigation';
import { eq, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { categories, brands, products, productVariants } from '@/db/schema';
import { planProductLimit } from '@/lib/constants/plan-limits';
import { companies } from '@/db/schema';
import { ImportClient } from './client';

export default async function ProductImportPage() {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);
  const companyId = session.user.companyId;

  const [cats, brs, existingNames, existingSkus, existingBarcodes, [comp]] = await Promise.all([
    db
      .select({ name: categories.name, sktRequired: categories.sktRequired })
      .from(categories)
      .where(eq(categories.companyId, companyId)),
    db.select({ name: brands.name }).from(brands).where(eq(brands.companyId, companyId)),
    db
      .select({ name: products.name })
      .from(products)
      .where(eq(products.companyId, companyId)),
    db
      .select({ sku: productVariants.sku })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(eq(products.companyId, companyId)),
    db
      .select({ barcode: productVariants.barcode })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(eq(products.companyId, companyId)),
    db
      .select({ plan: companies.plan, productCount: sql<number>`(SELECT COUNT(*)::int FROM petstockpro.products WHERE company_id = ${companyId} AND deleted_at IS NULL)` })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1),
  ]);

  const planLimit = planProductLimit(comp?.plan ?? 'FREE');

  return (
    <ImportClient
      existingCategoryNames={cats.map((c) => c.name)}
      sktRequiredCategoryNames={cats.filter((c) => c.sktRequired).map((c) => c.name)}
      existingBrandNames={brs.map((b) => b.name)}
      existingProductNames={existingNames.map((p) => p.name)}
      existingSkus={existingSkus.map((s) => s.sku)}
      existingBarcodes={existingBarcodes.map((b) => b.barcode).filter((x): x is string => !!x)}
      planLimit={planLimit === Infinity ? -1 : planLimit}
      currentProductCount={comp?.productCount ?? 0}
    />
  );
}

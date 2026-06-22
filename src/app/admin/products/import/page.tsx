import { redirect } from 'next/navigation';
import Link from 'next/link';
import { eq, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { withTenant } from '@/lib/db/with-tenant';
import { categories, brands, products, productVariants } from '@/db/schema';
import { planProductLimit } from '@/lib/constants/plan-limits';
import { hasExcelImport } from '@/lib/billing/plan-features';
import { companies } from '@/db/schema';
import { ImportClient } from './client';

export default async function ProductImportPage() {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);
  const companyId = session.user.companyId;

  // 2026-05-22 Karar A revize — Excel import sadece PRO + PRO+
  // FREE plan'da manuel ürün ekleme yeterli (50 ürün elle ekleme makul).
  const [companyPlan] = await withTenant(companyId, (tx) =>
    tx
      .select({ plan: companies.plan })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1),
  );
  if (!hasExcelImport(companyPlan?.plan ?? 'FREE')) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
        <header>
          <Link
            href={'/admin/products' as never}
            className="text-xs text-ink-4 hover:text-cart"
          >
            ← Ürünlere dön
          </Link>
          <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-cart">
            Excel ile toplu ürün import
          </h1>
        </header>
        <div className="rounded-2xl border-2 border-cat/40 bg-cat-soft/30 p-6">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-cat px-3 py-1 text-[12px] font-bold uppercase tracking-wider text-white">
            ⭐ PRO Özelliği
          </div>
          <h2 className="text-xl font-bold text-cart">
            Excel ile ürün import PRO planında
          </h2>
          <p className="mt-3 text-sm text-ink-2">
            FREE planında 50 ürünü manuel olarak ekleyebilirsin
            (<Link href={'/admin/products/new' as never} className="font-bold text-cat underline">Yeni ürün</Link>{' '}
            sayfasından). PRO planında Excel ile <strong>500 ürün toplu</strong> import + brand
            otomatik oluşturma + initial stock yükleme yapabilirsin.
          </p>
          <div className="mt-5 flex gap-3">
            <Link
              href={'/admin/settings' as never}
              className="rounded-xl bg-cat px-5 py-2.5 text-sm font-bold text-white hover:bg-cat/90"
            >
              PRO&apos;ya geç →
            </Link>
            <Link
              href={'/admin/products/new' as never}
              className="rounded-xl border border-line bg-paper px-5 py-2.5 text-sm font-bold text-cart hover:bg-cat-soft"
            >
              Manuel ekle
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const [cats, brs, existingNames, existingSkus, existingBarcodes, [comp]] = await withTenant(
    companyId,
    (tx) =>
      Promise.all([
        tx
          .select({ name: categories.name, sktRequired: categories.sktRequired })
          .from(categories),
        tx.select({ name: brands.name }).from(brands),
        tx
          .select({ name: products.name })
          .from(products)
          .where(eq(products.companyId, companyId)),
        tx
          .select({ sku: productVariants.sku })
          .from(productVariants)
          .innerJoin(products, eq(products.id, productVariants.productId))
          .where(eq(products.companyId, companyId)),
        tx
          .select({ barcode: productVariants.barcode })
          .from(productVariants)
          .innerJoin(products, eq(products.id, productVariants.productId))
          .where(eq(products.companyId, companyId)),
        tx
          .select({ plan: companies.plan, productCount: sql<number>`(SELECT COUNT(*)::int FROM petstockpro.products WHERE company_id = ${companyId} AND deleted_at IS NULL)` })
          .from(companies)
          .where(eq(companies.id, companyId))
          .limit(1),
      ]),
  );

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

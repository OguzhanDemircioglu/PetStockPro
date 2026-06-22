import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { withTenant } from '@/lib/db/with-tenant';
import { listProducts } from '@/lib/catalog/products';
import { xlsxResponse } from '@/lib/utils/xlsx';
import { companies } from '@/db/schema';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.companyId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(req.url);
  const query = url.searchParams.get('q') ?? undefined;
  const categoryId = url.searchParams.get('category') ?? undefined;
  const brandId = url.searchParams.get('brand') ?? undefined;
  const statusRaw = url.searchParams.get('status');
  const status =
    statusRaw === 'active' || statusRaw === 'inactive' || statusRaw === 'all'
      ? statusRaw
      : undefined;
  const vitrinRaw = url.searchParams.get('vitrin');
  const vitrinPublished =
    vitrinRaw === 'on' ? true : vitrinRaw === 'off' ? false : undefined;

  const companyId = session.user.companyId;
  const [items, [tenant]] = await withTenant(companyId, (tx) =>
    Promise.all([
      listProducts(companyId, tx, {
        query: query || undefined,
        categoryId: categoryId || undefined,
        brandId: brandId || undefined,
        status,
        vitrinPublished,
        limit: 5000,
      }),
      tx
        .select({ name: companies.name })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1),
    ]),
  );

  const filterParts: string[] = [];
  if (query) filterParts.push(`Arama: "${query}"`);
  if (status && status !== 'all') filterParts.push(`Durum: ${status === 'active' ? 'Aktif' : 'Pasif'}`);
  if (vitrinPublished === true) filterParts.push('Vitrin: Açık');
  if (vitrinPublished === false) filterParts.push('Vitrin: Kapalı');

  return xlsxResponse(`urunler-${new Date().toISOString().slice(0, 10)}`, {
    sheetName: 'Ürünler',
    title: '🛍 Ürün Listesi',
    subtitle: `Toplam ${items.length} kayıt`,
    metadata: {
      tenantName: tenant?.name,
      generatedAt: new Date(),
      filterSummary: filterParts.length > 0 ? filterParts.join(' · ') : 'Tüm ürünler',
    },
    columns: [
      { key: 'name', header: 'Ürün Adı', width: 40, format: 'text' },
      { key: 'slug', header: 'Slug', width: 28, format: 'text' },
      { key: (r) => r.categoryName ?? '—', header: 'Kategori', width: 22 },
      { key: (r) => r.brandName ?? '—', header: 'Marka', width: 18 },
      { key: 'variantCount', header: 'Aktif Variant', width: 14, format: 'integer' },
      { key: 'totalStockQty', header: 'Toplam Stok', width: 14, format: 'integer' },
      { key: (r) => (r.defaultSalePrice ? Number(r.defaultSalePrice) : null), header: 'Satış Fiyatı (₺)', width: 18, format: 'currency_try' },
      { key: (r) => (r.vitrinPublished ? 'Açık' : 'Kapalı'), header: 'Vitrin', width: 12, align: 'center' },
      { key: (r) => (r.isActive ? 'Aktif' : 'Pasif'), header: 'Durum', width: 10, align: 'center' },
      { key: (r) => new Date(r.createdAt), header: 'Oluşturma', width: 14, format: 'date_tr' },
    ],
    rows: items,
  });
}

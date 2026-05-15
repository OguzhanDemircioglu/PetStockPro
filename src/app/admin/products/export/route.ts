import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { listProducts } from '@/lib/catalog/products';
import { csvResponseBody } from '@/lib/utils/csv';

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

  const items = await listProducts(session.user.companyId, db, {
    query: query || undefined,
    categoryId: categoryId || undefined,
    brandId: brandId || undefined,
    status,
    vitrinPublished,
    limit: 5000,
  });

  const body = csvResponseBody(
    [
      'Ürün',
      'Slug',
      'Kategori',
      'Marka',
      'Aktif Variant',
      'Toplam Stok',
      'Default Fiyat (₺)',
      'Vitrin',
      'Durum',
      'Oluşturma',
    ],
    items.map((i) => [
      i.name,
      i.slug,
      i.categoryName ?? '',
      i.brandName ?? '',
      i.variantCount,
      i.totalStockQty,
      i.defaultSalePrice ?? '',
      i.vitrinPublished ? 'Açık' : 'Kapalı',
      i.isActive ? 'Aktif' : 'Pasif',
      new Date(i.createdAt).toISOString().slice(0, 10),
    ]),
  );

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="urunler-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

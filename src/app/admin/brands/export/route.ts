import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { listBrands } from '@/lib/brands/manage';
import { csvResponseBody } from '@/lib/utils/csv';

export async function GET() {
  const session = await auth();
  if (!session?.user?.companyId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const items = await listBrands(session.user.companyId, db);

  const body = csvResponseBody(
    ['Marka', 'Slug', 'Logo URL', 'Ürün Sayısı', 'Oluşturma'],
    items.map((b) => [
      b.name,
      b.slug,
      b.logoUrl ?? '',
      b.productCount,
      new Date(b.createdAt).toISOString().slice(0, 10),
    ]),
  );

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="markalar-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

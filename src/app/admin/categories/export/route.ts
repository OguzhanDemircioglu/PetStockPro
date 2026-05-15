import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { listCategories } from '@/lib/categories/manage';
import { csvResponseBody } from '@/lib/utils/csv';

export async function GET() {
  const session = await auth();
  if (!session?.user?.companyId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const items = await listCategories(session.user.companyId, db);

  const body = csvResponseBody(
    ['Emoji', 'Kategori', 'Slug', 'KDV (%)', 'SKT Zorunlu', 'Sıra', 'Ürün Sayısı'],
    items.map((c) => [
      c.emoji ?? '',
      c.name,
      c.slug,
      c.vatRate ?? '',
      c.sktRequired ? 'Evet' : '',
      c.displayOrder,
      c.productCount,
    ]),
  );

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="kategoriler-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

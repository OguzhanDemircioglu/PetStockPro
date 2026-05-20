import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { listCategories } from '@/lib/categories/manage';
import { isSuperadmin } from '@/lib/superadmin/access';
import { xlsxResponse } from '@/lib/utils/xlsx';
import { companies } from '@/db/schema';

export async function GET() {
  const session = await auth();
  if (!session?.user?.companyId) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!isSuperadmin(session)) {
    return new Response('Forbidden — SUPERADMIN only', { status: 403 });
  }

  const [items, [tenant]] = await Promise.all([
    listCategories(session.user.companyId, db),
    db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, session.user.companyId))
      .limit(1),
  ]);

  return xlsxResponse(`kategoriler-${new Date().toISOString().slice(0, 10)}`, {
    sheetName: 'Kategoriler',
    title: '📂 Kategori Listesi',
    subtitle: `Toplam ${items.length} kategori (SUPERADMIN export)`,
    metadata: {
      tenantName: tenant?.name,
      generatedAt: new Date(),
    },
    columns: [
      { key: (r) => r.emoji ?? '', header: 'Emoji', width: 8, align: 'center' },
      { key: 'name', header: 'Kategori Adı', width: 28 },
      { key: 'slug', header: 'Slug', width: 24 },
      { key: (r) => (r.sktRequired ? 'Evet' : 'Hayır'), header: 'SKT Zorunlu', width: 14, align: 'center' },
      { key: 'displayOrder', header: 'Sıra', width: 10, format: 'integer' },
      { key: 'productCount', header: 'Ürün Sayısı', width: 14, format: 'integer' },
    ],
    rows: items,
  });
}

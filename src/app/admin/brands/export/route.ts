import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { listBrands } from '@/lib/brands/manage';
import { xlsxResponse } from '@/lib/utils/xlsx';
import { companies } from '@/db/schema';

export async function GET() {
  const session = await auth();
  if (!session?.user?.companyId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const [items, [tenant]] = await Promise.all([
    listBrands(session.user.companyId, db),
    db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, session.user.companyId))
      .limit(1),
  ]);

  return xlsxResponse(`markalar-${new Date().toISOString().slice(0, 10)}`, {
    sheetName: 'Markalar',
    title: '🏷 Marka Listesi',
    subtitle: `Toplam ${items.length} marka`,
    metadata: {
      tenantName: tenant?.name,
      generatedAt: new Date(),
    },
    columns: [
      { key: 'name', header: 'Marka Adı', width: 30 },
      { key: 'slug', header: 'Slug', width: 24 },
      { key: (r) => r.logoUrl ?? '—', header: 'Logo URL', width: 36 },
      { key: 'productCount', header: 'Ürün Sayısı', width: 14, format: 'integer' },
      { key: (r) => new Date(r.createdAt), header: 'Oluşturma', width: 14, format: 'date_tr' },
    ],
    rows: items,
  });
}

import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { listBranches } from '@/lib/branches/manage';
import { xlsxResponse } from '@/lib/utils/xlsx';
import { companies } from '@/db/schema';

export async function GET() {
  const session = await auth();
  if (!session?.user?.companyId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const [items, [tenant]] = await Promise.all([
    listBranches(session.user.companyId, db),
    db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, session.user.companyId))
      .limit(1),
  ]);

  return xlsxResponse(`subeler-${new Date().toISOString().slice(0, 10)}`, {
    sheetName: 'Şubeler',
    title: '🏪 Şube Listesi',
    subtitle: `Toplam ${items.length} şube`,
    metadata: {
      tenantName: tenant?.name,
      generatedAt: new Date(),
    },
    columns: [
      { key: 'name', header: 'Şube Adı', width: 24 },
      { key: (r) => r.cityName ?? '—', header: 'Şehir', width: 14 },
      { key: (r) => r.districtName ?? '—', header: 'İlçe', width: 14 },
      { key: (r) => r.address ?? '—', header: 'Adres', width: 40 },
      { key: (r) => r.whatsappPhone ?? '—', header: 'WhatsApp', width: 16 },
      { key: 'variantInventoryCount', header: 'Variant Sayısı', width: 14, format: 'integer' },
      { key: 'totalStockQty', header: 'Toplam Stok', width: 14, format: 'integer' },
      { key: (r) => (r.isActive ? 'Aktif' : 'Pasif'), header: 'Durum', width: 10, align: 'center' },
      { key: (r) => new Date(r.createdAt), header: 'Oluşturma', width: 14, format: 'date_tr' },
    ],
    rows: items,
  });
}

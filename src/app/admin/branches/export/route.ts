import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { listBranches } from '@/lib/branches/manage';
import { csvResponseBody } from '@/lib/utils/csv';

export async function GET() {
  const session = await auth();
  if (!session?.user?.companyId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const items = await listBranches(session.user.companyId, db);

  const body = csvResponseBody(
    [
      'Şube',
      'Şehir',
      'İlçe',
      'Adres',
      'WhatsApp',
      'Aktif Variant',
      'Toplam Stok',
      'Durum',
      'Oluşturma',
    ],
    items.map((b) => [
      b.name,
      b.cityName ?? '',
      b.districtName ?? '',
      b.address ?? '',
      b.whatsappPhone ?? '',
      b.variantInventoryCount,
      b.totalStockQty,
      b.isActive ? 'Aktif' : 'Pasif',
      new Date(b.createdAt).toISOString().slice(0, 10),
    ]),
  );

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="subeler-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

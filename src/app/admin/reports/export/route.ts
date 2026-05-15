import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { dailySalesSummary, topSellingVariants } from '@/lib/reports/sales';
import { csvResponseBody } from '@/lib/utils/csv';

const VALID_RANGES = [7, 30, 90] as const;
const VALID_KINDS = ['daily', 'top'] as const;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.companyId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(req.url);
  const daysRaw = parseInt(url.searchParams.get('days') ?? '30', 10);
  const days = (VALID_RANGES as readonly number[]).includes(daysRaw) ? daysRaw : 30;
  const kindRaw = url.searchParams.get('kind') ?? 'daily';
  const kind = (VALID_KINDS as readonly string[]).includes(kindRaw)
    ? (kindRaw as 'daily' | 'top')
    : 'daily';

  let body: string;
  let filename: string;

  if (kind === 'top') {
    const rows = await topSellingVariants(session.user.companyId, db, days, 50);
    body = csvResponseBody(
      ['Ürün', 'Variant', 'SKU', 'Toplam Adet', 'Toplam Ciro (₺)', 'Satış Sayısı'],
      rows.map((r) => [
        r.productName,
        r.variantLabel,
        r.sku,
        r.totalQty,
        r.totalRevenue,
        r.saleCount,
      ]),
    );
    filename = `en-cok-satan-${days}gun.csv`;
  } else {
    const rows = await dailySalesSummary(session.user.companyId, db, days);
    body = csvResponseBody(
      ['Tarih', 'Adet', 'Ciro (₺)', 'Satış Sayısı'],
      rows.map((r) => [r.day, r.qty, r.revenue, r.count]),
    );
    filename = `gunluk-satis-${days}gun.csv`;
  }

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

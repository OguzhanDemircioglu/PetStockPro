import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { withTenant } from '@/lib/db/with-tenant';
import { dailySalesSummary, topSellingVariants } from '@/lib/reports/sales';
import { xlsxResponse } from '@/lib/utils/xlsx';
import { companies } from '@/db/schema';

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

  const companyId = session.user.companyId;
  const [tenant] = await withTenant(companyId, (tx) =>
    tx
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1),
  );

  if (kind === 'top') {
    const rows = await withTenant(companyId, (tx) =>
      topSellingVariants(companyId, tx, days, 50),
    );
    return xlsxResponse(`en-cok-satan-${days}gun`, {
      sheetName: 'En Çok Satanlar',
      title: '🏆 En Çok Satan Ürünler',
      subtitle: `Son ${days} gün · ${rows.length} variant`,
      metadata: {
        tenantName: tenant?.name,
        generatedAt: new Date(),
        filterSummary: `Pencere: ${days} gün`,
      },
      columns: [
        { key: 'productName', header: 'Ürün', width: 36 },
        { key: 'variantLabel', header: 'Variant', width: 18 },
        { key: 'sku', header: 'SKU', width: 22 },
        { key: 'totalQty', header: 'Toplam Adet', width: 14, format: 'integer' },
        { key: (r) => Number(r.totalRevenue), header: 'Toplam Ciro (₺)', width: 18, format: 'currency_try' },
        { key: 'saleCount', header: 'Satış Sayısı', width: 14, format: 'integer' },
      ],
      rows,
    });
  }

  const rows = await withTenant(companyId, (tx) =>
    dailySalesSummary(companyId, tx, days),
  );
  return xlsxResponse(`gunluk-satis-${days}gun`, {
    sheetName: 'Günlük Satış',
    title: '📈 Günlük Satış Raporu',
    subtitle: `Son ${days} gün · ${rows.length} gün veri`,
    metadata: {
      tenantName: tenant?.name,
      generatedAt: new Date(),
      filterSummary: `Pencere: ${days} gün`,
    },
    columns: [
      { key: (r) => new Date(r.day), header: 'Tarih', width: 14, format: 'date_tr' },
      { key: 'qty', header: 'Adet', width: 12, format: 'integer' },
      { key: (r) => Number(r.revenue), header: 'Ciro (₺)', width: 16, format: 'currency_try' },
      { key: 'count', header: 'Satış Sayısı', width: 14, format: 'integer' },
    ],
    rows,
  });
}

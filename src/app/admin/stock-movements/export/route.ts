import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { listStockMovements } from '@/lib/stock/list';
import { xlsxResponse } from '@/lib/utils/xlsx';
import { companies } from '@/db/schema';

const VALID_TYPES = [
  'stock_in',
  'stock_out',
  'transfer',
  'stocktake',
  'stocktake_initial',
] as const;
type MovementType = (typeof VALID_TYPES)[number];

const TYPE_TR: Record<string, string> = {
  stock_in: '📥 Giriş',
  stock_out: '📤 Çıkış',
  transfer: '🔁 Transfer',
  stocktake: '📋 Sayım',
  stocktake_initial: '📋 İlk Sayım',
};

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.companyId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(req.url);
  const branchId = url.searchParams.get('branch') ?? undefined;
  const variantId = url.searchParams.get('variant') ?? undefined;
  const typeRaw = url.searchParams.get('type');
  const type =
    typeRaw && (VALID_TYPES as readonly string[]).includes(typeRaw)
      ? (typeRaw as MovementType)
      : undefined;

  const [rows, [tenant]] = await Promise.all([
    listStockMovements(session.user.companyId, db, {
      branchId: branchId || undefined,
      variantId: variantId || undefined,
      type,
      limit: 5000,
    }),
    db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, session.user.companyId))
      .limit(1),
  ]);

  const filterParts: string[] = [];
  if (type) filterParts.push(`Tür: ${TYPE_TR[type] ?? type}`);
  if (branchId) filterParts.push('Şube filtresi aktif');
  if (variantId) filterParts.push('Variant filtresi aktif');

  return xlsxResponse(`stok-hareketleri-${new Date().toISOString().slice(0, 10)}`, {
    sheetName: 'Stok Hareketleri',
    title: '📦 Stok Hareketleri (Ledger)',
    subtitle: `Son ${rows.length} hareket`,
    metadata: {
      tenantName: tenant?.name,
      generatedAt: new Date(),
      filterSummary: filterParts.length > 0 ? filterParts.join(' · ') : 'Tüm hareketler',
    },
    columns: [
      { key: (r) => new Date(r.createdAt), header: 'Tarih', width: 18, format: 'datetime_tr' },
      { key: (r) => TYPE_TR[r.type] ?? r.type, header: 'Tür', width: 14 },
      { key: (r) => r.subtype ?? '—', header: 'Alt Tür', width: 14 },
      { key: 'branchName', header: 'Şube', width: 18 },
      { key: 'productName', header: 'Ürün', width: 32 },
      { key: 'variantLabel', header: 'Variant', width: 16 },
      { key: 'beforeQty', header: 'Önce', width: 10, format: 'integer' },
      { key: 'quantity', header: 'Δ', width: 8, format: 'integer' },
      { key: 'afterQty', header: 'Sonra', width: 10, format: 'integer' },
      { key: (r) => (r.unitCost ? Number(r.unitCost) : null), header: 'Birim Alış (₺)', width: 16, format: 'currency_try' },
      { key: (r) => (r.unitPrice ? Number(r.unitPrice) : null), header: 'Birim Satış (₺)', width: 16, format: 'currency_try' },
      { key: (r) => r.customerRef ?? '—', header: 'Müşteri', width: 22 },
      { key: (r) => r.paymentMethod ?? '—', header: 'Ödeme', width: 14 },
      { key: (r) => r.supplierName ?? '—', header: 'Tedarikçi', width: 22 },
      { key: (r) => r.documentNo ?? '—', header: 'Belge No', width: 16 },
      { key: (r) => r.reason ?? '—', header: 'Sebep', width: 22 },
      { key: (r) => r.note ?? '—', header: 'Not', width: 26 },
      { key: (r) => r.performedBy ?? '—', header: 'Kullanıcı', width: 22 },
      { key: (r) => (r.reversedById ? '✓' : ''), header: 'Geri alındı', width: 12, align: 'center' },
      { key: (r) => (r.reversesId ? '✓' : ''), header: 'Geri alma', width: 12, align: 'center' },
    ],
    rows,
  });
}

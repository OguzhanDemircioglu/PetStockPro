import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { listStockMovements } from '@/lib/stock/list';
import { csvResponseBody } from '@/lib/utils/csv';

const VALID_TYPES = [
  'stock_in',
  'stock_out',
  'transfer',
  'stocktake',
  'stocktake_initial',
] as const;
type MovementType = (typeof VALID_TYPES)[number];

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

  const rows = await listStockMovements(session.user.companyId, db, {
    branchId: branchId || undefined,
    variantId: variantId || undefined,
    type,
    limit: 5000,
  });

  const body = csvResponseBody(
    [
      'Tarih',
      'Tür',
      'Subtür',
      'Şube',
      'Ürün',
      'Variant',
      'Önce',
      'Δ',
      'Sonra',
      'Birim Alış (₺)',
      'Birim Satış (₺)',
      'Müşteri',
      'Ödeme',
      'Tedarikçi',
      'Belge No',
      'Sebep',
      'Not',
      'Kullanıcı',
      'Geri alındı mı',
      'Geri alma mı',
    ],
    rows.map((r) => [
      new Date(r.createdAt).toISOString(),
      r.type,
      r.subtype ?? '',
      r.branchName,
      r.productName,
      r.variantLabel,
      r.beforeQty,
      r.quantity,
      r.afterQty,
      r.unitCost ?? '',
      r.unitPrice ?? '',
      r.customerRef ?? '',
      r.paymentMethod ?? '',
      r.supplierName ?? '',
      r.documentNo ?? '',
      r.reason ?? '',
      r.note ?? '',
      r.performedBy ?? '',
      r.reversedById ? 'Evet' : '',
      r.reversesId ? 'Evet' : '',
    ]),
  );

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="stok-hareketleri-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

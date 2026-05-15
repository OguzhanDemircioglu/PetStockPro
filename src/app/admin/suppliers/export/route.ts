import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { listSuppliers } from '@/lib/suppliers/manage';
import { csvResponseBody } from '@/lib/utils/csv';

const PAYMENT_TR: Record<string, string> = {
  cash: 'Peşin',
  net_30: '30 gün vadeli',
  net_60: '60 gün vadeli',
  other: 'Diğer',
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.companyId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const items = await listSuppliers(session.user.companyId, db);

  const body = csvResponseBody(
    [
      'Tedarikçi',
      'VKN',
      'Vergi Dairesi',
      'Yetkili',
      'Telefon',
      'E-posta',
      'Şehir',
      'İlçe',
      'Lead Time (gün)',
      'Ödeme Koşulu',
      'IBAN',
      'Toplam Giriş Adedi',
      'Durum',
    ],
    items.map((s) => [
      s.name,
      s.vatNo ?? '',
      s.vatOffice ?? '',
      s.contactName ?? '',
      s.phone ?? '',
      s.email ?? '',
      s.city ?? '',
      s.district ?? '',
      s.leadTimeDays,
      PAYMENT_TR[s.paymentTerms] ?? s.paymentTerms,
      s.iban ?? '',
      s.totalIncomingQty,
      s.isActive ? 'Aktif' : 'Pasif',
    ]),
  );

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="tedarikciler-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

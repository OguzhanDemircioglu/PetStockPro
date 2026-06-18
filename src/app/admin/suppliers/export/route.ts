import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { withTenant } from '@/lib/db/with-tenant';
import { listSuppliers } from '@/lib/suppliers/manage';
import { xlsxResponse } from '@/lib/utils/xlsx';
import { companies } from '@/db/schema';

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

  const companyId = session.user.companyId;
  const [items, [tenant]] = await withTenant(companyId, (tx) =>
    Promise.all([
      listSuppliers(companyId, tx),
      tx
        .select({ name: companies.name })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1),
    ]),
  );

  return xlsxResponse(`tedarikciler-${new Date().toISOString().slice(0, 10)}`, {
    sheetName: 'Tedarikçiler',
    title: '🏢 Tedarikçi Listesi',
    subtitle: `Toplam ${items.length} tedarikçi`,
    metadata: {
      tenantName: tenant?.name,
      generatedAt: new Date(),
    },
    columns: [
      { key: 'name', header: 'Tedarikçi Adı', width: 28 },
      { key: (r) => r.vatNo ?? '—', header: 'VKN', width: 14 },
      { key: (r) => r.vatOffice ?? '—', header: 'Vergi Dairesi', width: 20 },
      { key: (r) => r.contactName ?? '—', header: 'Yetkili Kişi', width: 22 },
      { key: (r) => r.phone ?? '—', header: 'Telefon', width: 18 },
      { key: (r) => r.email ?? '—', header: 'E-posta', width: 26 },
      { key: (r) => r.city ?? '—', header: 'Şehir', width: 14 },
      { key: (r) => r.district ?? '—', header: 'İlçe', width: 14 },
      { key: 'leadTimeDays', header: 'Lead Time (gün)', width: 16, format: 'integer' },
      { key: (r) => PAYMENT_TR[r.paymentTerms] ?? r.paymentTerms, header: 'Ödeme Koşulu', width: 18 },
      { key: (r) => r.iban ?? '—', header: 'IBAN', width: 32 },
      { key: 'totalIncomingQty', header: 'Toplam Giriş', width: 14, format: 'integer' },
      { key: (r) => (r.isActive ? 'Aktif' : 'Pasif'), header: 'Durum', width: 10, align: 'center' },
    ],
    rows: items,
  });
}

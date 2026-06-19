import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { withTenant } from '@/lib/db/with-tenant';
import { listAuditLogs } from '@/lib/audit/list';
import { xlsxResponse } from '@/lib/utils/xlsx';
import { companies } from '@/db/schema';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.companyId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? undefined;
  const entityType = url.searchParams.get('entity') ?? undefined;
  const userId = url.searchParams.get('userId') ?? undefined;
  const fromDate = url.searchParams.get('from') ?? undefined;
  const toDate = url.searchParams.get('to') ?? undefined;

  const companyId = session.user.companyId;
  const [rows, [tenant]] = await withTenant(companyId, (tx) =>
    Promise.all([
      listAuditLogs(companyId, tx, {
        limit: 5000,
        action: action || undefined,
        entityType: entityType || undefined,
        userId: userId || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      }),
      tx
        .select({ name: companies.name })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1),
    ]),
  );

  const filterParts: string[] = [];
  if (action) filterParts.push(`Aksiyon: ${action}`);
  if (entityType) filterParts.push(`Hedef türü: ${entityType}`);
  if (fromDate) filterParts.push(`Başlangıç: ${fromDate}`);
  if (toDate) filterParts.push(`Bitiş: ${toDate}`);

  return xlsxResponse(`audit-log-${new Date().toISOString().slice(0, 10)}`, {
    sheetName: 'Audit Log',
    title: '📜 Denetim Kayıtları',
    subtitle: `Son ${rows.length} kayıt`,
    metadata: {
      tenantName: tenant?.name,
      generatedAt: new Date(),
      filterSummary: filterParts.length > 0 ? filterParts.join(' · ') : 'Tüm kayıtlar',
    },
    columns: [
      { key: (r) => new Date(r.createdAt), header: 'Tarih', width: 18, format: 'datetime_tr' },
      { key: 'action', header: 'Aksiyon', width: 24 },
      { key: (r) => r.userEmail ?? '—', header: 'Kullanıcı', width: 28 },
      { key: (r) => r.entityType ?? '—', header: 'Hedef Türü', width: 18 },
      { key: (r) => r.entityId ?? '—', header: 'Hedef ID', width: 36 },
      { key: (r) => (r.performedAsSuperadmin ? '✓' : '✕'), header: 'Süperadmin', width: 12, align: 'center' },
      { key: (r) => r.superadminReason ?? '—', header: 'Süperadmin Sebep', width: 28 },
      { key: (r) => (r.afterState ? JSON.stringify(r.afterState) : '—'), header: 'After State (JSON)', width: 60 },
    ],
    rows,
  });
}

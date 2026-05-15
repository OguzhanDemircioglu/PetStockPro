import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { listAuditLogs } from '@/lib/audit/list';
import { csvResponseBody } from '@/lib/utils/csv';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.companyId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? undefined;
  const entityType = url.searchParams.get('entity') ?? undefined;

  const rows = await listAuditLogs(session.user.companyId, db, {
    limit: 5000,
    action: action || undefined,
    entityType: entityType || undefined,
  });

  const body = csvResponseBody(
    [
      'Tarih',
      'Aksiyon',
      'Kullanıcı',
      'Hedef Türü',
      'Hedef ID',
      'Süperadmin',
      'Süperadmin Sebep',
      'After State (JSON)',
    ],
    rows.map((r) => [
      new Date(r.createdAt).toISOString(),
      r.action,
      r.userEmail ?? '',
      r.entityType ?? '',
      r.entityId ?? '',
      r.performedAsSuperadmin ? 'Evet' : '',
      r.superadminReason ?? '',
      r.afterState ? JSON.stringify(r.afterState) : '',
    ]),
  );

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

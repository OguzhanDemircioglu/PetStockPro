import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { executeImport, type ImportRowInput } from '@/lib/products/import-execute';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.companyId) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  // Yalnızca BAYI_SAHIBI veya SUPERADMIN
  if (session.user.role !== 'BAYI_SAHIBI' && session.user.role !== 'SUPERADMIN') {
    return Response.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  let body: { rows?: ImportRowInput[] };
  try {
    body = (await req.json()) as { rows?: ImportRowInput[] };
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  if (!Array.isArray(body.rows)) {
    return Response.json({ ok: false, error: 'rows must be array' }, { status: 400 });
  }

  const result = await executeImport({
    companyId: session.user.companyId,
    userId: session.user.id,
    rows: body.rows,
    db,
  });

  return Response.json(result, { status: result.ok ? 200 : 400 });
}

'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { requireSuperadmin } from '@/lib/superadmin/access';
import { writeBypassAudit } from '@/lib/superadmin/bypass';
import {
  runInspectorSelect,
  type DbInspectorResult,
} from '@/lib/superadmin/db-inspector';

export interface DbInspectorState {
  ok?: boolean;
  error?: string;
  issues?: string[];
  sql?: string;
  rows?: Record<string, unknown>[];
  columns?: string[];
  rowCount?: number;
  truncated?: boolean;
  durationMs?: number;
}

const inputSchema = z.object({
  sql: z.string().min(10, 'Query çok kısa').max(2000, 'Query 2000 char ile sınırlı'),
});

export async function runInspectorQueryAction(
  _prev: DbInspectorState | null,
  formData: FormData,
): Promise<DbInspectorState> {
  await requireSuperadmin();
  const session = await auth();
  if (!session?.user?.id || !session.user.companyId) redirect('/login' as never);

  const sqlRaw = String(formData.get('sql') ?? '');
  const parsed = inputSchema.safeParse({ sql: sqlRaw });
  if (!parsed.success) {
    return {
      error: 'Form geçersiz',
      issues: parsed.error.issues.map((i) => i.message),
      sql: sqlRaw,
    };
  }

  const connStr = process.env.DATABASE_URL;
  if (!connStr) {
    return { error: 'DATABASE_URL env eksik', sql: sqlRaw };
  }

  const result: DbInspectorResult = await runInspectorSelect(parsed.data, connStr);

  if (!result.ok) {
    const reasonMessages: Record<string, string> = {
      invalid_input: 'Lib validation hatası',
      forbidden_keyword: `Yasak komut: ${('keyword' in result && result.keyword) || ''}`,
      multiple_statements: 'Tek statement çalıştırılabilir (; chain attack engellendi)',
      not_select: 'Sadece SELECT veya WITH (CTE) ile başlayan query kabul edilir',
      timeout: 'Query 5 saniye içinde tamamlanmadı (timeout)',
      sql_error:
        'message' in result ? `SQL hatası: ${result.message}` : 'SQL hatası',
    };

    // Forbidden keyword + non-select + multiple_statements'i bile audit'e yazalım — saldırı izi.
    await writeBypassAudit({
      companyId: session.user.companyId,
      superadminUserId: session.user.id,
      action: 'superadmin.dbinspector.query_failed',
      entityType: 'dbinspector',
      reason: `Query reject: ${result.reason}`,
      beforeState: { sql: sqlRaw },
      afterState: { reason: result.reason },
      db,
    });

    return {
      error: reasonMessages[result.reason] ?? 'Bilinmeyen hata',
      sql: sqlRaw,
      issues: 'issues' in result ? result.issues : undefined,
    };
  }

  // Başarılı: audit log (success path)
  await writeBypassAudit({
    companyId: session.user.companyId,
    superadminUserId: session.user.id,
    action: 'superadmin.dbinspector.query_run',
    entityType: 'dbinspector',
    reason: `SELECT ran: ${parsed.data.sql.slice(0, 100)}`,
    afterState: {
      rowCount: result.rowCount,
      truncated: result.truncated,
      durationMs: result.durationMs,
      columnCount: result.columns.length,
    },
    db,
  });

  return {
    ok: true,
    sql: sqlRaw,
    rows: result.rows,
    columns: result.columns,
    rowCount: result.rowCount,
    truncated: result.truncated,
    durationMs: result.durationMs,
  };
}

/**
 * Süperadmin DB sağlık istatistikleri — Sprint 7c'ye doğru hazırlık.
 *
 * pg_database_size + pg_class size sorguları → disk doluluğu + top tablolar.
 * Supabase plan limit'leri (FREE: 500MB, PRO: 8GB) ile karşılaştırma.
 */

import { sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';

export interface DatabaseStats {
  totalSizeBytes: number;
  totalSizePretty: string;
  /** Plan limit MB (FREE=500, PRO=8192). */
  planLimitMb: number;
  usagePct: number; // 0-100
  topTables: { name: string; bytes: number; sizePretty: string }[];
  connectionCount: number;
}

const SUPABASE_PLAN_LIMIT_MB = 500; // FREE tier default; Pro $25/ay'a geçince 8192
const PETSTOCKPRO_SCHEMA = 'petstockpro';

export async function getDatabaseStats(db: DbClient): Promise<DatabaseStats> {
  // 1. DB total size + connection count tek query
  const summaryRows = await db
    .select({
      totalSizeBytes: sql<number>`pg_database_size(current_database())::bigint`,
      totalSizePretty: sql<string>`pg_size_pretty(pg_database_size(current_database()))`,
      connectionCount: sql<number>`(SELECT COUNT(*)::int FROM pg_stat_activity WHERE datname = current_database())`,
    })
    .from(sql`(SELECT 1) AS dummy`);

  const summary = summaryRows[0] ?? {
    totalSizeBytes: 0,
    totalSizePretty: '0 bytes',
    connectionCount: 0,
  };

  // 2. petstockpro schema top tablolar
  const topRows = await db
    .select({
      name: sql<string>`c.relname`,
      bytes: sql<number>`pg_total_relation_size(c.oid)::bigint`,
      sizePretty: sql<string>`pg_size_pretty(pg_total_relation_size(c.oid))`,
    })
    .from(
      sql`pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace`,
    )
    .where(
      sql`n.nspname = ${PETSTOCKPRO_SCHEMA} AND c.relkind = 'r'`,
    )
    .orderBy(sql`pg_total_relation_size(c.oid) DESC`)
    .limit(8);

  const totalSizeBytes = Number(summary.totalSizeBytes);
  const planLimitBytes = SUPABASE_PLAN_LIMIT_MB * 1024 * 1024;
  const usagePct = planLimitBytes > 0 ? Math.round((totalSizeBytes / planLimitBytes) * 10000) / 100 : 0;

  return {
    totalSizeBytes,
    totalSizePretty: summary.totalSizePretty,
    planLimitMb: SUPABASE_PLAN_LIMIT_MB,
    usagePct,
    topTables: topRows.map((r) => ({
      name: r.name,
      bytes: Number(r.bytes),
      sizePretty: r.sizePretty,
    })),
    connectionCount: Number(summary.connectionCount),
  };
}

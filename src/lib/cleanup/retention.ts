/**
 * Log retention cleanup (PLAN-BETA-PERFORMANCE FAZ 2.A).
 *
 * Workers cron `0 4 * * *` (04:00 UTC / 07:00 TR) /api/cron/cleanup-old-logs
 * üzerinden runRetentionCleanup() çağırır.
 *
 * Tabloya özel TTL — KVKK + yasal saklama gözetilerek seçildi:
 *   - system_errors           90 gün (DEPLOYMENT §8 retention)
 *   - vitrin_events          365 gün (KVKK anonim analytics)
 *   - processed_webhooks      90 gün (Idempotency guard)
 *   - notifications           90 gün (sadece is_read=true)
 *   - vitrin_reports         365 gün (sadece status<>pending)
 *   - vitrin_whatsapp_feedback 365 gün
 *
 * ASLA silinmez (KVKK 5 yıl + vergi 10 yıl):
 *   - audit_logs, invoices, subscriptions
 * Regression test (`retention.test.ts`) bunları guard eder.
 */
import { sql, type SQL } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';

export interface RetentionRule {
  table: string;
  ageDays: number;
  whereExtra?: SQL | undefined;
  description: string;
}

export const RETENTION_RULES: readonly RetentionRule[] = [
  {
    table: 'system_errors',
    ageDays: 90,
    description: 'Hata logları (Sentry replacement)',
  },
  {
    table: 'vitrin_events',
    ageDays: 365,
    description: 'Anonim analytics (KVKK uyumlu)',
  },
  {
    table: 'processed_webhooks',
    ageDays: 90,
    description: 'PayTR/Nilvera webhook idempotency guard',
  },
  {
    table: 'notifications',
    ageDays: 90,
    whereExtra: sql`is_read = true`,
    description: 'Okunmuş bildirim feed',
  },
  {
    table: 'vitrin_reports',
    ageDays: 365,
    whereExtra: sql`status <> 'pending'`,
    description: 'Resolved vitrin şikayetleri',
  },
  {
    table: 'vitrin_whatsapp_feedback',
    ageDays: 365,
    description: 'WhatsApp geri bildirim balonu',
  },
];

export interface CleanupRuleResult {
  table: string;
  ageDays: number;
  deletedCount: number;
  durationMs: number;
  error?: string;
}

export interface CleanupReport {
  startedAt: string;
  finishedAt: string;
  totalDeleted: number;
  totalDurationMs: number;
  rules: CleanupRuleResult[];
  hasErrors: boolean;
}

/**
 * Tek tablo için DELETE WHERE created_at < now() - interval.
 * Hata yutulur, raporda `error` field doldurulur (cron diğer tabloları
 * yine de temizler).
 */
async function cleanupOne(
  db: DbClient,
  rule: RetentionRule,
  now: Date,
): Promise<CleanupRuleResult> {
  const t0 = Date.now();
  const cutoffIso = new Date(now.getTime() - rule.ageDays * 86_400_000).toISOString();
  const tableRef = sql.raw(`"petstockpro"."${rule.table}"`);
  const whereClause = rule.whereExtra
    ? sql`${rule.whereExtra} AND created_at < ${cutoffIso}::timestamptz`
    : sql`created_at < ${cutoffIso}::timestamptz`;

  try {
    const result = await db.execute(
      sql`DELETE FROM ${tableRef} WHERE ${whereClause}`,
    );
    const deletedCount = readDeletedCount(result);
    return {
      table: rule.table,
      ageDays: rule.ageDays,
      deletedCount,
      durationMs: Date.now() - t0,
    };
  } catch (err) {
    return {
      table: rule.table,
      ageDays: rule.ageDays,
      deletedCount: 0,
      durationMs: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function readDeletedCount(result: unknown): number {
  if (!result || typeof result !== 'object') return 0;
  const r = result as { count?: number; rowCount?: number; length?: number };
  if (typeof r.count === 'number') return r.count;
  if (typeof r.rowCount === 'number') return r.rowCount;
  if (typeof r.length === 'number') return r.length;
  return 0;
}

export async function runRetentionCleanup(
  db: DbClient,
  now: Date = new Date(),
): Promise<CleanupReport> {
  const startedAtMs = Date.now();
  const startedAt = now.toISOString();
  const rules: CleanupRuleResult[] = [];
  let totalDeleted = 0;
  for (const rule of RETENTION_RULES) {
    const r = await cleanupOne(db, rule, now);
    totalDeleted += r.deletedCount;
    rules.push(r);
  }
  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    totalDeleted,
    totalDurationMs: Date.now() - startedAtMs,
    rules,
    hasErrors: rules.some((r) => r.error),
  };
}

/**
 * Süperadmin paneli için: her tablodaki tahmini satır sayısı + en eski
 * kayıt (henüz silinmemiş ama TTL'i geçmiş). Approx çünkü pg_class.reltuples
 * autovacuum'a bağlı; tam sayım küçük tablolarda kabul edilebilir.
 */
export interface RetentionTableStat {
  table: string;
  ageDays: number;
  description: string;
  rowCount: number;
  oldestCreatedAt: string | null;
  hasExpired: boolean;
}

export async function getRetentionStats(db: DbClient): Promise<RetentionTableStat[]> {
  const stats: RetentionTableStat[] = [];
  for (const rule of RETENTION_RULES) {
    const tableRef = sql.raw(`"petstockpro"."${rule.table}"`);
    const cutoffIso = new Date(Date.now() - rule.ageDays * 86_400_000).toISOString();
    try {
      const filter = rule.whereExtra ?? sql`true`;
      const rows = (await db.execute(
        sql`SELECT
          COUNT(*)::int AS row_count,
          MIN(created_at)::text AS oldest_created_at,
          COUNT(*) FILTER (WHERE created_at < ${cutoffIso}::timestamptz)::int AS expired_count
        FROM ${tableRef}
        WHERE ${filter}`,
      )) as unknown as Array<{
        row_count: number;
        oldest_created_at: string | null;
        expired_count: number;
      }>;
      const r = rows[0];
      stats.push({
        table: rule.table,
        ageDays: rule.ageDays,
        description: rule.description,
        rowCount: r?.row_count ?? 0,
        oldestCreatedAt: r?.oldest_created_at ?? null,
        hasExpired: (r?.expired_count ?? 0) > 0,
      });
    } catch {
      // Tablo henüz yoksa (migration apply edilmemişse) graceful skip.
      stats.push({
        table: rule.table,
        ageDays: rule.ageDays,
        description: rule.description,
        rowCount: 0,
        oldestCreatedAt: null,
        hasExpired: false,
      });
    }
  }
  return stats;
}

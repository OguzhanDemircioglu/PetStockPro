/**
 * Error burst threshold check + Telegram alert (FAZ 2.B).
 *
 * Cron 03:55 UTC (06:55 TR) /api/cron/errors-threshold-check tetikler:
 *   1. Her errorType için son 60 dk içinde COUNT
 *   2. COUNT >= 5 → burst
 *   3. Dedup: son 6 saat içinde aynı errorType için alert_sent_at varsa skip
 *   4. Telegram critical alert + alert_sent_at güncelle (en son row)
 *
 * Anti-spam invariant: aynı errorType için günde max 4 alert (6h dedup × 4 = 24h).
 */
import { sql, and, gte, eq } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { systemErrors } from '@/db/schema';

export const BURST_THRESHOLD = 5;
export const BURST_WINDOW_MINUTES = 60;
export const DEDUP_HOURS = 6;

export interface ErrorBurst {
  errorType: string;
  count: number;
  windowMinutes: number;
  firstOccurredAt: string;
  lastOccurredAt: string;
  lastSampleMessage: string;
  lastSampleId: string;
}

export interface BurstCheckOptions {
  now?: Date;
  threshold?: number;
  windowMinutes?: number;
  dedupHours?: number;
}

/**
 * Bursts'ı bul — threshold geçen + dedup penceresinde alert atılmamış olanlar.
 * Cron her 5 dk tetiklense bile (config'e bağlı) aynı errorType için max
 * 4 alert/gün düşer.
 */
export async function findActiveBursts(
  db: DbClient,
  options: BurstCheckOptions = {},
): Promise<ErrorBurst[]> {
  const now = options.now ?? new Date();
  const threshold = options.threshold ?? BURST_THRESHOLD;
  const windowMinutes = options.windowMinutes ?? BURST_WINDOW_MINUTES;
  const dedupHours = options.dedupHours ?? DEDUP_HOURS;

  const windowStart = new Date(now.getTime() - windowMinutes * 60_000);
  const dedupStart = new Date(now.getTime() - dedupHours * 3_600_000);

  const rows = (await db.execute(sql`
    WITH recent AS (
      SELECT error_type,
             COUNT(*)::int AS cnt,
             MIN(created_at) AS first_at,
             MAX(created_at) AS last_at,
             MAX(id::text) AS last_id
      FROM petstockpro.system_errors
      WHERE created_at >= ${windowStart.toISOString()}::timestamptz
      GROUP BY error_type
      HAVING COUNT(*) >= ${threshold}
    ),
    recent_alerts AS (
      SELECT DISTINCT error_type
      FROM petstockpro.system_errors
      WHERE alert_sent_at IS NOT NULL
        AND alert_sent_at >= ${dedupStart.toISOString()}::timestamptz
    )
    SELECT r.error_type,
           r.cnt,
           r.first_at,
           r.last_at,
           r.last_id,
           (SELECT message FROM petstockpro.system_errors s
              WHERE s.id::text = r.last_id
              LIMIT 1) AS last_msg
    FROM recent r
    LEFT JOIN recent_alerts a ON r.error_type = a.error_type
    WHERE a.error_type IS NULL
    ORDER BY r.cnt DESC
  `)) as unknown as Array<{
    error_type: string;
    cnt: number;
    first_at: string | Date;
    last_at: string | Date;
    last_id: string;
    last_msg: string | null;
  }>;

  return rows.map((r) => ({
    errorType: r.error_type,
    count: r.cnt,
    windowMinutes,
    firstOccurredAt: new Date(r.first_at).toISOString(),
    lastOccurredAt: new Date(r.last_at).toISOString(),
    lastSampleMessage: r.last_msg ?? '',
    lastSampleId: r.last_id,
  }));
}

/** Tek satır helper — alert gönderildikten sonra DB'de işaretlemek için. */
export async function markAlertSent(
  db: DbClient,
  errorIds: string[],
  now: Date = new Date(),
): Promise<number> {
  if (errorIds.length === 0) return 0;
  const result = await db
    .update(systemErrors)
    .set({ alertSentAt: now })
    .where(
      and(
        sql`${systemErrors.id}::text = ANY(${errorIds})`,
        eq(systemErrors.alertSentAt, sql`${systemErrors.alertSentAt}` as never),
      ),
    )
    .returning({ id: systemErrors.id });
  return result.length;
}

/**
 * Convenience helper: tek seferde mark — id eşleştirmesi için kullanır.
 * Cron handler bunu kullanır.
 */
export async function markErrorAlerted(
  db: DbClient,
  errorId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const result = await db
    .update(systemErrors)
    .set({ alertSentAt: now })
    .where(eq(systemErrors.id, errorId))
    .returning({ id: systemErrors.id });
  return result.length > 0;
}

/**
 * Son 24h içinde unresolved error sayısı — süperadmin sidebar badge.
 */
export async function countUnresolvedErrors(
  db: DbClient,
  windowHours = 24,
  now: Date = new Date(),
): Promise<number> {
  const windowStart = new Date(now.getTime() - windowHours * 3_600_000);
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(systemErrors)
    .where(
      and(
        eq(systemErrors.resolved, false),
        gte(systemErrors.createdAt, windowStart),
      ),
    );
  return rows[0]?.count ?? 0;
}

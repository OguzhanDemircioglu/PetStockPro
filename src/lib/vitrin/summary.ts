/**
 * Vitrin Şikayet Günlük Özet — Sprint 12 ext.
 *
 * Süperadmin'e 24 saatlik şikayet özetini Telegram'a gönderir.
 * Cron (Workers/pg_cron) ile günlük çağrılır. Anlık dedup alert ile
 * birlikte: dedup spam'i önler, summary "kaçırılan"ı yakalar.
 */

import { and, count, desc, eq, gte, sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { companies, vitrinReports } from '@/db/schema';

export interface DailyReportSummary {
  windowHours: number;
  totalReports: number;
  pendingCount: number;
  resolvedCount: number;
  dismissedCount: number;
  topTenants: Array<{
    companyName: string;
    pendingCount: number;
  }>;
}

const DEFAULT_TOP_LIMIT = 5;

/**
 * Son N saatteki şikayet özeti — Telegram alert için.
 *
 * Pet shop sahibinin kendisi süperadmin'dir (CLAUDE.md #1 kural — tek geliştirici).
 * Bu özet pet shop sahibine sistem geneli görünüm sağlar.
 */
export async function buildDailyReportSummary(
  db: DbClient,
  windowHours: number = 24,
  now: Date = new Date(),
): Promise<DailyReportSummary> {
  const cutoff = new Date(now.getTime() - windowHours * 60 * 60 * 1000);

  // Status'a göre count
  const statusRows = await db
    .select({
      status: vitrinReports.status,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(vitrinReports)
    .where(gte(vitrinReports.createdAt, cutoff))
    .groupBy(vitrinReports.status);

  let pendingCount = 0;
  let resolvedCount = 0;
  let dismissedCount = 0;
  for (const r of statusRows) {
    if (r.status === 'pending') pendingCount = r.count;
    else if (r.status === 'resolved') resolvedCount = r.count;
    else if (r.status === 'dismissed') dismissedCount = r.count;
  }
  const totalReports = pendingCount + resolvedCount + dismissedCount;

  // Top tenant'lar — pending sayısına göre (acil müdahale için)
  const topRows = await db
    .select({
      companyName: companies.name,
      pendingCount: count(vitrinReports.id),
    })
    .from(vitrinReports)
    .innerJoin(companies, eq(companies.id, vitrinReports.companyId))
    .where(
      and(
        gte(vitrinReports.createdAt, cutoff),
        eq(vitrinReports.status, 'pending'),
      ),
    )
    .groupBy(companies.id, companies.name)
    .orderBy(desc(count(vitrinReports.id)))
    .limit(DEFAULT_TOP_LIMIT);

  return {
    windowHours,
    totalReports,
    pendingCount,
    resolvedCount,
    dismissedCount,
    topTenants: topRows.map((t) => ({
      companyName: t.companyName,
      pendingCount: t.pendingCount,
    })),
  };
}

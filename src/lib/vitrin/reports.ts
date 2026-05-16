/**
 * Vitrin Şikayet Sistemi — EKRAN-PUBLIC-VITRIN §14 modlama.
 *
 * Müşteri vitrin'de "🚩 Bildir" butonuna basar (anon, auth yok).
 * Sebep: wrong_photo / wrong_info / spam / duplicate / inappropriate / closed_shop / other.
 * targetType: 'storefront' (tüm pet shop) veya 'product' (belirli ürün).
 *
 * Süperadmin moderation panelinde queue'da görür → resolved / dismissed.
 *
 * KVKK: reporterIpHash daily-salted (anon).
 */

import { createHash } from 'node:crypto';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { DbClient } from '@/lib/db/client';
import { companies, products, users, vitrinReports } from '@/db/schema';
import { sendTelegramAlert } from '@/lib/telegram/client';
import { buildNewVitrinReportAlert } from '@/lib/telegram/messages';

const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_MAX_PER_WINDOW = 5;

export const reportReasonValues = [
  'wrong_photo',
  'wrong_info',
  'spam',
  'duplicate',
  'inappropriate',
  'closed_shop',
  'other',
] as const;

export const reportStatusValues = ['pending', 'resolved', 'dismissed'] as const;

export const reportTargetTypeValues = ['storefront', 'product'] as const;

export const reportInputSchema = z
  .object({
    companyId: z.string().uuid(),
    targetType: z.enum(reportTargetTypeValues),
    productId: z.string().uuid().nullable().optional(),
    reason: z.enum(reportReasonValues),
    note: z.string().max(1000).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.targetType === 'product' && !val.productId) {
      ctx.addIssue({
        code: 'custom',
        path: ['productId'],
        message: 'targetType=product için productId zorunlu',
      });
    }
    if (val.targetType === 'storefront' && val.productId) {
      ctx.addIssue({
        code: 'custom',
        path: ['productId'],
        message: 'targetType=storefront için productId verilmemeli',
      });
    }
  });

export interface ReportContext {
  ipAddress?: string;
  userAgent?: string;
  countryCode?: string;
}

/**
 * Daily-salted IP hash — KVKK uyumlu anonim tracking.
 */
function hashIp(ip: string, date: Date): string {
  const dailySalt = date.toISOString().slice(0, 10); // YYYY-MM-DD
  return createHash('sha256').update(`${ip}|${dailySalt}`).digest('hex');
}

/**
 * Anon "Bildir" butonu submit'i — yeni şikayet kaydı.
 *
 * Anti-spam rate-limit: aynı IP × tenant × 24h içinde max N şikayet
 * (default 5). Aşılırsa rate_limit_exceeded reject. Cloudflare Workers KV
 * binding production'da daha hızlı olur ama DB-level COUNT MVP için yeter.
 */
export async function submitReport(
  input: z.infer<typeof reportInputSchema>,
  ctx: ReportContext,
  db: DbClient,
  now: Date = new Date(),
): Promise<
  | { ok: true; id: string }
  | {
      ok: false;
      reason: 'invalid_input' | 'rate_limit_exceeded' | 'unknown';
    }
> {
  const parsed = reportInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: 'invalid_input' };
  }

  const ipHash = ctx.ipAddress ? hashIp(ctx.ipAddress, now) : 'unknown';

  // Rate-limit kontrol: aynı IP × tenant × 24h içinde max 5 şikayet.
  // ipHash='unknown' (proxy header yok) durumunda dedup yok (hatalı pozitif önle).
  if (ipHash !== 'unknown') {
    const cutoff = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);
    const countRows = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(vitrinReports)
      .where(
        and(
          eq(vitrinReports.companyId, parsed.data.companyId),
          eq(vitrinReports.reporterIpHash, ipHash),
          gte(vitrinReports.createdAt, cutoff),
        ),
      );
    const currentCount = countRows[0]?.count ?? 0;
    if (currentCount >= RATE_LIMIT_MAX_PER_WINDOW) {
      return { ok: false, reason: 'rate_limit_exceeded' };
    }
  }

  try {
    const rows = await db
      .insert(vitrinReports)
      .values({
        companyId: parsed.data.companyId,
        targetType: parsed.data.targetType,
        productId: parsed.data.productId ?? null,
        reason: parsed.data.reason,
        note: parsed.data.note ?? null,
        reporterIpHash: ipHash,
        countryCode: ctx.countryCode ?? null,
        userAgent: ctx.userAgent ?? null,
        status: 'pending',
        createdAt: now,
      })
      .returning({ id: vitrinReports.id });

    // Süperadmin Telegram alert fire-and-forget (caller blocked olmasın)
    void notifySuperadminOnNewReport(
      parsed.data.companyId,
      parsed.data.targetType,
      parsed.data.productId ?? null,
      parsed.data.reason,
      parsed.data.note ?? null,
      db,
    ).catch(() => {
      // sessiz — alert fail asla caller'ı etkilemesin (Sentry beforeBreadcrumb)
    });

    return { ok: true, id: rows[0].id };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

/**
 * Süperadmin'e yeni şikayet Telegram alert — fire-and-forget.
 *
 * Tenant + ürün isimlerini lookup et, template'i build et, sendTelegramAlert.
 * Dev'de mock log atar, production'da telegram API'ya post eder.
 */
async function notifySuperadminOnNewReport(
  companyId: string,
  targetType: 'storefront' | 'product',
  productId: string | null,
  reason: string,
  note: string | null,
  db: DbClient,
): Promise<void> {
  const [company] = await db
    .select({ name: companies.name, slug: companies.slug })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (!company) return; // tenant silinmişse atla

  let productName: string | null = null;
  if (targetType === 'product' && productId) {
    const [p] = await db
      .select({ name: products.name })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    productName = p?.name ?? null;
  }

  const alert = buildNewVitrinReportAlert({
    companyName: company.name,
    targetType,
    productName,
    reason,
    note,
    panelUrl: '/admin/superadmin/vitrin-moderation?tab=reports',
  });

  await sendTelegramAlert(alert);
}

export interface ReportRow {
  id: string;
  companyId: string;
  companyName: string;
  targetType: (typeof reportTargetTypeValues)[number];
  productId: string | null;
  productName: string | null;
  reason: (typeof reportReasonValues)[number];
  note: string | null;
  status: (typeof reportStatusValues)[number];
  resolvedById: string | null;
  resolvedByEmail: string | null;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  createdAt: Date;
  countryCode: string | null;
}

export interface ListReportsFilters {
  status?: (typeof reportStatusValues)[number];
  companyId?: string;
  limit?: number;
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export async function listReports(
  db: DbClient,
  filters: ListReportsFilters = {},
): Promise<ReportRow[]> {
  const conditions = [];
  if (filters.status) {
    conditions.push(eq(vitrinReports.status, filters.status));
  }
  if (filters.companyId) {
    conditions.push(eq(vitrinReports.companyId, filters.companyId));
  }

  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  const rows = await db
    .select({
      id: vitrinReports.id,
      companyId: vitrinReports.companyId,
      companyName: companies.name,
      targetType: vitrinReports.targetType,
      productId: vitrinReports.productId,
      productName: products.name,
      reason: vitrinReports.reason,
      note: vitrinReports.note,
      status: vitrinReports.status,
      resolvedById: vitrinReports.resolvedById,
      resolvedByEmail: users.email,
      resolvedAt: vitrinReports.resolvedAt,
      resolutionNote: vitrinReports.resolutionNote,
      createdAt: vitrinReports.createdAt,
      countryCode: vitrinReports.countryCode,
    })
    .from(vitrinReports)
    .innerJoin(companies, eq(companies.id, vitrinReports.companyId))
    .leftJoin(products, eq(products.id, vitrinReports.productId))
    .leftJoin(users, eq(users.id, vitrinReports.resolvedById))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(vitrinReports.createdAt))
    .limit(limit);

  return rows;
}

export interface ReportStats {
  pending: number;
  resolved: number;
  dismissed: number;
  totalCount: number;
  pendingTodayCount: number;
}

export async function getReportStats(db: DbClient): Promise<ReportStats> {
  const byStatus = await db
    .select({
      status: vitrinReports.status,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(vitrinReports)
    .groupBy(vitrinReports.status);

  const result: ReportStats = {
    pending: 0,
    resolved: 0,
    dismissed: 0,
    totalCount: 0,
    pendingTodayCount: 0,
  };
  for (const r of byStatus) {
    result[r.status] = r.count;
    result.totalCount += r.count;
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const todayRows = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(vitrinReports)
    .where(
      and(
        eq(vitrinReports.status, 'pending'),
        sql`${vitrinReports.createdAt} >= ${cutoff.toISOString()}::timestamptz`,
      ),
    );
  result.pendingTodayCount = todayRows[0]?.count ?? 0;

  return result;
}

export const resolveReportSchema = z.object({
  reportId: z.string().uuid(),
  superadminUserId: z.string().uuid(),
  resolution: z.enum(['resolved', 'dismissed']),
  resolutionNote: z.string().max(500).optional(),
});

/**
 * Şikayet'i resolve veya dismiss eder. Idempotent: zaten resolved/dismissed
 * ise reject.
 */
export async function resolveReport(
  input: z.infer<typeof resolveReportSchema>,
  db: DbClient,
  now: Date = new Date(),
): Promise<
  | { ok: true; reportId: string; companyId: string }
  | {
      ok: false;
      reason: 'not_found' | 'already_resolved' | 'invalid_input';
    }
> {
  const parsed = resolveReportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_input' };
  const { reportId, superadminUserId, resolution, resolutionNote } =
    parsed.data;

  const existing = await db
    .select({
      status: vitrinReports.status,
      companyId: vitrinReports.companyId,
    })
    .from(vitrinReports)
    .where(eq(vitrinReports.id, reportId))
    .limit(1);
  if (existing.length === 0) return { ok: false, reason: 'not_found' };
  if (existing[0].status !== 'pending')
    return { ok: false, reason: 'already_resolved' };

  await db
    .update(vitrinReports)
    .set({
      status: resolution,
      resolvedById: superadminUserId,
      resolvedAt: now,
      resolutionNote: resolutionNote ?? null,
    })
    .where(eq(vitrinReports.id, reportId));

  return { ok: true, reportId, companyId: existing[0].companyId };
}

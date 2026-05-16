/**
 * Vitrin moderasyon — Süperadmin paneli (Sprint 12 ext).
 *
 * `vitrin_whatsapp_feedback` tablosundan flagged + tüm feedback'leri listele,
 * süperadmin'in manuel olarak flag/unflag etmesini sağla.
 *
 * Flagged = spam, küfür, yalan şikayet → manuel gizleme. Tenant dashboard'a
 * görünmemeli (Faz 2 — şu an tüm submitted'lar dashboard'a sayılıyor).
 *
 * RLS: tüm fonksiyonlar SUPERADMIN role gerekir (caller `requireSuperadmin`
 * ile doğrulanmalı; helper'lar tenant filter yapmaz).
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { DbClient } from '@/lib/db/client';
import {
  companies,
  users,
  vitrinWhatsappFeedback,
  type feedbackRatingEnum,
  type feedbackStatusEnum,
} from '@/db/schema';

type RatingValue = NonNullable<(typeof feedbackRatingEnum)['enumValues'][number]>;
type StatusValue = (typeof feedbackStatusEnum)['enumValues'][number];

export interface FeedbackRow {
  id: string;
  companyId: string;
  companyName: string;
  rating: RatingValue | null;
  status: StatusValue;
  countryCode: string | null;
  userAgent: string | null;
  flaggedById: string | null;
  flaggedByEmail: string | null;
  flagReason: string | null;
  createdAt: Date;
}

export interface ListFeedbackFilters {
  status?: StatusValue;
  companyId?: string;
  limit?: number;
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

/**
 * Tüm feedback'leri listele — süperadmin moderasyon için.
 *
 * Default: en yeni 100. Filtre: status (flagged/submitted/...) + companyId.
 */
export async function listAllFeedback(
  db: DbClient,
  filters: ListFeedbackFilters = {},
): Promise<FeedbackRow[]> {
  const conditions = [];
  if (filters.status) {
    conditions.push(eq(vitrinWhatsappFeedback.status, filters.status));
  }
  if (filters.companyId) {
    conditions.push(eq(vitrinWhatsappFeedback.companyId, filters.companyId));
  }

  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  const rows = await db
    .select({
      id: vitrinWhatsappFeedback.id,
      companyId: vitrinWhatsappFeedback.companyId,
      companyName: companies.name,
      rating: vitrinWhatsappFeedback.rating,
      status: vitrinWhatsappFeedback.status,
      countryCode: vitrinWhatsappFeedback.countryCode,
      userAgent: vitrinWhatsappFeedback.userAgent,
      flaggedById: vitrinWhatsappFeedback.flaggedById,
      flaggedByEmail: users.email,
      flagReason: vitrinWhatsappFeedback.flagReason,
      createdAt: vitrinWhatsappFeedback.createdAt,
    })
    .from(vitrinWhatsappFeedback)
    .innerJoin(companies, eq(companies.id, vitrinWhatsappFeedback.companyId))
    .leftJoin(users, eq(users.id, vitrinWhatsappFeedback.flaggedById))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(vitrinWhatsappFeedback.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    companyId: r.companyId,
    companyName: r.companyName,
    rating: r.rating,
    status: r.status,
    countryCode: r.countryCode,
    userAgent: r.userAgent,
    flaggedById: r.flaggedById,
    flaggedByEmail: r.flaggedByEmail,
    flagReason: r.flagReason,
    createdAt: r.createdAt,
  }));
}

export interface ModerationStats {
  totalCount: number;
  byStatus: Record<StatusValue, number>;
  flaggedTodayCount: number;
}

/**
 * Moderasyon özet — KPI header için.
 */
export async function getModerationStats(
  db: DbClient,
): Promise<ModerationStats> {
  const rows = await db
    .select({
      status: vitrinWhatsappFeedback.status,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(vitrinWhatsappFeedback)
    .groupBy(vitrinWhatsappFeedback.status);

  const byStatus: Record<StatusValue, number> = {
    submitted: 0,
    closed_manually: 0,
    dismissed: 0,
    flagged: 0,
  };
  let totalCount = 0;
  for (const r of rows) {
    byStatus[r.status] = r.count;
    totalCount += r.count;
  }

  // Bugün (24 saat) flag edilen — gece yarısı UTC kesimi.
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const flaggedTodayRows = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(vitrinWhatsappFeedback)
    .where(
      and(
        eq(vitrinWhatsappFeedback.status, 'flagged'),
        sql`${vitrinWhatsappFeedback.createdAt} >= ${cutoff.toISOString()}::timestamptz`,
      ),
    );

  return {
    totalCount,
    byStatus,
    flaggedTodayCount: flaggedTodayRows[0]?.count ?? 0,
  };
}

export const flagFeedbackSchema = z.object({
  feedbackId: z.string().uuid(),
  superadminUserId: z.string().uuid(),
  reason: z.string().min(3, 'Sebep en az 3 karakter').max(500),
});

/**
 * Bir feedback'i 'flagged' status'a geçir.
 *
 * @returns { ok, reason? } — not_found / already_flagged / invalid_input
 */
export async function flagFeedback(
  input: z.infer<typeof flagFeedbackSchema>,
  db: DbClient,
): Promise<
  | { ok: true; feedbackId: string; companyId: string }
  | { ok: false; reason: 'not_found' | 'already_flagged' | 'invalid_input' }
> {
  const parsed = flagFeedbackSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: 'invalid_input' };
  }
  const { feedbackId, superadminUserId, reason } = parsed.data;

  const existing = await db
    .select({
      status: vitrinWhatsappFeedback.status,
      companyId: vitrinWhatsappFeedback.companyId,
    })
    .from(vitrinWhatsappFeedback)
    .where(eq(vitrinWhatsappFeedback.id, feedbackId))
    .limit(1);
  if (existing.length === 0) return { ok: false, reason: 'not_found' };
  if (existing[0].status === 'flagged')
    return { ok: false, reason: 'already_flagged' };

  await db
    .update(vitrinWhatsappFeedback)
    .set({
      status: 'flagged',
      flaggedById: superadminUserId,
      flagReason: reason,
    })
    .where(eq(vitrinWhatsappFeedback.id, feedbackId));

  return { ok: true, feedbackId, companyId: existing[0].companyId };
}

/**
 * Bir feedback'in 'flagged' status'unu kaldır — orijinal status'a geri.
 *
 * Original status unknown (audit log'da değil) → genelde 'submitted' default.
 * Caller previous status'u biliyorsa override edebilir.
 */
export async function unflagFeedback(
  feedbackId: string,
  db: DbClient,
  options: { restoreToStatus?: StatusValue } = {},
): Promise<
  | { ok: true; feedbackId: string; companyId: string }
  | { ok: false; reason: 'not_found' | 'not_flagged' }
> {
  const existing = await db
    .select({
      status: vitrinWhatsappFeedback.status,
      companyId: vitrinWhatsappFeedback.companyId,
    })
    .from(vitrinWhatsappFeedback)
    .where(eq(vitrinWhatsappFeedback.id, feedbackId))
    .limit(1);
  if (existing.length === 0) return { ok: false, reason: 'not_found' };
  if (existing[0].status !== 'flagged')
    return { ok: false, reason: 'not_flagged' };

  const restoreTo = options.restoreToStatus ?? 'submitted';
  await db
    .update(vitrinWhatsappFeedback)
    .set({
      status: restoreTo,
      flaggedById: null,
      flagReason: null,
    })
    .where(eq(vitrinWhatsappFeedback.id, feedbackId));

  return { ok: true, feedbackId, companyId: existing[0].companyId };
}

/**
 * WhatsApp Geri Bildirim Balonu — Sprint 12 ext (EKRAN-PUBLIC-VITRIN §15).
 *
 * Müşteri vitrin'de WhatsApp tıkladıktan sonra sağ alt sticky balon belirir.
 * 5 emoji + tek tıklama submit pattern + KVKK uyumlu anonim IP hash.
 *
 * Status hiyerarşisi (counter felsefesi — kullanıcı vurgusu):
 *   submitted        ← rating verildi (en değerli sinyal)
 *   closed_manually  ← × ile kapatıldı (rating yok, "ilgilenmiyorum" sinyali)
 *   dismissed        ← sayfa kapatıldı (beforeunload sendBeacon — pasif sinyal)
 *
 * Anti-spam: 1 IP × 1 tenant × 24h içinde 1 satır. Aynı gün tekrar geliyorsa
 * eski kayıt update edilir (status upgrade: dismissed → closed_manually →
 * submitted), downgrade yapılmaz.
 */

import { createHash } from 'node:crypto';
import { and, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { DbClient } from '@/lib/db/client';
import type { TenantDb } from '@/lib/db/with-tenant';
import { vitrinWhatsappFeedback } from '@/db/schema';

export const feedbackRatingValues = [
  'very_good',
  'good',
  'neutral',
  'bad',
  'unreached',
] as const;

export const feedbackStatusValues = [
  'submitted',
  'closed_manually',
  'dismissed',
] as const;

const statusPriority: Record<string, number> = {
  dismissed: 1,
  closed_manually: 2,
  submitted: 3,
};

export const feedbackInputSchema = z.object({
  companyId: z.string().uuid(),
  status: z.enum(feedbackStatusValues),
  rating: z.enum(feedbackRatingValues).optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
  vitrinEventId: z.string().uuid().optional().nullable(),
});

export type FeedbackInput = z.input<typeof feedbackInputSchema>;

export type SubmitFeedbackResult =
  | { ok: true; id: string; created: boolean; upgraded: boolean }
  | {
      ok: false;
      reason: 'invalid_input' | 'rate_limit_24h' | 'inconsistent' | 'unknown';
      issues?: string[];
    };

function dailySalt(now: Date = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  const base = process.env.VITRIN_IP_HASH_SALT ?? 'petstockpro-dev';
  return `${base}:${day}`;
}

function hashIp(ip: string, now: Date = new Date()): string {
  return createHash('sha256').update(`${dailySalt(now)}:${ip}`).digest('hex');
}

export interface SubmitFeedbackContext {
  ipAddress: string;
  userAgent?: string | null;
  countryCode?: string | null;
}

/**
 * Feedback kayıt — anti-spam + status upgrade pattern.
 *
 * Aynı IP × tenant × 24h içinde:
 *   - İlk kayıt → INSERT
 *   - Sonraki istek status hierarchy ↑ ise → UPDATE
 *   - Sonraki istek status hierarchy ↓ veya eşit ise → reject `rate_limit_24h`
 */
export async function submitFeedback(
  input: FeedbackInput,
  ctx: SubmitFeedbackContext,
  db: DbClient,
  now: Date = new Date(),
): Promise<SubmitFeedbackResult> {
  const parsed = feedbackInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const data = parsed.data;

  // status=submitted ise rating zorunlu
  if (data.status === 'submitted' && !data.rating) {
    return {
      ok: false,
      reason: 'inconsistent',
      issues: ['status=submitted ile rating birlikte zorunlu'],
    };
  }
  // status=dismissed/closed_manually ise rating yasak (null'a normalize)
  const finalRating =
    data.status === 'submitted' ? data.rating! : null;

  const ipHash = hashIp(ctx.ipAddress, now);
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    // Mevcut 24h kayıt var mı?
    const existing = await db
      .select({
        id: vitrinWhatsappFeedback.id,
        status: vitrinWhatsappFeedback.status,
      })
      .from(vitrinWhatsappFeedback)
      .where(
        and(
          eq(vitrinWhatsappFeedback.companyId, data.companyId),
          eq(vitrinWhatsappFeedback.reporterIpHash, ipHash),
          gte(vitrinWhatsappFeedback.createdAt, cutoff),
        ),
      )
      .limit(1);

    if (existing[0]) {
      const oldPriority = statusPriority[existing[0].status] ?? 0;
      const newPriority = statusPriority[data.status] ?? 0;
      if (newPriority <= oldPriority) {
        return { ok: false, reason: 'rate_limit_24h' };
      }
      // Upgrade
      await db
        .update(vitrinWhatsappFeedback)
        .set({
          status: data.status,
          rating: finalRating,
          branchId: data.branchId ?? null,
          vitrinEventId: data.vitrinEventId ?? null,
          userAgent: ctx.userAgent ?? null,
          countryCode: ctx.countryCode ?? null,
        })
        .where(eq(vitrinWhatsappFeedback.id, existing[0].id));
      return { ok: true, id: existing[0].id, created: false, upgraded: true };
    }

    const [row] = await db
      .insert(vitrinWhatsappFeedback)
      .values({
        companyId: data.companyId,
        branchId: data.branchId ?? null,
        vitrinEventId: data.vitrinEventId ?? null,
        rating: finalRating,
        reporterIpHash: ipHash,
        countryCode: ctx.countryCode ?? null,
        userAgent: ctx.userAgent ?? null,
        status: data.status,
        createdAt: now,
      })
      .returning({ id: vitrinWhatsappFeedback.id });

    return { ok: true, id: row.id, created: true, upgraded: false };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

/**
 * Tenant'ın 30 günlük feedback özeti — dashboard için.
 */
export interface FeedbackSummary {
  totalSubmitted: number;
  totalClosedManually: number;
  totalDismissed: number;
  ratingDistribution: Record<string, number>;
  averageRatingScore: number | null; // 1-5 ölçek
}

const ratingScore: Record<string, number> = {
  very_good: 5,
  good: 4,
  neutral: 3,
  bad: 2,
  unreached: 1,
};

export async function getFeedbackSummary(
  companyId: string,
  db: TenantDb,
  windowDays: number = 30,
): Promise<FeedbackSummary> {
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      status: vitrinWhatsappFeedback.status,
      rating: vitrinWhatsappFeedback.rating,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(vitrinWhatsappFeedback)
    .where(
      and(
        eq(vitrinWhatsappFeedback.companyId, companyId),
        gte(vitrinWhatsappFeedback.createdAt, cutoff),
      ),
    )
    .groupBy(vitrinWhatsappFeedback.status, vitrinWhatsappFeedback.rating);

  const result: FeedbackSummary = {
    totalSubmitted: 0,
    totalClosedManually: 0,
    totalDismissed: 0,
    ratingDistribution: {
      very_good: 0,
      good: 0,
      neutral: 0,
      bad: 0,
      unreached: 0,
    },
    averageRatingScore: null,
  };

  let scoreSum = 0;
  let scoreCount = 0;
  for (const r of rows) {
    if (r.status === 'submitted') {
      result.totalSubmitted += r.count;
      if (r.rating) {
        result.ratingDistribution[r.rating] =
          (result.ratingDistribution[r.rating] ?? 0) + r.count;
        scoreSum += (ratingScore[r.rating] ?? 0) * r.count;
        scoreCount += r.count;
      }
    } else if (r.status === 'closed_manually') {
      result.totalClosedManually += r.count;
    } else if (r.status === 'dismissed') {
      result.totalDismissed += r.count;
    }
  }
  result.averageRatingScore = scoreCount > 0 ? scoreSum / scoreCount : null;
  return result;
}

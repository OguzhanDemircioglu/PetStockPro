/**
 * Plan limit override — Sprint 7b bypass 4.
 *
 * Süperadmin bir tenant'ın plan'ını manuel değiştirebilir. Tipik kullanım:
 *   - Müşteri PRO satın aldı, iyzico webhook gecikti, hâlâ FREE görünüyor
 *   - Geçici promosyon (FREE → PRO 30 gün, sonra manuel geri düşürülür)
 *   - Yanlış plan'a düştü düzeltme
 *
 * Bu helper:
 *   1. Target company ownership/existence check
 *   2. Same-plan idempotency (no-op)
 *   3. companies.plan UPDATE + updatedAt
 *
 * Subscription tablosuna dokunmaz — bypass dokuna dokuna bilinçli yapılır.
 * Para akışı (iyzico) gelirse webhook orchestrator zaten plan sync eder.
 */

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { DbClient } from '@/lib/db/client';
import { companies } from '@/db/schema';

export const PLAN_VALUES = ['FREE', 'PRO', 'PRO_PLUS'] as const;
export type PlanValue = (typeof PLAN_VALUES)[number];

export const planOverrideSchema = z.object({
  targetCompanyId: z.string().uuid('Hedef tenant UUID geçersiz'),
  newPlan: z.enum(PLAN_VALUES),
});
export type PlanOverrideInput = z.input<typeof planOverrideSchema>;

export type PlanOverrideResult =
  | { ok: true; beforePlan: PlanValue; afterPlan: PlanValue; targetCompanyName: string }
  | { ok: false; reason: 'invalid_input'; issues: string[] }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'same_plan'; currentPlan: PlanValue }
  | { ok: false; reason: 'unknown' };

export async function overrideCompanyPlan(
  input: PlanOverrideInput,
  db: DbClient,
  now: Date = new Date(),
): Promise<PlanOverrideResult> {
  const parsed = planOverrideSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const data = parsed.data;

  const rows = await db
    .select({ id: companies.id, name: companies.name, plan: companies.plan })
    .from(companies)
    .where(eq(companies.id, data.targetCompanyId))
    .limit(1);
  const target = rows[0];
  if (!target) return { ok: false, reason: 'not_found' };

  if (target.plan === data.newPlan) {
    return { ok: false, reason: 'same_plan', currentPlan: target.plan as PlanValue };
  }

  try {
    await db
      .update(companies)
      .set({ plan: data.newPlan, updatedAt: now })
      .where(eq(companies.id, data.targetCompanyId));
    return {
      ok: true,
      beforePlan: target.plan as PlanValue,
      afterPlan: data.newPlan,
      targetCompanyName: target.name,
    };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

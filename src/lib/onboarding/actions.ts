/**
 * Onboarding Helpers — Sprint 2.6
 *
 * EKRAN-AUTH §8 — 3 adım wizard:
 *   1. createFirstBranch — şube ekle (cityId + districtId FK)
 *   2. saveStorefront (opsiyonel) — slug + storefrontStatus
 *   3. completeOnboarding — users.onboardingCompletedAt = now
 *
 * Sprint 2.6 scope: Adım 1 + 3 (vitrin opsiyonel).
 * Adım 2 "İlk ürün" Sprint 1B sonrası (products tablosu yok).
 *
 * Dependency injection: db parametre olarak.
 */

import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { makeSlug } from '@/lib/utils/slug';
import type { DbClient } from '@/lib/db/client';
import { branches, cities, companies, districts, users } from '@/db/schema';

// ─────────────────────────────────────────────────────────────────
// 1. CREATE FIRST BRANCH
// ─────────────────────────────────────────────────────────────────

export const firstBranchSchema = z.object({
  name: z.string().min(2, 'Şube adı en az 2 karakter').max(120),
  cityId: z.number().int().min(1).max(81, 'Geçerli bir il seç'),
  districtId: z.string().uuid('Geçerli bir ilçe seç'),
  address: z.string().max(500).optional(),
  whatsappPhone: z.string().max(20).optional(),
});

export type FirstBranchInput = z.input<typeof firstBranchSchema>;

export type CreateFirstBranchResult =
  | { ok: true; branchId: string }
  | { ok: false; issues: string[] };

export async function createFirstBranch(
  companyId: string,
  input: FirstBranchInput,
  db: DbClient,
): Promise<CreateFirstBranchResult> {
  const parsed = firstBranchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((i) => i.message) };
  }
  const data = parsed.data;

  // City + district FK sanity (kötü niyetli payload → atmak yerine doğrula)
  const cityRows = await db.select({ id: cities.id }).from(cities).where(eq(cities.id, data.cityId)).limit(1);
  if (cityRows.length === 0) {
    return { ok: false, issues: ['İl bulunamadı'] };
  }

  const districtRows = await db
    .select({ id: districts.id })
    .from(districts)
    .where(and(eq(districts.id, data.districtId), eq(districts.cityId, data.cityId)))
    .limit(1);
  if (districtRows.length === 0) {
    return { ok: false, issues: ['İlçe bu ile ait değil'] };
  }

  try {
    const [row] = await db
      .insert(branches)
      .values({
        companyId,
        name: data.name,
        cityId: data.cityId,
        districtId: data.districtId,
        address: data.address ?? null,
        whatsappPhone: data.whatsappPhone ?? null,
        isActive: true,
      })
      .returning({ id: branches.id });

    return { ok: true, branchId: row.id };
  } catch {
    return { ok: false, issues: ['Şube oluşturulamadı — tekrar dene'] };
  }
}

// ─────────────────────────────────────────────────────────────────
// 2. SAVE STOREFRONT (Opsiyonel — vitrin profili)
// ─────────────────────────────────────────────────────────────────

export const storefrontSchema = z.object({
  slug: z.string()
    .min(3, 'Slug en az 3 karakter')
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'Slug sadece küçük harf, rakam ve tire içerebilir'),
});

export type StorefrontInput = z.input<typeof storefrontSchema>;

export type SaveStorefrontResult =
  | { ok: true; slug: string }
  | { ok: false; issues: string[] };

export async function saveStorefront(
  companyId: string,
  input: StorefrontInput,
  db: DbClient,
): Promise<SaveStorefrontResult> {
  const parsed = storefrontSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((i) => i.message) };
  }

  // Normalize (register'daki gibi çift güvenlik)
  const normalized = makeSlug(parsed.data.slug);
  if (normalized.length < 3) {
    return { ok: false, issues: ['Slug geçerli karakter içermiyor'] };
  }

  // Slug uniqueness — kendi tenant'ı hariç
  const existing = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.slug, normalized))
    .limit(1);
  if (existing.length > 0 && existing[0].id !== companyId) {
    return { ok: false, issues: ['Bu slug başka bir pet shop tarafından kullanılıyor'] };
  }

  try {
    await db
      .update(companies)
      .set({
        slug: normalized,
        storefrontStatus: 'pending', // YT-1 hibrit foto moderation Sprint 12'de — şimdilik pending
        updatedAt: new Date(),
      })
      .where(eq(companies.id, companyId));

    return { ok: true, slug: normalized };
  } catch {
    return { ok: false, issues: ['Vitrin profili kaydedilemedi'] };
  }
}

// ─────────────────────────────────────────────────────────────────
// 3. COMPLETE ONBOARDING
// ─────────────────────────────────────────────────────────────────

export interface CompleteOnboardingResult {
  ok: true;
  completedAt: Date;
}

export async function completeOnboarding(
  userId: string,
  db: DbClient,
  now: Date = new Date(),
): Promise<CompleteOnboardingResult> {
  await db
    .update(users)
    .set({ onboardingCompletedAt: now, updatedAt: now })
    .where(eq(users.id, userId));

  return { ok: true, completedAt: now };
}

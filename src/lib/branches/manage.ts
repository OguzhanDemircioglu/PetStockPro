/**
 * Branches CRUD — Sprint 5
 *
 * listBranches + addBranch + updateBranch + deactivateBranch.
 *
 * İlk şube onboarding wizard'da `createFirstBranch` ile oluşur
 * (lib/onboarding/actions.ts). Bu helper ek şube + edit + soft delete.
 *
 * Soft delete (isActive=false): stok hareketleri ve branch_inventory
 * korunur, sadece dropdown'larda gözükmez.
 */

import { and, asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { moderateFields } from '@/lib/moderation/check';
import type { ModerationFlagsResult } from '@/lib/moderation/redirect-suffix';
import type { DbClient } from '@/lib/db/client';
import { canAddBranch } from '@/lib/billing/plan-features';
import {
  branches,
  cities,
  districts,
  companies,
  productVariants,
  branchInventory,
  users,
} from '@/db/schema';

// ─────────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────────

export interface BranchListItem {
  id: string;
  name: string;
  cityId: number | null;
  cityName: string | null;
  districtId: string | null;
  districtName: string | null;
  address: string | null;
  whatsappPhone: string | null;
  isActive: boolean;
  /** Faz 1 (2026-05-21) — 3-state şube. 'active' | 'holiday' | 'inactive'. */
  status: 'active' | 'holiday' | 'inactive';
  createdAt: Date;
  variantInventoryCount: number;
  totalStockQty: number;
}

export async function listBranches(
  companyId: string,
  db: DbClient,
): Promise<BranchListItem[]> {
  return db
    .select({
      id: branches.id,
      name: branches.name,
      cityId: branches.cityId,
      cityName: cities.name,
      districtId: branches.districtId,
      districtName: districts.name,
      address: branches.address,
      whatsappPhone: branches.whatsappPhone,
      isActive: branches.isActive,
      status: branches.status,
      createdAt: branches.createdAt,
      variantInventoryCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${branchInventory}
        WHERE ${branchInventory.branchId} = ${branches.id}
      )`,
      totalStockQty: sql<number>`(
        SELECT COALESCE(SUM(${branchInventory.stockQty}), 0)::int FROM ${branchInventory}
        WHERE ${branchInventory.branchId} = ${branches.id}
      )`,
    })
    .from(branches)
    .leftJoin(cities, eq(cities.id, branches.cityId))
    .leftJoin(districts, eq(districts.id, branches.districtId))
    .where(eq(branches.companyId, companyId))
    .orderBy(asc(branches.createdAt));
}

export async function getBranchDetail(
  companyId: string,
  branchId: string,
  db: DbClient,
): Promise<BranchListItem | null> {
  const rows = await listBranches(companyId, db);
  return rows.find((b) => b.id === branchId) ?? null;
}

// ─────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────

export const branchSchema = z.object({
  name: z.string().min(2, 'Şube adı en az 2 karakter').max(120),
  cityId: z.number().int().min(1).max(81),
  districtId: z.string().uuid('Geçerli bir ilçe seç'),
  address: z.string().max(500).nullable().optional(),
  whatsappPhone: z
    .string()
    .max(20)
    .regex(/^\+?\d{10,15}$/, 'Geçerli WhatsApp numarası gir (+90... veya 0...)')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
});

export type BranchInput = z.input<typeof branchSchema>;

export type AddBranchResult =
  | { ok: true; branchId: string; moderationFlags?: ModerationFlagsResult }
  | {
      ok: false;
      reason: 'invalid_input' | 'city_not_found' | 'district_mismatch' | 'unknown';
      issues?: string[];
    }
  | {
      ok: false;
      reason: 'branch_limit_exceeded';
      limit: number;
      count: number;
    };

export async function addBranch(
  companyId: string,
  input: BranchInput,
  db: DbClient,
): Promise<AddBranchResult> {
  const parsed = branchSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const data = parsed.data;

  // 2026-05-22 Karar A revize — şube limit kontrolü (plan + süperadmin override).
  // active + holiday = "açık" şube sayılır; inactive değil.
  const companyRow = await db
    .select({
      plan: companies.plan,
      temporaryVitrinLimitOverride: companies.temporaryVitrinLimitOverride,
      temporaryVitrinLimitOverrideUntil: companies.temporaryVitrinLimitOverrideUntil,
      temporaryBranchLimitOverride: companies.temporaryBranchLimitOverride,
      temporaryBranchLimitOverrideUntil: companies.temporaryBranchLimitOverrideUntil,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (companyRow.length === 0) return { ok: false, reason: 'unknown' };

  const activeBranchRow = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(branches)
    .where(
      and(
        eq(branches.companyId, companyId),
        sql`${branches.status} != 'inactive'`,
      ),
    );
  const activeBranchCount = activeBranchRow[0]?.count ?? 0;

  const limitCheck = canAddBranch(companyRow[0], activeBranchCount);
  if (!limitCheck.ok) {
    return {
      ok: false,
      reason: 'branch_limit_exceeded',
      limit: limitCheck.limit,
      count: limitCheck.count,
    };
  }

  const cityRows = await db
    .select({ id: cities.id })
    .from(cities)
    .where(eq(cities.id, data.cityId))
    .limit(1);
  if (cityRows.length === 0) return { ok: false, reason: 'city_not_found' };

  const districtRows = await db
    .select({ id: districts.id })
    .from(districts)
    .where(
      and(eq(districts.id, data.districtId), eq(districts.cityId, data.cityId)),
    )
    .limit(1);
  if (districtRows.length === 0) return { ok: false, reason: 'district_mismatch' };

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
        // status default 'active' → is_active (generated) = true
      })
      .returning({ id: branches.id });
    const moderation = await moderateFields({
      'Şube adı': data.name,
      ...(data.address ? { 'Şube adresi': data.address } : {}),
    });
    return {
      ok: true,
      branchId: row.id,
      ...(moderation.flagged
        ? {
            moderationFlags: {
              flagged: true,
              fieldsFlagged: moderation.fieldsFlagged,
              reasons: moderation.reasons,
            },
          }
        : {}),
    };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

// ─────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────

export type UpdateBranchResult =
  | { ok: true; moderationFlags?: ModerationFlagsResult }
  | {
      ok: false;
      reason:
        | 'invalid_input'
        | 'not_found'
        | 'city_not_found'
        | 'district_mismatch'
        | 'unknown';
      issues?: string[];
    };

export async function updateBranch(
  companyId: string,
  branchId: string,
  input: BranchInput,
  db: DbClient,
): Promise<UpdateBranchResult> {
  const parsed = branchSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const data = parsed.data;

  const existing = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.id, branchId), eq(branches.companyId, companyId)))
    .limit(1);
  if (existing.length === 0) return { ok: false, reason: 'not_found' };

  const cityRows = await db
    .select({ id: cities.id })
    .from(cities)
    .where(eq(cities.id, data.cityId))
    .limit(1);
  if (cityRows.length === 0) return { ok: false, reason: 'city_not_found' };

  const districtRows = await db
    .select({ id: districts.id })
    .from(districts)
    .where(
      and(eq(districts.id, data.districtId), eq(districts.cityId, data.cityId)),
    )
    .limit(1);
  if (districtRows.length === 0) return { ok: false, reason: 'district_mismatch' };

  try {
    await db
      .update(branches)
      .set({
        name: data.name,
        cityId: data.cityId,
        districtId: data.districtId,
        address: data.address ?? null,
        whatsappPhone: data.whatsappPhone ?? null,
      })
      .where(eq(branches.id, branchId));
    const moderation = await moderateFields({
      'Şube adı': data.name,
      ...(data.address ? { 'Şube adresi': data.address } : {}),
    });
    return {
      ok: true,
      ...(moderation.flagged
        ? {
            moderationFlags: {
              flagged: true,
              fieldsFlagged: moderation.fieldsFlagged,
              reasons: moderation.reasons,
            },
          }
        : {}),
    };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

// ─────────────────────────────────────────────────────────────────
// DEACTIVATE (soft delete)
// ─────────────────────────────────────────────────────────────────

export type ToggleActiveResult =
  | { ok: true; isActive: boolean }
  | {
      ok: false;
      reason: 'not_found' | 'last_active_branch' | 'unknown';
    };

/**
 * Şubeyi pasifleştir (isActive=false). En son aktif şube pasifleştirilemez —
 * tenant'ın her zaman en az 1 aktif şubesi olmalı (transfer/stok-in için zorunlu).
 * Re-activate de yapılabilir (isActive=true).
 */
export async function setBranchActive(
  companyId: string,
  branchId: string,
  active: boolean,
  db: DbClient,
): Promise<ToggleActiveResult> {
  const existing = await db
    .select({ id: branches.id, isActive: branches.isActive })
    .from(branches)
    .where(and(eq(branches.id, branchId), eq(branches.companyId, companyId)))
    .limit(1);
  if (existing.length === 0) return { ok: false, reason: 'not_found' };

  // Aktiften pasife düşüyorsa, son aktif şube olmamalı
  if (existing[0].isActive && !active) {
    const activeCount = await db
      .select({ c: sql<number>`COUNT(*)::int` })
      .from(branches)
      .where(
        and(eq(branches.companyId, companyId), eq(branches.isActive, true)),
      );
    if ((activeCount[0]?.c ?? 0) <= 1) {
      return { ok: false, reason: 'last_active_branch' };
    }
  }

  try {
    await db
      .update(branches)
      // is_active generated (Faz 5A) → tek kaynak status'a yaz. 2-state toggle
      // 'holiday'ı temsil edemez; aktif=active, pasif=inactive.
      .set({ status: active ? 'active' : 'inactive' })
      .where(eq(branches.id, branchId));
    return { ok: true, isActive: active };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

// ─────────────────────────────────────────────────────────────────
// MANAGER REMOVE — şubeye atanmış OBSERVER'ın branch ilişkisini koparır
// (Faz 1: SUBE_MUDURU → OBSERVER rename, Migration 0021)
// ─────────────────────────────────────────────────────────────────

export type RemoveBranchManagerResult =
  | { ok: true; userId: string; email: string }
  | {
      ok: false;
      reason: 'branch_not_found' | 'no_manager_assigned' | 'unknown';
    };

/**
 * Belirtilen şubenin müdürünü kaldırır.
 *
 * - Sadece `branchId` field'ını NULL'a çeker — kullanıcı tenant'a bağlı kalır,
 *   rolü OBSERVER olarak korunur (rol değişimi BAYI_SAHIBI'nin ayrı kararı).
 * - Faz 1'de `idx_users_one_sube_muduru_per_branch` partial index drop edildi
 *   (OBSERVER multi-branch viewer — 1 müdür/şube constraint anlamsız).
 * - BAYI_SAHIBI yetkisi server action'da kontrol edilir.
 */
export async function removeBranchManager(
  companyId: string,
  branchId: string,
  db: DbClient,
): Promise<RemoveBranchManagerResult> {
  const branchOwn = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.id, branchId), eq(branches.companyId, companyId)))
    .limit(1);
  if (branchOwn.length === 0) return { ok: false, reason: 'branch_not_found' };

  const manager = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(
      and(
        eq(users.companyId, companyId),
        eq(users.branchId, branchId),
        eq(users.role, 'OBSERVER'),
      ),
    )
    .limit(1);
  if (manager.length === 0) return { ok: false, reason: 'no_manager_assigned' };

  try {
    await db
      .update(users)
      .set({ branchId: null, updatedAt: new Date() })
      .where(eq(users.id, manager[0].id));
    return { ok: true, userId: manager[0].id, email: manager[0].email };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

/**
 * Şube'nin envanter durumu — silme öncesi uyarı için.
 * Eğer aktif inventory varsa (stockQty > 0), kullanıcı önce transfer/sayım yapmalı.
 */
export async function getBranchInventorySummary(
  companyId: string,
  branchId: string,
  db: DbClient,
): Promise<{ totalStockQty: number; variantCount: number; productCount: number }> {
  const rows = await db
    .select({
      totalStockQty: sql<number>`COALESCE(SUM(${branchInventory.stockQty}), 0)::int`,
      variantCount: sql<number>`COUNT(DISTINCT ${branchInventory.variantId})::int`,
      productCount: sql<number>`COUNT(DISTINCT ${productVariants.productId})::int`,
    })
    .from(branchInventory)
    .leftJoin(
      productVariants,
      eq(productVariants.id, branchInventory.variantId),
    )
    .where(
      and(
        eq(branchInventory.companyId, companyId),
        eq(branchInventory.branchId, branchId),
      ),
    );
  return rows[0] ?? { totalStockQty: 0, variantCount: 0, productCount: 0 };
}

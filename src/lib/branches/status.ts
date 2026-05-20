/**
 * Şube state yönetimi — Faz 2 (2026-05-21).
 *
 * Plan §D — 3-state şube:
 *   - active   → normal, vitrin'de görünür, tüm aksiyonlar açık
 *   - holiday  → tatilde, vitrin "🏖" rozet + WhatsApp disabled, admin op açık
 *   - inactive → pasif, vitrin'den çekilir, admin read-only
 *
 * `branch_status` enum + `branches.status` column (Migration 0021).
 *
 * `isActive` boolean korunur (geri uyumluluk):
 *   status='active'   ↔ isActive=true
 *   status='holiday'  ↔ isActive=true   (operasyon devam ediyor)
 *   status='inactive' ↔ isActive=false
 *
 * Son aktif şube koruması — tenant'ın her zaman en az 1 'active' veya 'holiday'
 * (operasyonel) şubesi olmalı (transfer + stok-in için zorunlu). Tüm şubeler
 * 'inactive'e düşürülemez.
 */

import { and, eq, sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { branches } from '@/db/schema';

export type BranchStatus = 'active' | 'holiday' | 'inactive';

export const BRANCH_STATUS_VALUES: readonly BranchStatus[] = ['active', 'holiday', 'inactive'];

/** Status → UI Türkçe label (Faz 4 UI için). */
export const BRANCH_STATUS_LABELS: Record<BranchStatus, string> = {
  active: 'Aktif',
  holiday: 'Tatilde',
  inactive: 'Pasif',
};

/** Status → emoji (Faz 4 UI için). */
export const BRANCH_STATUS_EMOJI: Record<BranchStatus, string> = {
  active: '🟢',
  holiday: '🟡',
  inactive: '⚫',
};

export type SetBranchStatusResult =
  | { ok: true; previousStatus: BranchStatus; newStatus: BranchStatus }
  | {
      ok: false;
      reason:
        | 'not_found'
        | 'invalid_status'
        | 'last_operational_branch'
        | 'no_change'
        | 'unknown';
    };

interface BranchStatusRow {
  id: string;
  status: BranchStatus;
}

/**
 * Şube state değiştirme — UI'dan tek noktadan çağrılır (Faz 4).
 *
 * Geçiş kuralları:
 *   - active → holiday/inactive: serbest (last_operational check)
 *   - holiday → active/inactive: serbest (last_operational check)
 *   - inactive → active/holiday: serbest (re-activate, kontrolsüz)
 *   - aynı status → no_change (idempotent)
 *
 * `isActive` boolean'ı da senkronize edilir.
 */
export async function setBranchStatus(
  companyId: string,
  branchId: string,
  newStatus: BranchStatus,
  db: DbClient,
): Promise<SetBranchStatusResult> {
  if (!BRANCH_STATUS_VALUES.includes(newStatus)) {
    return { ok: false, reason: 'invalid_status' };
  }

  const existing = (await db
    .select({ id: branches.id, status: branches.status })
    .from(branches)
    .where(and(eq(branches.id, branchId), eq(branches.companyId, companyId)))
    .limit(1)) as BranchStatusRow[];
  if (existing.length === 0) return { ok: false, reason: 'not_found' };

  const previousStatus = existing[0].status;
  if (previousStatus === newStatus) {
    return { ok: false, reason: 'no_change' };
  }

  // Son operasyonel şube koruması — yalnızca 'inactive'e düşerken devreye girer.
  // 'active' veya 'holiday' şubelerden en az 1 tane kalmalı (transfer/stok-in için).
  if (newStatus === 'inactive' && previousStatus !== 'inactive') {
    const operationalCount = (await db
      .select({ c: sql<number>`COUNT(*)::int` })
      .from(branches)
      .where(
        and(
          eq(branches.companyId, companyId),
          sql`${branches.status} IN ('active','holiday')`,
        ),
      )) as Array<{ c: number }>;

    if ((operationalCount[0]?.c ?? 0) <= 1) {
      return { ok: false, reason: 'last_operational_branch' };
    }
  }

  try {
    // isActive sync: inactive ↔ false, diğer (active/holiday) ↔ true
    const newIsActive = newStatus !== 'inactive';
    await db
      .update(branches)
      .set({ status: newStatus, isActive: newIsActive })
      .where(eq(branches.id, branchId));

    return { ok: true, previousStatus, newStatus };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

export class BranchNotOperationalError extends Error {
  constructor(
    public readonly branchId: string,
    public readonly status: BranchStatus,
    public readonly requiredStatus: 'active' | 'active_or_holiday',
  ) {
    super(`Şube ${branchId} '${status}' durumunda — işlem reddedildi`);
    this.name = 'BranchNotOperationalError';
  }
}

export interface AssertBranchOperationalOptions {
  /** true → sadece 'active' kabul edilir; false (default) → 'active' veya 'holiday' kabul edilir. */
  requireActive?: boolean;
}

/**
 * Stok hareketi server action'larının başında çağrılır — pasif şubede her
 * mutation reddedilir, tatildeki şubede operasyon devam edebilir (default).
 *
 * Throw eden BranchNotOperationalError ile server action 403 döndürür.
 *
 * @param branchId  Hedef şube
 * @param db        Drizzle client
 * @param opts.requireActive  Vitrin gibi sadece 'active' isteyen yerler için
 */
export async function assertBranchOperational(
  branchId: string,
  db: DbClient,
  opts: AssertBranchOperationalOptions = {},
): Promise<void> {
  const rows = (await db
    .select({ status: branches.status })
    .from(branches)
    .where(eq(branches.id, branchId))
    .limit(1)) as Array<{ status: BranchStatus }>;

  if (rows.length === 0) {
    throw new BranchNotOperationalError(branchId, 'inactive', 'active_or_holiday');
  }

  const status = rows[0].status;
  if (opts.requireActive === true) {
    if (status !== 'active') {
      throw new BranchNotOperationalError(branchId, status, 'active');
    }
    return;
  }
  // Default: holiday kabul edilir, inactive reddedilir.
  if (status === 'inactive') {
    throw new BranchNotOperationalError(branchId, status, 'active_or_holiday');
  }
}

/**
 * Throw etmeyen versiyon — UI'dan button disabled check için.
 */
export async function isBranchOperational(
  branchId: string,
  db: DbClient,
  opts: AssertBranchOperationalOptions = {},
): Promise<boolean> {
  try {
    await assertBranchOperational(branchId, db, opts);
    return true;
  } catch {
    return false;
  }
}

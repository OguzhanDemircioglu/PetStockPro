/**
 * Companies lifecycle — Faz 5C güvenli soft-delete.
 *
 * `companies` = tenant kökü. Tüm tenant FK'leri cascade (products / stock_movements /
 * branches / ...) → yanlış bir `DELETE companies` ödeyen tenant'ı + stok defterini
 * topluca siler. Bu modül GÜVENLİ yolu sağlar: soft-delete (deletedAt set, geri
 * alınabilir) + restore.
 *
 * HARD-delete (cascade) bilinçli olarak SAĞLANMAZ — ayrıca yapısal olarak engellidir:
 *   - audit_logs immutability trigger (migration 0033) cascade DELETE'i RAISE EXCEPTION
 *     ile durdurur → bir tenant'ın denetim izi silinemez.
 *   - invoices FK onDelete:'restrict' (KVKK 5 yıl + vergi 10 yıl saklama).
 * Gerçek bir purge gerekiyorsa = deliberate manuel DBA operasyonu (audit + fatura ayrı
 * ele alınır), ASLA tek-tık feature değil. softDelete + grace, bu kararın önündeki iki adımdır.
 *
 * Tüketiciler (soft-delete'i ANLAMLI kılan, bir silme akışı eklendiğinde bağlanacak):
 *   - auth: deletedAt set tenant'ın login'i engellenir,
 *   - vitrin public: deletedAt IS NULL filtresi (mağaza listeden düşer),
 *   - süperadmin tenant listesi: deletedAt bayrağı (listAllTenants — bu commit'te eklendi).
 */
import { eq } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { companies } from '@/db/schema';
import { writeAuditLog } from '@/lib/audit/log';

/** Soft-delete'ten sonra manuel purge-eligible olana kadar geçen süre (bilgi + gelecekteki gate). */
export const COMPANY_SOFT_DELETE_GRACE_MS = 7 * 24 * 60 * 60 * 1000; // 7 gün

export type SoftDeleteCompanyResult =
  | { ok: true; companyId: string }
  | { ok: false; reason: 'not_found' | 'already_deleted' | 'unknown' };

/**
 * Tenant'ı soft-delete eder (deletedAt = now). Idempotent değil — zaten silinmişse
 * already_deleted. Audit: company.soft_deleted (süperadmin bypass).
 */
export async function softDeleteCompany(
  companyId: string,
  actorUserId: string,
  db: DbClient,
  now: Date = new Date(),
): Promise<SoftDeleteCompanyResult> {
  const rows = await db
    .select({ id: companies.id, deletedAt: companies.deletedAt })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  const company = rows[0];
  if (!company) return { ok: false, reason: 'not_found' };
  if (company.deletedAt) return { ok: false, reason: 'already_deleted' };

  try {
    await db
      .update(companies)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(companies.id, companyId));
    await writeAuditLog(
      {
        companyId,
        userId: actorUserId,
        action: 'company.soft_deleted',
        entityType: 'company',
        entityId: companyId,
        performedAsSuperadmin: true,
        superadminActionType: 'bypass',
      },
      db,
      now,
    );
    return { ok: true, companyId };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

export type RestoreCompanyResult =
  | { ok: true; companyId: string }
  | { ok: false; reason: 'not_found' | 'not_deleted' | 'unknown' };

/**
 * Soft-delete'i geri alır (deletedAt = NULL). Audit: company.restored.
 */
export async function restoreCompany(
  companyId: string,
  actorUserId: string,
  db: DbClient,
  now: Date = new Date(),
): Promise<RestoreCompanyResult> {
  const rows = await db
    .select({ id: companies.id, deletedAt: companies.deletedAt })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  const company = rows[0];
  if (!company) return { ok: false, reason: 'not_found' };
  if (!company.deletedAt) return { ok: false, reason: 'not_deleted' };

  try {
    await db
      .update(companies)
      .set({ deletedAt: null, updatedAt: now })
      .where(eq(companies.id, companyId));
    await writeAuditLog(
      {
        companyId,
        userId: actorUserId,
        action: 'company.restored',
        entityType: 'company',
        entityId: companyId,
        performedAsSuperadmin: true,
        superadminActionType: 'bypass',
      },
      db,
      now,
    );
    return { ok: true, companyId };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

/**
 * Soft-delete grace süresi doldu mu? (Gelecekteki manuel purge gate için bilgi —
 * tek başına bir DELETE tetiklemez.)
 */
export function isPurgeEligible(
  deletedAt: Date | null,
  now: Date = new Date(),
  graceMs: number = COMPANY_SOFT_DELETE_GRACE_MS,
): boolean {
  if (!deletedAt) return false;
  return now.getTime() - deletedAt.getTime() >= graceMs;
}

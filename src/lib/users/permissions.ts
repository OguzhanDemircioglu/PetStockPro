/**
 * STAFF granular permission helper'ları — Faz 2 (2026-05-21).
 *
 * Plan §B + §F — Çalışan yetki sistemi:
 *   - STAFF rolü davet edildiğinde applyStaffDefaults() ile 3 default ON
 *     kayıt insert edilir (sale.create / variant.view / customer_ref.write).
 *   - Bayi Admin /admin/settings/users yetki modal'ından setBulkPermissions
 *     ile diğer 12 yetkiyi açar/kapatır (Faz 6).
 *   - Server action'lar mutation öncesi hasPermission() ile gate kontrolü yapar.
 *
 * Rol bypass kuralları:
 *   - BAYI_SAHIBI + SUPERADMIN → tüm yetkiler implicit ON (helper bypass eder)
 *   - OBSERVER → tüm mutation'lar reddedilir (assertNotObserver gate ayrı)
 *   - STAFF → user_permissions tablosundaki gerçek satırlar geçerlidir
 *
 * Cache stratejisi (MVP): yok — her hasPermission DB query yapar. Plan §Risk #2
 * "1K tenant'ta yetersizse session.permissions cache'i" Faz 2 sonrası eklenir.
 */

import { and, eq, inArray, sql } from 'drizzle-orm';
import type { TenantDb } from '@/lib/db/with-tenant';
import { userPermissions, users } from '@/db/schema';
import {
  ALL_PERMISSION_KEYS,
  STAFF_DEFAULT_ON,
  isValidPermissionKey,
  type PermissionKey,
} from './permission-keys';

/** BAYI_SAHIBI + SUPERADMIN tüm yetkilere implicit sahip. */
const BYPASS_ROLES = new Set(['BAYI_SAHIBI', 'SUPERADMIN']);

interface UserRoleRow {
  role: string;
}

/**
 * Bir kullanıcının rolünü tek satır seçer. Mutation gate path'lerinde sık
 * çağrılır — minimum projection.
 */
async function fetchUserRole(userId: string, db: TenantDb): Promise<string | null> {
  const rows = (await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)) as UserRoleRow[];
  return rows[0]?.role ?? null;
}

/**
 * Bir kullanıcının ON olan tüm permission key'lerini döndürür.
 *
 * BAYI_SAHIBI / SUPERADMIN → ALL_PERMISSION_KEYS (her şey ON).
 * OBSERVER → boş dizi (mutation hiçbiri yok).
 * STAFF → user_permissions tablosundan enabled=true satırlar.
 *
 * Geçersiz key (artık silinmiş eski key) sessizce filtrelenir.
 */
export async function getUserPermissions(
  userId: string,
  db: TenantDb,
): Promise<readonly PermissionKey[]> {
  const role = await fetchUserRole(userId, db);
  if (!role) return [];
  if (BYPASS_ROLES.has(role)) return ALL_PERMISSION_KEYS;
  if (role === 'OBSERVER') return [];

  const rows = (await db
    .select({ key: userPermissions.permissionKey })
    .from(userPermissions)
    .where(and(eq(userPermissions.userId, userId), eq(userPermissions.enabled, true)))) as Array<{
    key: string;
  }>;

  return rows
    .map((r) => r.key)
    .filter((k): k is PermissionKey => isValidPermissionKey(k));
}

/**
 * Belirli bir yetki ON mı? Mutation gate'inde primary check.
 *
 * Geçersiz key gönderilirse `false` döner (whitelist enforce).
 */
export async function hasPermission(
  userId: string,
  key: PermissionKey,
  db: TenantDb,
): Promise<boolean> {
  const role = await fetchUserRole(userId, db);
  if (!role) return false;
  if (BYPASS_ROLES.has(role)) return true;
  if (role === 'OBSERVER') return false;

  const rows = (await db
    .select({ enabled: userPermissions.enabled })
    .from(userPermissions)
    .where(and(eq(userPermissions.userId, userId), eq(userPermissions.permissionKey, key)))
    .limit(1)) as Array<{ enabled: boolean }>;

  return rows[0]?.enabled === true;
}

export type SetPermissionResult =
  | { ok: true; userId: string; permissionKey: PermissionKey; enabled: boolean }
  | { ok: false; reason: 'invalid_key' | 'unknown' };

/**
 * Tek bir yetkiyi ON/OFF yapar (upsert). Bayi Admin yetki modal'ından.
 *
 * Hâlihazırda satır varsa enabled+grantedBy+grantedAt güncellenir; yoksa
 * yeni satır insert edilir.
 */
export async function setPermission(
  userId: string,
  key: PermissionKey,
  enabled: boolean,
  grantedById: string,
  db: TenantDb,
  now: Date = new Date(),
): Promise<SetPermissionResult> {
  if (!isValidPermissionKey(key)) {
    return { ok: false, reason: 'invalid_key' };
  }

  try {
    await db
      .insert(userPermissions)
      .values({
        userId,
        permissionKey: key,
        enabled,
        grantedById,
        grantedAt: now,
      })
      .onConflictDoUpdate({
        target: [userPermissions.userId, userPermissions.permissionKey],
        set: { enabled, grantedById, grantedAt: now },
      });
    return { ok: true, userId, permissionKey: key, enabled };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

export type SetBulkResult =
  | { ok: true; updatedCount: number; invalidKeys: readonly string[] }
  | { ok: false; reason: 'unknown' };

/**
 * Birden fazla yetkiyi tek transaction'da set'ler. Yetki modal'ı submit'inde.
 *
 * Plan §6.3 — Bayi Admin modal'da 13+ toggle aynı anda gönderir, hepsi
 * tek round-trip ile güncellenir. Geçersiz key'ler invalidKeys'de raporlanır
 * (sessizce skip, hata değil).
 */
export async function setBulkPermissions(
  userId: string,
  updates: Readonly<Record<string, boolean>>,
  grantedById: string,
  db: TenantDb,
  now: Date = new Date(),
): Promise<SetBulkResult> {
  const validEntries: Array<{ key: PermissionKey; enabled: boolean }> = [];
  const invalidKeys: string[] = [];

  for (const [k, v] of Object.entries(updates)) {
    if (isValidPermissionKey(k)) {
      validEntries.push({ key: k, enabled: v });
    } else {
      invalidKeys.push(k);
    }
  }

  if (validEntries.length === 0) {
    return { ok: true, updatedCount: 0, invalidKeys };
  }

  try {
    const rows = validEntries.map((e) => ({
      userId,
      permissionKey: e.key,
      enabled: e.enabled,
      grantedById,
      grantedAt: now,
    }));

    await db
      .insert(userPermissions)
      .values(rows)
      .onConflictDoUpdate({
        target: [userPermissions.userId, userPermissions.permissionKey],
        // multi-row upsert: SET = EXCLUDED.* ile yeni değer alır
        set: {
          enabled: sql`excluded.enabled`,
          grantedById: sql`excluded.granted_by_id`,
          grantedAt: sql`excluded.granted_at`,
        },
      });

    return { ok: true, updatedCount: validEntries.length, invalidKeys };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

/**
 * Yeni STAFF kullanıcı davet edildiğinde 3 default ON yetki insert eder.
 *
 * inviteUser helper'ı role==='STAFF' branch'inde çağrılır (Faz 2.3
 * entegrasyonu). BAYI_SAHIBI / SUPERADMIN / OBSERVER için no-op (helper
 * bypass davranışı yeterli).
 */
export async function applyStaffDefaults(
  userId: string,
  grantedById: string,
  db: TenantDb,
  now: Date = new Date(),
): Promise<{ ok: true; inserted: number } | { ok: false; reason: 'unknown' }> {
  try {
    const rows = STAFF_DEFAULT_ON.map((key) => ({
      userId,
      permissionKey: key,
      enabled: true,
      grantedById,
      grantedAt: now,
    }));

    await db
      .insert(userPermissions)
      .values(rows)
      .onConflictDoNothing({
        target: [userPermissions.userId, userPermissions.permissionKey],
      });

    return { ok: true, inserted: rows.length };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

/**
 * Bir kullanıcının TÜM yetki kayıtlarını siler (kullanıcı silinince cascade
 * zaten siler — bu helper test/debug için manuel cleanup).
 */
export async function clearAllPermissions(
  userId: string,
  db: TenantDb,
): Promise<{ ok: true; deletedCount: number } | { ok: false; reason: 'unknown' }> {
  try {
    const result = await db
      .delete(userPermissions)
      .where(eq(userPermissions.userId, userId))
      .returning({ id: userPermissions.id });
    return { ok: true, deletedCount: result.length };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

/**
 * Birden fazla yetkiyi tek seferde kontrol eder — server action'ların başında
 * "tüm bunlardan biri lazım" pattern'i için. ANY semantiği (OR).
 */
export async function hasAnyPermission(
  userId: string,
  keys: readonly PermissionKey[],
  db: TenantDb,
): Promise<boolean> {
  const role = await fetchUserRole(userId, db);
  if (!role) return false;
  if (BYPASS_ROLES.has(role)) return true;
  if (role === 'OBSERVER') return false;
  if (keys.length === 0) return false;

  const rows = (await db
    .select({ key: userPermissions.permissionKey })
    .from(userPermissions)
    .where(
      and(
        eq(userPermissions.userId, userId),
        eq(userPermissions.enabled, true),
        inArray(userPermissions.permissionKey, keys as unknown as string[]),
      ),
    )
    .limit(1)) as Array<{ key: string }>;

  return rows.length > 0;
}

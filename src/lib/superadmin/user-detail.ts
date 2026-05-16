/**
 * Süperadmin user detail — Sprint 7c uzak yönetim sayfası için.
 *
 * Kullanıcı kimliği + hesap durumu + son audit + son hareketleri yetkili tenant
 * gözüyle çek. Süperadmin başka tenant'a da bakabildiği için scope'ta companyId
 * filter yok (kendisi zaten requireSuperadmin guard'lı).
 */

import { desc, eq } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { users, companies, auditLogs } from '@/db/schema';

export interface SuperadminUserDetail {
  id: string;
  email: string;
  name: string | null;
  role: string;
  companyId: string | null;
  companyName: string | null;
  twoFactorEnabled: boolean;
  emailVerifiedAt: Date | null;
  lockedUntil: Date | null;
  lockedReason: string | null;
  failedLoginCount: number;
  recentLockCount: number;
  createdAt: Date;
}

export async function getUserForSuperadmin(
  userId: string,
  db: DbClient,
): Promise<SuperadminUserDetail | null> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      companyId: users.companyId,
      companyName: companies.name,
      twoFactorEnabled: users.twoFactorEnabled,
      emailVerifiedAt: users.emailVerifiedAt,
      lockedUntil: users.lockedUntil,
      lockedReason: users.lockedReason,
      failedLoginCount: users.failedLoginCount,
      recentLockCount: users.recentLockCount,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(companies, eq(companies.id, users.companyId))
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0] ?? null;
}

export interface UserAuditEntry {
  id: string;
  action: string;
  superadminActionType: string | null;
  superadminReason: string | null;
  performedAsSuperadmin: boolean;
  createdAt: Date;
}

export async function listUserAudit(
  userId: string,
  db: DbClient,
  limit: number = 15,
): Promise<UserAuditEntry[]> {
  return db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      superadminActionType: auditLogs.superadminActionType,
      superadminReason: auditLogs.superadminReason,
      performedAsSuperadmin: auditLogs.performedAsSuperadmin,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(eq(auditLogs.entityId, userId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

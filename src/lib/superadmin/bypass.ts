/**
 * Süperadmin Bypass Override foundation — Sprint 7b
 *
 * Süperadmin sistem kurallarını bypass edebilir (örn. 24h geri alma penceresi geçmiş
 * hareket reverse). Her bypass için ZORUNLU:
 *   1. Süperadmin role + auth check
 *   2. Şifre re-auth (sensitive aksiyon doğrulaması)
 *   3. Zorunlu sebep (en az 10 karakter)
 *   4. Audit log: action='superadmin.bypass.<aksiyon>' + actionType='bypass' + reason
 *
 * Bu helper TÜM bypass aksiyonlarına ortak guard sağlar — pattern tekrarı yok.
 *
 * audit_logs.superadmin_action_type = 'bypass' damgası (SUPERADMIN-YETKILERI §4).
 */

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { DbClient } from '@/lib/db/client';
import { users } from '@/db/schema';
import { verifyPassword } from '@/lib/auth/password';
import { writeAuditLog } from '@/lib/audit/log';

export const bypassReasonSchema = z
  .string()
  .min(10, 'Sebep en az 10 karakter olmalı (denetim için)')
  .max(500, 'Sebep en fazla 500 karakter');

export interface BypassGuardInput {
  /** Süperadmin user'ın kendi parolası (re-auth). */
  superadminPassword: string;
  /** Zorunlu sebep (audit'e yazılır). */
  reason: string;
}

export type BypassGuardResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_reason'; issues: string[] }
  | { ok: false; reason: 'invalid_password' }
  | { ok: false; reason: 'user_not_found' };

/**
 * Süperadmin bypass aksiyonu başlatmadan önce zorunlu kontroller:
 *   1. Sebep min 10 char check (Zod)
 *   2. Süperadmin'in DB'deki passwordHash'i ile gelen şifre eşleşir mi
 *
 * NOT: Caller önce session.role === 'SUPERADMIN' check yapmalı (sayfa guard).
 * Bu helper sadece şifre re-auth + reason validate eder.
 */
export async function verifyBypassGuard(
  superadminUserId: string,
  input: BypassGuardInput,
  db: DbClient,
): Promise<BypassGuardResult> {
  const reasonParsed = bypassReasonSchema.safeParse(input.reason);
  if (!reasonParsed.success) {
    return {
      ok: false,
      reason: 'invalid_reason',
      issues: reasonParsed.error.issues.map((i) => i.message),
    };
  }

  const rows = await db
    .select({ passwordHash: users.passwordHash, role: users.role })
    .from(users)
    .where(eq(users.id, superadminUserId))
    .limit(1);
  const u = rows[0];
  if (!u?.passwordHash) {
    return { ok: false, reason: 'user_not_found' };
  }

  const passOk = await verifyPassword(input.superadminPassword, u.passwordHash);
  if (!passOk) {
    return { ok: false, reason: 'invalid_password' };
  }

  return { ok: true };
}

/**
 * Bypass aksiyonu başarıyla tamamlandıktan sonra audit log'a yaz.
 *
 * action pattern: 'superadmin.bypass.<aksiyon>' (örn. 'superadmin.bypass.reverse_expired')
 * companyId: aksiyonun etkilediği tenant (null olabilir sistem-genel ise).
 */
export async function writeBypassAudit(params: {
  companyId: string | null;
  superadminUserId: string;
  action: string; // 'superadmin.bypass.<x>'
  entityType?: string;
  entityId?: string;
  reason: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  db: DbClient;
  now?: Date;
}): Promise<void> {
  // audit_logs.companyId NULLABLE (schema:152) — sistem-genel bypass için null geçerli
  await writeAuditLog(
    {
      companyId: (params.companyId ?? null) as string, // schema field accepts null
      userId: params.superadminUserId,
      action: params.action,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      beforeState: params.beforeState ?? null,
      afterState: params.afterState ?? null,
      performedAsSuperadmin: true,
      superadminActionType: 'bypass',
      superadminReason: params.reason,
    },
    params.db,
    params.now,
  );
}

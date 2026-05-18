/**
 * Moderation audit logging — flagged içerik tespit edilince audit_logs'a yaz.
 *
 * Tüm server action'larda ortak pattern:
 * ```ts
 * const moderation = await moderateFields({ ... });
 * if (moderation.flagged) {
 *   logModerationFlag({ companyId, userId, entityType, entityId, result: moderation }, db);
 * }
 * ```
 *
 * `writeAuditLogAsync` fire-and-forget — server action redirect/return'i geciktirmez.
 */

import type { DbClient } from '@/lib/db/client';
import { writeAuditLogAsync } from '@/lib/audit/log';
import type { ModerationReason } from './check';

export interface ModerationAuditPayload {
  companyId: string | null;
  userId: string;
  entityType: string;
  entityId: string | null;
  action?: string; // default 'moderation.flagged'
  result: {
    flagged: boolean;
    fieldsFlagged?: string[];
    reasons: ModerationReason[];
  };
}

export function logModerationFlag(payload: ModerationAuditPayload, db: DbClient): void {
  if (!payload.result.flagged) return;
  if (!payload.companyId) return; // audit_logs.companyId notNull olmasa da pratikte tenant izi gerekli
  writeAuditLogAsync(
    {
      companyId: payload.companyId,
      userId: payload.userId,
      action: payload.action ?? 'moderation.flagged',
      entityType: payload.entityType,
      entityId: payload.entityId,
      afterState: {
        fieldsFlagged: payload.result.fieldsFlagged ?? [],
        reasons: payload.result.reasons.map((r) => ({
          source: r.source,
          category: r.category,
          term: r.term ?? null,
        })),
      },
    },
    db,
  );
}

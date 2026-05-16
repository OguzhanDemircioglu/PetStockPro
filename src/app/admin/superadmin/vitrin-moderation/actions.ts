'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db/client';
import { auth } from '@/lib/auth/auth';
import { isSuperadmin } from '@/lib/superadmin/access';
import { flagFeedback, unflagFeedback } from '@/lib/vitrin/moderation';
import { resolveReport } from '@/lib/vitrin/reports';
import { writeAuditLogAsync } from '@/lib/audit/log';

export interface ModerationActionState {
  ok?: boolean;
  error?: string;
  action?: 'flagged' | 'unflagged' | 'report_resolved' | 'report_dismissed';
}

const REASON_MESSAGES: Record<string, string> = {
  not_found: 'Kayıt bulunamadı.',
  already_flagged: 'Bu kayıt zaten işaretli.',
  not_flagged: 'Bu kayıt zaten temiz, çekilecek bir flag yok.',
  already_resolved: 'Bu şikayet zaten ele alınmış.',
  invalid_input: 'Geçersiz giriş — UUID veya sebep yanlış formatlı.',
};

export async function flagFeedbackAction(
  _prev: ModerationActionState | null,
  formData: FormData,
): Promise<ModerationActionState> {
  const session = await auth();
  if (!session?.user?.id || !isSuperadmin(session)) {
    redirect('/login' as never);
  }

  const feedbackId = String(formData.get('feedbackId') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();

  const result = await flagFeedback(
    {
      feedbackId,
      superadminUserId: session.user.id,
      reason,
    },
    db,
  );

  if (!result.ok) {
    return {
      ok: false,
      error: REASON_MESSAGES[result.reason] ?? 'Bilinmeyen hata.',
    };
  }

  writeAuditLogAsync(
    {
      userId: session.user.id,
      companyId: result.companyId,
      action: 'vitrin_feedback.flagged',
      entityType: 'vitrin_whatsapp_feedback',
      entityId: feedbackId,
      performedAsSuperadmin: true,
      superadminActionType: 'system',
      superadminReason: reason,
      afterState: { reason },
    },
    db,
  );

  revalidatePath('/admin/superadmin/vitrin-moderation');
  return { ok: true, action: 'flagged' };
}

export async function unflagFeedbackAction(
  _prev: ModerationActionState | null,
  formData: FormData,
): Promise<ModerationActionState> {
  const session = await auth();
  if (!session?.user?.id || !isSuperadmin(session)) {
    redirect('/login' as never);
  }

  const feedbackId = String(formData.get('feedbackId') ?? '');

  const result = await unflagFeedback(feedbackId, db);

  if (!result.ok) {
    return {
      ok: false,
      error: REASON_MESSAGES[result.reason] ?? 'Bilinmeyen hata.',
    };
  }

  writeAuditLogAsync(
    {
      userId: session.user.id,
      companyId: result.companyId,
      action: 'vitrin_feedback.unflagged',
      entityType: 'vitrin_whatsapp_feedback',
      entityId: feedbackId,
      performedAsSuperadmin: true,
      superadminActionType: 'system',
      afterState: {},
    },
    db,
  );

  revalidatePath('/admin/superadmin/vitrin-moderation');
  return { ok: true, action: 'unflagged' };
}

export async function resolveReportAction(
  _prev: ModerationActionState | null,
  formData: FormData,
): Promise<ModerationActionState> {
  const session = await auth();
  if (!session?.user?.id || !isSuperadmin(session)) {
    redirect('/login' as never);
  }

  const reportId = String(formData.get('reportId') ?? '');
  const resolution = String(formData.get('resolution') ?? '');
  const resolutionNote = String(formData.get('resolutionNote') ?? '').trim();

  if (resolution !== 'resolved' && resolution !== 'dismissed') {
    return { ok: false, error: 'Geçersiz çözüm tipi.' };
  }

  const result = await resolveReport(
    {
      reportId,
      superadminUserId: session.user.id,
      resolution,
      resolutionNote: resolutionNote || undefined,
    },
    db,
  );

  if (!result.ok) {
    return {
      ok: false,
      error: REASON_MESSAGES[result.reason] ?? 'Bilinmeyen hata.',
    };
  }

  writeAuditLogAsync(
    {
      userId: session.user.id,
      companyId: result.companyId,
      action: `vitrin_report.${resolution}`,
      entityType: 'vitrin_report',
      entityId: reportId,
      performedAsSuperadmin: true,
      superadminActionType: 'system',
      superadminReason: resolutionNote || null,
      afterState: { resolution, resolutionNote },
    },
    db,
  );

  revalidatePath('/admin/superadmin/vitrin-moderation');
  return {
    ok: true,
    action: resolution === 'resolved' ? 'report_resolved' : 'report_dismissed',
  };
}

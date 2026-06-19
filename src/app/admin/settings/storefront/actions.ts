'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { withTenant } from '@/lib/db/with-tenant';
import { upsertStorefrontSettings } from '@/lib/storefront/settings';
import { writeAuditLogAsync } from '@/lib/audit/log';
import { logModerationFlag } from '@/lib/moderation/audit';
import type { ModerationFlagsResult } from '@/lib/moderation/redirect-suffix';

export interface StorefrontFormState {
  ok?: boolean;
  error?: string;
  issues?: string[];
  moderationFlags?: ModerationFlagsResult;
}

const asStr = (v: FormDataEntryValue | null): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
};

export async function saveStorefrontAction(
  _prev: StorefrontFormState | null,
  formData: FormData,
): Promise<StorefrontFormState> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) redirect('/login' as never);
  const companyId = session.user.companyId;

  const isEnabled = formData.get('isEnabled') === 'on';

  const result = await withTenant(companyId, (tx) =>
    upsertStorefrontSettings(
      companyId,
      {
        isEnabled,
        aboutContent: asStr(formData.get('aboutContent')),
        contactPhone: asStr(formData.get('contactPhone')),
        contactWhatsapp: asStr(formData.get('contactWhatsapp')),
        contactTelegram: asStr(formData.get('contactTelegram')),
        contactEmail: asStr(formData.get('contactEmail')),
        socialInstagram: asStr(formData.get('socialInstagram')),
        socialFacebook: asStr(formData.get('socialFacebook')),
        socialTwitter: asStr(formData.get('socialTwitter')),
        socialTiktok: asStr(formData.get('socialTiktok')),
        metaDescription: asStr(formData.get('metaDescription')),
      },
      tx,
    ),
  );

  if (!result.ok) {
    if (result.reason === 'invalid_input') {
      return { error: result.issues.join(', '), issues: result.issues };
    }
    return { error: 'Kaydedilemedi (beklenmedik hata)' };
  }

  writeAuditLogAsync(
    {
      companyId: session.user.companyId,
      userId: session.user.id,
      action: 'storefront.settings_updated',
      entityType: 'company',
      entityId: session.user.companyId,
      afterState: { isEnabled },
    },
    db,
  );

  if (result.moderationFlags?.flagged) {
    logModerationFlag(
      {
        companyId: session.user.companyId,
        userId: session.user.id,
        entityType: 'company',
        entityId: session.user.companyId,
        action: 'moderation.flagged.storefront',
        result: result.moderationFlags,
      },
      db,
    );
  }

  revalidatePath('/admin/settings/storefront');
  revalidatePath('/admin/settings');
  return {
    ok: true,
    ...(result.moderationFlags?.flagged ? { moderationFlags: result.moderationFlags } : {}),
  };
}

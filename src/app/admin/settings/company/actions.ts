'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { withTenant } from '@/lib/db/with-tenant';
import {
  updateCompanyProfile,
  verifyAndSaveVatNo,
  type CompanyProfileInput,
} from '@/lib/company/settings';
import { writeAuditLogAsync } from '@/lib/audit/log';
import { logModerationFlag } from '@/lib/moderation/audit';
import type { ModerationFlagsResult } from '@/lib/moderation/redirect-suffix';

export interface CompanyActionState {
  ok: boolean;
  message: string | null;
  issues: string[];
  moderationFlags?: ModerationFlagsResult;
}

const EMPTY: CompanyActionState = {
  ok: false,
  message: null,
  issues: [],
};

function asStr(v: FormDataEntryValue | null): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

export async function updateCompanyAction(
  _prev: CompanyActionState | null,
  formData: FormData,
): Promise<CompanyActionState> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) redirect('/login' as never);
  const companyId = session.user.companyId;

  const name = asStr(formData.get('name'));
  if (!name) return { ...EMPTY, message: 'Firma adı zorunlu' };

  const cityIdRaw = asStr(formData.get('cityId'));
  const cityId = cityIdRaw ? parseInt(cityIdRaw, 10) : null;

  const input: CompanyProfileInput = {
    name,
    vatNo: asStr(formData.get('vatNo')),
    billingAddress: asStr(formData.get('billingAddress')),
    whatsappPhone: asStr(formData.get('whatsappPhone')),
    cityId: cityId && Number.isFinite(cityId) ? cityId : null,
    districtId: asStr(formData.get('districtId')),
    locationLat: asStr(formData.get('locationLat')),
    locationLng: asStr(formData.get('locationLng')),
  };

  const result = await withTenant(companyId, (tx) =>
    updateCompanyProfile(companyId, input, tx),
  );
  if (!result.ok) {
    const msg: Record<string, string> = {
      invalid_input: 'Geçersiz alan',
      not_found: 'Firma bulunamadı',
      unknown: 'Kaydedilemedi, tekrar dene',
    };
    return {
      ...EMPTY,
      message: msg[result.reason] ?? 'Hata',
      issues: result.issues ?? [],
    };
  }

  writeAuditLogAsync(
    {
      companyId: session.user.companyId,
      userId: session.user.id,
      action: input.vatNo ? 'company.vat_no_set' : 'company.updated',
      entityType: 'company',
      entityId: session.user.companyId,
      afterState: {
        name: input.name,
        hasVatNo: !!input.vatNo,
        hasWhatsapp: !!input.whatsappPhone,
      },
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
        result: result.moderationFlags,
      },
      db,
    );
  }

  revalidatePath('/admin/settings/company');
  revalidatePath('/admin/products');
  return {
    ok: true,
    message: 'Firma bilgileri güncellendi',
    issues: [],
    ...(result.moderationFlags?.flagged ? { moderationFlags: result.moderationFlags } : {}),
  };
}

export interface VatVerifyState {
  ok: boolean;
  kind?: 'efatura' | 'earsiv' | 'invalid';
  title?: string | null;
  message?: string;
}

/**
 * "Doğrula" butonu — VKN/TCKN'yi Nilvera'da sorgula, sonucu kaydet + göster.
 * Geçerliyse vatNo da kaydedilir (verifyAndSaveVatNo).
 */
export async function verifyVatNoAction(vatNo: string): Promise<VatVerifyState> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) redirect('/login' as never);
  const companyId = session.user.companyId;

  const res = await withTenant(companyId, (tx) => verifyAndSaveVatNo(companyId, vatNo, tx));
  if (!res.ok) {
    return {
      ok: false,
      message:
        res.reason === 'empty'
          ? 'Önce VKN/TCKN gir'
          : 'Nilvera şu an yanıt vermedi, biraz sonra tekrar dene',
    };
  }

  writeAuditLogAsync(
    {
      companyId,
      userId: session.user.id,
      action: 'company.vat_no_verified',
      entityType: 'company',
      entityId: companyId,
      afterState: { kind: res.kind, hasTitle: !!res.title },
    },
    db,
  );
  revalidatePath('/admin/settings/company');
  revalidatePath('/admin/products');
  return { ok: true, kind: res.kind, title: res.title };
}

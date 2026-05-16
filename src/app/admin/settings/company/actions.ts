'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import {
  updateCompanyProfile,
  type CompanyProfileInput,
} from '@/lib/company/settings';
import { writeAuditLogAsync } from '@/lib/audit/log';

export interface CompanyActionState {
  ok: boolean;
  message: string | null;
  issues: string[];
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

  const name = asStr(formData.get('name'));
  if (!name) return { ...EMPTY, message: 'Firma adı zorunlu' };

  const cityIdRaw = asStr(formData.get('cityId'));
  const cityId = cityIdRaw ? parseInt(cityIdRaw, 10) : null;

  const input: CompanyProfileInput = {
    name,
    vatNo: asStr(formData.get('vatNo')),
    whatsappPhone: asStr(formData.get('whatsappPhone')),
    cityId: cityId && Number.isFinite(cityId) ? cityId : null,
    districtId: asStr(formData.get('districtId')),
    locationLat: asStr(formData.get('locationLat')),
    locationLng: asStr(formData.get('locationLng')),
  };

  const result = await updateCompanyProfile(session.user.companyId, input, db);
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

  revalidatePath('/admin/settings/company');
  revalidatePath('/admin/products');
  return {
    ok: true,
    message: 'Firma bilgileri güncellendi',
    issues: [],
  };
}

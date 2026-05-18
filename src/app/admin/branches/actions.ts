'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import {
  addBranch,
  updateBranch,
  setBranchActive,
  type BranchInput,
} from '@/lib/branches/manage';
import { writeAuditLogAsync } from '@/lib/audit/log';
import { logModerationFlag } from '@/lib/moderation/audit';
import { moderationRedirectSuffix } from '@/lib/moderation/redirect-suffix';

export interface BranchActionState {
  ok: boolean;
  message: string | null;
  issues: string[];
  branchId: string | null;
}

const EMPTY: BranchActionState = {
  ok: false,
  message: null,
  issues: [],
  branchId: null,
};

function asStr(v: FormDataEntryValue | null): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function parseFormInput(formData: FormData): BranchInput | null {
  const name = asStr(formData.get('name'));
  const cityIdRaw = asStr(formData.get('cityId'));
  const cityId = cityIdRaw ? parseInt(cityIdRaw, 10) : null;
  const districtId = asStr(formData.get('districtId'));
  const address = asStr(formData.get('address'));
  const whatsappPhone = asStr(formData.get('whatsappPhone'));

  if (!name || !cityId || !Number.isFinite(cityId) || !districtId) return null;

  return { name, cityId, districtId, address, whatsappPhone };
}

const REASON_MSG: Record<string, string> = {
  invalid_input: 'Geçersiz alan',
  city_not_found: 'İl bulunamadı',
  district_mismatch: 'İlçe bu ile ait değil',
  not_found: 'Şube bulunamadı',
  last_active_branch: 'Son aktif şube pasifleştirilemez',
  unknown: 'Kaydedilemedi, tekrar dene',
};

export async function addBranchAction(
  _prev: BranchActionState | null,
  formData: FormData,
): Promise<BranchActionState> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) redirect('/login' as never);

  const input = parseFormInput(formData);
  if (!input) {
    return {
      ...EMPTY,
      message: 'Şube adı, il ve ilçe zorunlu',
    };
  }

  const result = await addBranch(session.user.companyId, input, db);
  if (!result.ok) {
    return {
      ...EMPTY,
      message: REASON_MSG[result.reason] ?? 'Hata',
      issues: result.issues ?? [],
    };
  }

  writeAuditLogAsync(
    {
      companyId: session.user.companyId,
      userId: session.user.id,
      action: 'branch.created',
      entityType: 'branch',
      entityId: result.branchId,
      afterState: { name: input.name, cityId: input.cityId },
    },
    db,
  );

  if (result.moderationFlags?.flagged) {
    logModerationFlag(
      {
        companyId: session.user.companyId,
        userId: session.user.id,
        entityType: 'branch',
        entityId: result.branchId,
        result: result.moderationFlags,
      },
      db,
    );
  }

  revalidatePath('/admin/branches');
  redirect(`/admin/branches?created=success${moderationRedirectSuffix(result.moderationFlags)}` as never);
}

export async function updateBranchAction(
  branchId: string,
  _prev: BranchActionState | null,
  formData: FormData,
): Promise<BranchActionState> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) redirect('/login' as never);

  const input = parseFormInput(formData);
  if (!input) {
    return {
      ...EMPTY,
      branchId,
      message: 'Şube adı, il ve ilçe zorunlu',
    };
  }

  const result = await updateBranch(session.user.companyId, branchId, input, db);
  if (!result.ok) {
    return {
      ...EMPTY,
      branchId,
      message: REASON_MSG[result.reason] ?? 'Hata',
      issues: result.issues ?? [],
    };
  }

  writeAuditLogAsync(
    {
      companyId: session.user.companyId,
      userId: session.user.id,
      action: 'branch.updated',
      entityType: 'branch',
      entityId: branchId,
      afterState: { name: input.name },
    },
    db,
  );

  if (result.moderationFlags?.flagged) {
    logModerationFlag(
      {
        companyId: session.user.companyId,
        userId: session.user.id,
        entityType: 'branch',
        entityId: branchId,
        result: result.moderationFlags,
      },
      db,
    );
  }

  revalidatePath('/admin/branches');
  redirect(`/admin/branches?updated=success${moderationRedirectSuffix(result.moderationFlags)}` as never);
}

export async function toggleBranchActiveAction(
  branchId: string,
  active: boolean,
): Promise<BranchActionState> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) redirect('/login' as never);

  const result = await setBranchActive(
    session.user.companyId,
    branchId,
    active,
    db,
  );
  if (!result.ok) {
    return {
      ...EMPTY,
      branchId,
      message: REASON_MSG[result.reason] ?? 'Hata',
    };
  }

  writeAuditLogAsync(
    {
      companyId: session.user.companyId,
      userId: session.user.id,
      action: active ? 'branch.activated' : 'branch.deactivated',
      entityType: 'branch',
      entityId: branchId,
    },
    db,
  );

  revalidatePath('/admin/branches');
  revalidatePath('/admin/stock-movements');
  return {
    ok: true,
    branchId,
    message: active ? 'Şube yeniden aktif' : 'Şube pasifleştirildi',
    issues: [],
  };
}

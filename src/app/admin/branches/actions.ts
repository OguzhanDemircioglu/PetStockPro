'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import {
  addBranch,
  updateBranch,
  setBranchActive,
  removeBranchManager,
  type BranchInput,
} from '@/lib/branches/manage';
import { setBranchStatus, type BranchStatus } from '@/lib/branches/status';
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
  branch_not_found: 'Şube bulunamadı',
  no_manager_assigned: 'Bu şubeye atanmış müdür yok',
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

export async function removeBranchManagerAction(
  branchId: string,
): Promise<BranchActionState> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) redirect('/login' as never);

  if (session.user.role !== 'BAYI_SAHIBI' && session.user.role !== 'SUPERADMIN') {
    return {
      ...EMPTY,
      branchId,
      message: 'Bu işlem için BAYI_SAHIBI yetkisi gerekli',
    };
  }

  const result = await removeBranchManager(session.user.companyId, branchId, db);
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
      action: 'branch.manager_removed',
      entityType: 'branch',
      entityId: branchId,
      afterState: {
        removedUserId: result.userId,
        removedEmail: result.email,
      },
    },
    db,
  );

  revalidatePath(`/admin/branches/${branchId}`);
  revalidatePath('/admin/settings/users');
  return {
    ok: true,
    branchId,
    message: `İzleyici kaldırıldı: ${result.email}`,
    issues: [],
  };
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

// ─────────────────────────────────────────────────────────────────
// Faz 4 (2026-05-21) — 3-state şube (active | holiday | inactive)
// ─────────────────────────────────────────────────────────────────

const STATUS_REASON_MSG: Record<string, string> = {
  not_found: 'Şube bulunamadı',
  invalid_status: 'Geçersiz durum',
  last_operational_branch:
    'Tüm şubeler pasifleştirilemez — en az 1 aktif veya tatildeki şube olmalı',
  no_change: 'Şube durumu zaten aynı — değişiklik yapılmadı',
  unknown: 'Hata',
};

export async function setBranchStatusAction(
  branchId: string,
  newStatus: BranchStatus,
): Promise<BranchActionState> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) redirect('/login' as never);

  // Faz 2 — Observer reject (status değiştirme mutation).
  if (session.user.role === 'OBSERVER') {
    return {
      ...EMPTY,
      branchId,
      message: 'İzleyici modundasın — bu işlem yapılamaz',
    };
  }
  // STAFF için status değiştirme yetkisi YOK — sadece BAYI_SAHIBI/SUPERADMIN.
  if (session.user.role === 'STAFF') {
    return {
      ...EMPTY,
      branchId,
      message: 'Şube durumunu değiştirme yetkisi yok — Bayi Admin\'den iste',
    };
  }

  const result = await setBranchStatus(
    session.user.companyId,
    branchId,
    newStatus,
    db,
  );

  if (!result.ok) {
    return {
      ...EMPTY,
      branchId,
      message: STATUS_REASON_MSG[result.reason] ?? 'Hata',
    };
  }

  writeAuditLogAsync(
    {
      companyId: session.user.companyId,
      userId: session.user.id,
      action: `branch.status_${newStatus}`,
      entityType: 'branch',
      entityId: branchId,
      beforeState: { status: result.previousStatus },
      afterState: { status: result.newStatus },
    },
    db,
  );

  revalidatePath('/admin/branches');
  revalidatePath(`/admin/branches/${branchId}`);
  revalidatePath('/admin/stock-movements');
  // Vitrin de yansıması olabilir (holiday badge + inactive çekilme).
  revalidatePath('/vitrin', 'layout');

  const labelTr =
    newStatus === 'active' ? 'aktif' : newStatus === 'holiday' ? 'tatilde' : 'pasif';
  return {
    ok: true,
    branchId,
    message: `Şube durumu güncellendi: ${labelTr}`,
    issues: [],
  };
}

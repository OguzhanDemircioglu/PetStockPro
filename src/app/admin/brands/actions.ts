'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { isSuperadmin } from '@/lib/superadmin/access';
import {
  addBrand,
  updateBrand,
  deleteBrand,
  type BrandInput,
} from '@/lib/brands/manage';
import { writeAuditLogAsync } from '@/lib/audit/log';
import { logModerationFlag } from '@/lib/moderation/audit';
import { moderationRedirectSuffix } from '@/lib/moderation/redirect-suffix';

export interface BrandActionState {
  ok: boolean;
  message: string | null;
  issues: string[];
  brandId: string | null;
}

const EMPTY: BrandActionState = {
  ok: false,
  message: null,
  issues: [],
  brandId: null,
};

function asStr(v: FormDataEntryValue | null): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function parseFormInput(formData: FormData): BrandInput | null {
  const name = asStr(formData.get('name'));
  if (!name) return null;
  return {
    name,
    logoUrl: asStr(formData.get('logoUrl')),
  };
}

const REASON_MSG: Record<string, string> = {
  invalid_input: 'Geçersiz alan',
  slug_taken: 'Bu marka adı zaten kullanılıyor',
  not_found: 'Marka bulunamadı',
  profanity: 'Marka adında uygunsuz içerik tespit edildi — lütfen düzelt',
  unknown: 'Kaydedilemedi, tekrar dene',
};

export async function addBrandAction(
  _prev: BrandActionState | null,
  formData: FormData,
): Promise<BrandActionState> {
  const session = await auth();
  if (!session?.user?.id) redirect('/login' as never);

  // 2026-05-22 Migration 0026 — brands GLOBAL, CRUD SUPERADMIN-only.
  if (!isSuperadmin(session)) {
    return {
      ...EMPTY,
      message: 'Sadece süperadmin marka ekleyebilir',
    };
  }

  const input = parseFormInput(formData);
  if (!input) return { ...EMPTY, message: 'Marka adı zorunlu' };

  const result = await addBrand(input, db);
  if (!result.ok) {
    return {
      ...EMPTY,
      message: REASON_MSG[result.reason] ?? 'Hata',
      issues: result.issues ?? [],
    };
  }

  writeAuditLogAsync(
    {
      // Global brand action — audit companyId null (SUPERADMIN cross-tenant)
      companyId: session.user.companyId ?? null,
      userId: session.user.id,
      action: 'brand.created',
      entityType: 'brand',
      entityId: result.brandId,
      afterState: { name: input.name },
      performedAsSuperadmin: true,
    },
    db,
  );

  if (result.moderationFlags?.flagged) {
    logModerationFlag(
      {
        companyId: session.user.companyId ?? null,
        userId: session.user.id,
        entityType: 'brand',
        entityId: result.brandId,
        result: result.moderationFlags,
      },
      db,
    );
  }

  revalidatePath('/admin/brands');
  revalidatePath('/admin/products');
  updateTag('brands');
  redirect(`/admin/brands?created=success${moderationRedirectSuffix(result.moderationFlags)}` as never);
}

export async function updateBrandAction(
  brandId: string,
  _prev: BrandActionState | null,
  formData: FormData,
): Promise<BrandActionState> {
  const session = await auth();
  if (!session?.user?.id) redirect('/login' as never);

  if (!isSuperadmin(session)) {
    return {
      ...EMPTY,
      brandId,
      message: 'Sadece süperadmin marka düzenleyebilir',
    };
  }

  const input = parseFormInput(formData);
  if (!input) return { ...EMPTY, brandId, message: 'Marka adı zorunlu' };

  const result = await updateBrand(brandId, input, db);
  if (!result.ok) {
    return {
      ...EMPTY,
      brandId,
      message: REASON_MSG[result.reason] ?? 'Hata',
      issues: result.issues ?? [],
    };
  }

  writeAuditLogAsync(
    {
      companyId: session.user.companyId ?? null,
      userId: session.user.id,
      action: 'brand.updated',
      entityType: 'brand',
      entityId: brandId,
      afterState: { name: input.name },
      performedAsSuperadmin: true,
    },
    db,
  );

  if (result.moderationFlags?.flagged) {
    logModerationFlag(
      {
        companyId: session.user.companyId ?? null,
        userId: session.user.id,
        entityType: 'brand',
        entityId: brandId,
        result: result.moderationFlags,
      },
      db,
    );
  }

  revalidatePath('/admin/brands');
  revalidatePath('/admin/products');
  updateTag('brands');
  redirect(`/admin/brands?updated=success${moderationRedirectSuffix(result.moderationFlags)}` as never);
}

export async function deleteBrandAction(brandId: string): Promise<BrandActionState> {
  const session = await auth();
  if (!session?.user?.id) redirect('/login' as never);

  if (!isSuperadmin(session)) {
    return {
      ...EMPTY,
      brandId,
      message: 'Sadece süperadmin marka silebilir',
    };
  }

  const result = await deleteBrand(brandId, db);
  if (!result.ok) {
    return {
      ...EMPTY,
      brandId,
      message: REASON_MSG[result.reason] ?? 'Silinemedi',
    };
  }

  writeAuditLogAsync(
    {
      companyId: session.user.companyId ?? null,
      userId: session.user.id,
      action: 'brand.deleted',
      entityType: 'brand',
      entityId: brandId,
      afterState: { affectedProductCount: result.affectedProductCount },
      performedAsSuperadmin: true,
    },
    db,
  );

  revalidatePath('/admin/brands');
  revalidatePath('/admin/products');
  updateTag('brands');
  return {
    ok: true,
    brandId,
    message:
      result.affectedProductCount > 0
        ? `Marka silindi (${result.affectedProductCount} ürün markasız kaldı)`
        : 'Marka silindi',
    issues: [],
  };
}

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import {
  addBrand,
  updateBrand,
  deleteBrand,
  type BrandInput,
} from '@/lib/brands/manage';
import { writeAuditLogAsync } from '@/lib/audit/log';

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
  unknown: 'Kaydedilemedi, tekrar dene',
};

export async function addBrandAction(
  _prev: BrandActionState | null,
  formData: FormData,
): Promise<BrandActionState> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) redirect('/login' as never);

  const input = parseFormInput(formData);
  if (!input) return { ...EMPTY, message: 'Marka adı zorunlu' };

  const result = await addBrand(session.user.companyId, input, db);
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
      action: 'brand.created',
      entityType: 'brand',
      entityId: result.brandId,
      afterState: { name: input.name },
    },
    db,
  );

  revalidatePath('/admin/brands');
  revalidatePath('/admin/products');
  redirect('/admin/brands?created=success' as never);
}

export async function updateBrandAction(
  brandId: string,
  _prev: BrandActionState | null,
  formData: FormData,
): Promise<BrandActionState> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) redirect('/login' as never);

  const input = parseFormInput(formData);
  if (!input) return { ...EMPTY, brandId, message: 'Marka adı zorunlu' };

  const result = await updateBrand(session.user.companyId, brandId, input, db);
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
      companyId: session.user.companyId,
      userId: session.user.id,
      action: 'brand.updated',
      entityType: 'brand',
      entityId: brandId,
      afterState: { name: input.name },
    },
    db,
  );

  revalidatePath('/admin/brands');
  revalidatePath('/admin/products');
  redirect('/admin/brands?updated=success' as never);
}

export async function deleteBrandAction(brandId: string): Promise<BrandActionState> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) redirect('/login' as never);

  const result = await deleteBrand(session.user.companyId, brandId, db);
  if (!result.ok) {
    return {
      ...EMPTY,
      brandId,
      message: REASON_MSG[result.reason] ?? 'Silinemedi',
    };
  }

  writeAuditLogAsync(
    {
      companyId: session.user.companyId,
      userId: session.user.id,
      action: 'brand.deleted',
      entityType: 'brand',
      entityId: brandId,
      afterState: { affectedProductCount: result.affectedProductCount },
    },
    db,
  );

  revalidatePath('/admin/brands');
  revalidatePath('/admin/products');
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

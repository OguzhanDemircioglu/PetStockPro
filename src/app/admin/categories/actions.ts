'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import {
  addCategory,
  updateCategory,
  deleteCategory,
  type CategoryInput,
} from '@/lib/categories/manage';
import { writeAuditLogAsync } from '@/lib/audit/log';
import { isSuperadmin } from '@/lib/superadmin/access';

export interface CategoryActionState {
  ok: boolean;
  message: string | null;
  issues: string[];
  categoryId: string | null;
}

const EMPTY: CategoryActionState = {
  ok: false,
  message: null,
  issues: [],
  categoryId: null,
};

function asStr(v: FormDataEntryValue | null): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function parseFormInput(formData: FormData): CategoryInput | null {
  const name = asStr(formData.get('name'));
  if (!name) return null;
  const dispRaw = asStr(formData.get('displayOrder'));
  const displayOrder = dispRaw ? parseInt(dispRaw, 10) : 100;
  const parentRaw = asStr(formData.get('parentId'));
  const parentId = parentRaw === 'root' ? null : parentRaw;

  return {
    name,
    emoji: asStr(formData.get('emoji')) ?? undefined,
    sktRequired: formData.get('sktRequired') === 'on',
    displayOrder: Number.isFinite(displayOrder) ? displayOrder : 100,
    parentId,
  };
}

const REASON_MSG: Record<string, string> = {
  invalid_input: 'Geçersiz alan',
  slug_taken: 'Bu kategori adı zaten kullanılıyor',
  emoji_taken: 'Bu emoji başka bir kategoride zaten kullanılıyor — farklı bir emoji seç',
  not_found: 'Kategori bulunamadı',
  unknown: 'Kaydedilemedi, tekrar dene',
};

export async function addCategoryAction(
  _prev: CategoryActionState | null,
  formData: FormData,
): Promise<CategoryActionState> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) redirect('/login' as never);
  if (!isSuperadmin(session)) {
    return { ...EMPTY, message: 'Bu işlem için yetkin yok (sadece SUPERADMIN).' };
  }

  const input = parseFormInput(formData);
  if (!input) return { ...EMPTY, message: 'Kategori adı zorunlu' };

  const result = await addCategory(session.user.companyId, input, db);
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
      action: 'category.created',
      entityType: 'category',
      entityId: result.categoryId,
      afterState: { name: input.name, sktRequired: input.sktRequired },
    },
    db,
  );

  revalidatePath('/admin/categories');
  revalidatePath('/admin/products');
  redirect('/admin/categories?created=success' as never);
}

export async function updateCategoryAction(
  categoryId: string,
  _prev: CategoryActionState | null,
  formData: FormData,
): Promise<CategoryActionState> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) redirect('/login' as never);
  if (!isSuperadmin(session)) {
    return {
      ...EMPTY,
      categoryId,
      message: 'Bu işlem için yetkin yok (sadece SUPERADMIN).',
    };
  }

  const input = parseFormInput(formData);
  if (!input) return { ...EMPTY, categoryId, message: 'Kategori adı zorunlu' };

  const result = await updateCategory(
    session.user.companyId,
    categoryId,
    input,
    db,
  );
  if (!result.ok) {
    return {
      ...EMPTY,
      categoryId,
      message: REASON_MSG[result.reason] ?? 'Hata',
      issues: result.issues ?? [],
    };
  }

  writeAuditLogAsync(
    {
      companyId: session.user.companyId,
      userId: session.user.id,
      action: 'category.updated',
      entityType: 'category',
      entityId: categoryId,
      afterState: { name: input.name },
    },
    db,
  );

  revalidatePath('/admin/categories');
  revalidatePath('/admin/products');
  redirect('/admin/categories?updated=success' as never);
}

export async function deleteCategoryAction(
  categoryId: string,
): Promise<CategoryActionState> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) redirect('/login' as never);
  if (!isSuperadmin(session)) {
    return {
      ...EMPTY,
      categoryId,
      message: 'Bu işlem için yetkin yok (sadece SUPERADMIN).',
    };
  }

  const result = await deleteCategory(session.user.companyId, categoryId, db);
  if (!result.ok) {
    return {
      ...EMPTY,
      categoryId,
      message: REASON_MSG[result.reason] ?? 'Silinemedi',
    };
  }

  writeAuditLogAsync(
    {
      companyId: session.user.companyId,
      userId: session.user.id,
      action: 'category.deleted',
      entityType: 'category',
      entityId: categoryId,
      afterState: { affectedProductCount: result.affectedProductCount },
    },
    db,
  );

  revalidatePath('/admin/categories');
  revalidatePath('/admin/products');
  return {
    ok: true,
    categoryId,
    message:
      result.affectedProductCount > 0
        ? `Kategori silindi (${result.affectedProductCount} ürün kategorisiz kaldı)`
        : 'Kategori silindi',
    issues: [],
  };
}

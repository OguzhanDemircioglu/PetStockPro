'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import {
  publishProduct,
  unpublishProduct,
  type StorefrontIssue,
} from '@/lib/catalog/storefront';
import { writeAuditLogAsync } from '@/lib/audit/log';

export interface StorefrontActionState {
  ok: boolean;
  message: string | null;
  issues: StorefrontIssue[];
  scope: 'publish' | 'unpublish' | null;
}

export async function publishProductAction(
  productId: string,
): Promise<StorefrontActionState> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) {
    redirect('/login' as never);
  }

  const result = await publishProduct(
    session.user.companyId,
    productId,
    session.user.id,
    db,
  );

  if (!result.ok) {
    if (result.reason === 'validation_failed') {
      return {
        ok: false,
        message: 'Vitrin için eksik bilgi var',
        issues: result.issues ?? [],
        scope: 'publish',
      };
    }
    if (result.reason === 'not_found') {
      return {
        ok: false,
        message: 'Ürün bulunamadı',
        issues: [],
        scope: 'publish',
      };
    }
    return {
      ok: false,
      message: 'Vitrin açılamadı, tekrar dene',
      issues: [],
      scope: 'publish',
    };
  }

  if (!result.alreadyPublished) {
    writeAuditLogAsync(
      {
        companyId: session.user.companyId,
        userId: session.user.id,
        action: 'storefront.published',
        entityType: 'product',
        entityId: productId,
      },
      db,
    );
  }

  revalidatePath(`/admin/products/${productId}/edit`);
  revalidatePath('/admin/products');
  return {
    ok: true,
    message: result.alreadyPublished ? 'Zaten vitrin\'de' : 'Vitrin\'e açıldı',
    issues: [],
    scope: 'publish',
  };
}

export async function unpublishProductAction(
  productId: string,
): Promise<StorefrontActionState> {
  const session = await auth();
  if (!session?.user?.companyId) {
    redirect('/login' as never);
  }

  const result = await unpublishProduct(session.user.companyId, productId, db);
  if (!result.ok) {
    return {
      ok: false,
      message: result.reason === 'not_found' ? 'Ürün bulunamadı' : 'Kapatılamadı',
      issues: [],
      scope: 'unpublish',
    };
  }

  if (!result.alreadyUnpublished && session.user.id) {
    writeAuditLogAsync(
      {
        companyId: session.user.companyId,
        userId: session.user.id,
        action: 'storefront.unpublished',
        entityType: 'product',
        entityId: productId,
      },
      db,
    );
  }

  revalidatePath(`/admin/products/${productId}/edit`);
  revalidatePath('/admin/products');
  return {
    ok: true,
    message: result.alreadyUnpublished ? 'Zaten kapalı' : 'Vitrin\'den kapatıldı',
    issues: [],
    scope: 'unpublish',
  };
}

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { withTenant, type TenantDb } from '@/lib/db/with-tenant';
import {
  publishProduct,
  unpublishProduct,
  type StorefrontIssue,
  type PublishResult,
  type UnpublishResult,
} from '@/lib/catalog/storefront';
import { writeAuditLogAsync } from '@/lib/audit/log';
import { assertNotObserver, ObserverReadOnlyError } from '@/lib/auth/role-gate';
import { hasPermission } from '@/lib/users/permissions';
import { PERMISSION_KEYS } from '@/lib/users/permission-keys';

export interface StorefrontActionState {
  ok: boolean;
  message: string | null;
  issues: StorefrontIssue[];
  scope: 'publish' | 'unpublish' | null;
}

async function guardVitrinManage(
  session: { user?: { id?: string; role?: string } | null } | null,
  scope: 'publish' | 'unpublish',
  db: TenantDb,
): Promise<StorefrontActionState | null> {
  try {
    assertNotObserver(session);
  } catch (e) {
    if (e instanceof ObserverReadOnlyError) {
      return {
        ok: false,
        message: 'İzleyici modundasın — bu işlem yapılamaz',
        issues: [],
        scope,
      };
    }
    throw e;
  }
  if (!session?.user?.id) return null;
  const allowed = await hasPermission(session.user.id, PERMISSION_KEYS.VITRIN_MANAGE, db);
  if (!allowed) {
    return {
      ok: false,
      message: 'Vitrin yönetimi yetkisi yok — Bayi Admin\'den iste',
      issues: [],
      scope,
    };
  }
  return null;
}

export async function publishProductAction(
  productId: string,
): Promise<StorefrontActionState> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) {
    redirect('/login' as never);
  }

  const companyId = session.user.companyId;
  const userId = session.user.id;
  const outcome = await withTenant<
    { gate: StorefrontActionState } | { result: PublishResult }
  >(companyId, async (tx) => {
    const gate = await guardVitrinManage(session, 'publish', tx);
    if (gate) return { gate };
    const result = await publishProduct(companyId, productId, userId, tx);
    return { result };
  });
  if ('gate' in outcome) return outcome.gate;
  const result = outcome.result;

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
    if (result.reason === 'vitrin_limit_exceeded') {
      return {
        ok: false,
        message: `Vitrin limitin doldu (${result.count}/${result.limit}) — PRO'ya geç veya başka bir ürünü vitrin'den kapat`,
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

  const companyId = session.user.companyId;
  const outcome = await withTenant<
    { gate: StorefrontActionState } | { result: UnpublishResult }
  >(companyId, async (tx) => {
    const gate = await guardVitrinManage(session, 'unpublish', tx);
    if (gate) return { gate };
    const result = await unpublishProduct(companyId, productId, tx);
    return { result };
  });
  if ('gate' in outcome) return outcome.gate;
  const result = outcome.result;
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

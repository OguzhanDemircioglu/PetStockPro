'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { categories, products } from '@/db/schema';
import { seedDefaultCategoriesForCompany } from '@/lib/catalog/default-categories';
import { writeAuditLogAsync } from '@/lib/audit/log';
import { isSuperadmin } from '@/lib/superadmin/access';

export interface ResetCategoriesState {
  ok?: boolean;
  error?: string;
  deletedCount?: number;
  insertedCount?: number;
  productsAffected?: number;
}

/**
 * Admin tarafı default kategorilere sıfırla — sadece SUPERADMIN.
 *
 * Akış: Tüm kategorileri sil (FK ON DELETE SET NULL ile ürünler kategorisiz
 * kalır) → seedDefaultCategoriesForCompany 49 hiyerarşik kategori seed → audit.
 */
export async function resetMyCategoriesAction(
  _prev: ResetCategoriesState | null,
  _formData: FormData,
): Promise<ResetCategoriesState> {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.companyId) {
    redirect('/login' as never);
  }
  if (!isSuperadmin(session)) {
    return {
      ok: false,
      error: 'Bu işlem için yetkin yok (sadece SUPERADMIN).',
    };
  }

  const companyId = session.user.companyId;

  try {
    const affectedRows = await db
      .select({ id: products.id })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(categories.companyId, companyId));
    const productsAffected = affectedRows.length;

    const deletedRows = await db
      .delete(categories)
      .where(eq(categories.companyId, companyId))
      .returning({ id: categories.id });

    const { inserted } = await seedDefaultCategoriesForCompany(companyId, db);

    writeAuditLogAsync(
      {
        userId: session.user.id,
        companyId,
        action: 'category.reset_to_defaults',
        entityType: 'company',
        entityId: companyId,
        afterState: {
          deletedCount: deletedRows.length,
          insertedCount: inserted,
          productsAffected,
        },
      },
      db,
    );

    revalidatePath('/admin/categories');
    return {
      ok: true,
      deletedCount: deletedRows.length,
      insertedCount: inserted,
      productsAffected,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Bilinmeyen hata.',
    };
  }
}

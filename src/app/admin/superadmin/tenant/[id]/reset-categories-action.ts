'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { categories, products } from '@/db/schema';
import { isSuperadmin } from '@/lib/superadmin/access';
import { seedDefaultCategoriesForCompany } from '@/lib/catalog/default-categories';
import { writeAuditLogAsync } from '@/lib/audit/log';

export interface ResetCategoriesState {
  ok?: boolean;
  error?: string;
  deletedCount?: number;
  insertedCount?: number;
  productsAffected?: number;
}

/**
 * Tenant default kategorilere sıfırla — sadece SUPERADMIN.
 *
 * Akış:
 *   1. Tüm tenant kategorilerini sil. Ürünler categoryId SET NULL olur (FK
 *      ON DELETE SET NULL).
 *   2. seedDefaultCategoriesForCompany ile 49 hiyerarşik kategori yeniden insert.
 *   3. Audit log: 'superadmin.tenant.categories_reset'.
 *
 * UYARI: Tenant'ın özelleştirdiği kategori isimleri/slug'ları kaybolur.
 * Ürünler kategorisiz kalır — kullanıcı kategorilerini tekrar atamak zorundadır.
 */
export async function resetCategoriesAction(
  _prev: ResetCategoriesState | null,
  formData: FormData,
): Promise<ResetCategoriesState> {
  const session = await auth();
  if (!session?.user?.id || !isSuperadmin(session)) {
    redirect('/login' as never);
  }

  const companyId = formData.get('companyId');
  if (typeof companyId !== 'string' || !companyId) {
    return { ok: false, error: 'Geçersiz company ID.' };
  }

  try {
    // 1. Etkilenecek ürün sayısını sayalım (audit için)
    const affectedRows = await db
      .select({ count: products.id })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(categories.companyId, companyId));
    const productsAffected = affectedRows.length;

    // 2. Mevcut kategorileri sil (FK ON DELETE SET NULL ile ürünler kategorisiz kalır)
    const deletedRows = await db
      .delete(categories)
      .where(eq(categories.companyId, companyId))
      .returning({ id: categories.id });

    // 3. Default 49 hiyerarşik kategoriyi seed et
    const { inserted } = await seedDefaultCategoriesForCompany(companyId, db);

    // 4. Audit log
    writeAuditLogAsync(
      {
        userId: session.user.id,
        companyId,
        action: 'superadmin.tenant.categories_reset',
        entityType: 'company',
        entityId: companyId,
        performedAsSuperadmin: true,
        superadminActionType: 'dbfix',
        superadminReason: 'Default 49 hiyerarşik kategoriye sıfırlama',
        afterState: {
          deletedCount: deletedRows.length,
          insertedCount: inserted,
          productsAffected,
        },
      },
      db,
    );

    revalidatePath(`/admin/superadmin/tenant/${companyId}`);
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

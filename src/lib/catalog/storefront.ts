/**
 * Storefront (Satışa Aç) Helpers — Sprint 3.4 + Sprint 3.3 (image upload aktif)
 *
 * validateForStorefront: vitrin'e açılabilir mi? Çoklu issue döner.
 * publishProduct: validation pass → vitrin'e aç (idempotent, audit alanları doldur).
 * unpublishProduct: manuel "Satışa Kapat" — vitrinAutoUnpublishedReason='manual'.
 *
 * İnvariantlar:
 * - Pet shop'un vergi numarası zorunlu (B2B muhasebe için).
 * - Ürünün en az 1 aktif variant'ı + makul satış fiyatı.
 * - **En az 1 görsel zorunlu** (`requireImage: true` default, Sprint 3.3 R2 image
 *   upload aktif). Test'lerde `requireImage: false` geçilerek devre dışı bırakılır.
 * - Manuel publish: validation tüm issue temiz → ancak başarılı.
 */

import { and, eq, sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import {
  products,
  productVariants,
  productImages,
  companies,
} from '@/db/schema';
import { canPublishToVitrin } from '@/lib/billing/plan-features';

// ─────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────

export type StorefrontIssueCode =
  | 'missing_vat_no'
  | 'product_inactive'
  | 'no_active_variant'
  | 'invalid_sale_price'
  | 'missing_category'
  | 'missing_image';

export interface StorefrontIssue {
  code: StorefrontIssueCode;
  message: string;
}

export interface StorefrontValidationResult {
  ok: boolean;
  issues: StorefrontIssue[];
  // Yardımcı: çağıran UI'da değişiklik gösterirken kullanışlı
  meta: {
    activeVariantCount: number;
    imageCount: number;
    minSalePrice: string | null;
    maxSalePrice: string | null;
    hasVatNo: boolean;
    hasCategory: boolean;
    isActive: boolean;
  };
}

export interface ValidateOptions {
  /**
   * En az 1 görsel zorunlu mu? Sprint 3.3 R2 image upload aktif (default true).
   * `requireImage: false` geçilirse görsel kontrolü atlanır — test/önizleme için.
   */
  requireImage?: boolean;
  /** Min satış fiyatı (₺) — varsayılan 1 */
  minSalePrice?: number;
  /** Max satış fiyatı (₺) — varsayılan 50000 (makul üst sınır) */
  maxSalePrice?: number;
}

const DEFAULT_OPTS: Required<ValidateOptions> = {
  requireImage: true,
  minSalePrice: 1,
  maxSalePrice: 50000,
};

export async function validateForStorefront(
  companyId: string,
  productId: string,
  db: DbClient,
  opts: ValidateOptions = {},
): Promise<StorefrontValidationResult> {
  const config = { ...DEFAULT_OPTS, ...opts };
  const issues: StorefrontIssue[] = [];

  // Tek sorguda tüm bilgileri çek: product + company + variant aggregate + image count
  const rows = await db
    .select({
      productId: products.id,
      isActive: products.isActive,
      categoryId: products.categoryId,
      vitrinPublished: products.vitrinPublished,
      companyVatNo: companies.vatNo,
      activeVariantCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${productVariants}
        WHERE ${productVariants.productId} = ${products.id}
          AND ${productVariants.isActive} = true
      )`,
      minSalePrice: sql<string | null>`(
        SELECT MIN(${productVariants.salePrice})::text FROM ${productVariants}
        WHERE ${productVariants.productId} = ${products.id}
          AND ${productVariants.isActive} = true
      )`,
      maxSalePrice: sql<string | null>`(
        SELECT MAX(${productVariants.salePrice})::text FROM ${productVariants}
        WHERE ${productVariants.productId} = ${products.id}
          AND ${productVariants.isActive} = true
      )`,
      imageCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${productImages}
        WHERE ${productImages.productId} = ${products.id}
      )`,
    })
    .from(products)
    .innerJoin(companies, eq(companies.id, products.companyId))
    .where(
      and(
        eq(products.id, productId),
        eq(products.companyId, companyId),
        sql`${products.deletedAt} IS NULL`,
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return {
      ok: false,
      issues: [
        { code: 'product_inactive', message: 'Ürün bulunamadı veya silinmiş' },
      ],
      meta: {
        activeVariantCount: 0,
        imageCount: 0,
        minSalePrice: null,
        maxSalePrice: null,
        hasVatNo: false,
        hasCategory: false,
        isActive: false,
      },
    };
  }

  if (!row.companyVatNo || row.companyVatNo.length < 10) {
    issues.push({
      code: 'missing_vat_no',
      message: 'Şirket vergi numarası eksik — Ayarlar > Şirket bölümünden ekle',
    });
  }

  if (!row.isActive) {
    issues.push({
      code: 'product_inactive',
      message: 'Ürün pasif durumda — önce Aktif yap',
    });
  }

  if (!row.categoryId) {
    issues.push({
      code: 'missing_category',
      message: 'Kategori seçili değil — Kategori atayarak vitrin müşterisinin bulması kolaylaşır',
    });
  }

  if (row.activeVariantCount === 0) {
    issues.push({
      code: 'no_active_variant',
      message: 'Hiç aktif variant yok — en az bir aktif variant gerekli',
    });
  } else {
    // Fiyat kontrolü (aktif variant varsa)
    const minPrice = parseFloat(row.minSalePrice ?? '0');
    const maxPrice = parseFloat(row.maxSalePrice ?? '0');
    if (
      !Number.isFinite(minPrice) ||
      minPrice < config.minSalePrice ||
      maxPrice > config.maxSalePrice
    ) {
      issues.push({
        code: 'invalid_sale_price',
        message: `Satış fiyatı makul aralıkta olmalı (${config.minSalePrice}₺ - ${config.maxSalePrice}₺)`,
      });
    }
  }

  if (config.requireImage && row.imageCount === 0) {
    issues.push({
      code: 'missing_image',
      message: 'En az bir ürün görseli ekle — müşteri görselsiz ürüne tıklamaz',
    });
  }

  return {
    ok: issues.length === 0,
    issues,
    meta: {
      activeVariantCount: row.activeVariantCount,
      imageCount: row.imageCount,
      minSalePrice: row.minSalePrice,
      maxSalePrice: row.maxSalePrice,
      hasVatNo: Boolean(row.companyVatNo && row.companyVatNo.length >= 10),
      hasCategory: Boolean(row.categoryId),
      isActive: row.isActive,
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// PUBLISH
// ─────────────────────────────────────────────────────────────────

export type PublishResult =
  | { ok: true; alreadyPublished: boolean }
  | {
      ok: false;
      reason: 'not_found' | 'validation_failed' | 'unknown';
      issues?: StorefrontIssue[];
    }
  | {
      ok: false;
      reason: 'vitrin_limit_exceeded';
      limit: number;
      count: number;
    };

/**
 * Ürünü vitrin'e açar. Idempotent: zaten yayında ise no-op + alreadyPublished=true.
 * Validation issue varsa açılmaz.
 */
export async function publishProduct(
  companyId: string,
  productId: string,
  userId: string,
  db: DbClient,
  opts: ValidateOptions = {},
  now: Date = new Date(),
): Promise<PublishResult> {
  const validation = await validateForStorefront(companyId, productId, db, opts);
  if (!validation.ok) {
    if (
      validation.issues.length === 1 &&
      validation.issues[0].code === 'product_inactive' &&
      !validation.meta.isActive &&
      validation.meta.activeVariantCount === 0
    ) {
      // İlk validateForStorefront ürün bulamadığında bu kombinasyonu döner.
      // (meta tamamen sıfır — gerçek "not_found" senaryosu).
      return { ok: false, reason: 'not_found' };
    }
    return {
      ok: false,
      reason: 'validation_failed',
      issues: validation.issues,
    };
  }

  // Idempotent: zaten yayında mı?
  const current = await db
    .select({ vitrinPublished: products.vitrinPublished })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.companyId, companyId)))
    .limit(1);
  if (current[0]?.vitrinPublished) {
    return { ok: true, alreadyPublished: true };
  }

  // 2026-05-22 Karar A revize — vitrin limit kontrolü (plan + süperadmin override).
  // Idempotent check'ten sonra: zaten yayında ürün tekrar count'a katılmaz.
  // Yayında olmayan ürünü açarken DB'deki aktif vitrin sayısı limit'i aşarsa reject.
  const companyRow = await db
    .select({
      plan: companies.plan,
      temporaryVitrinLimitOverride: companies.temporaryVitrinLimitOverride,
      temporaryVitrinLimitOverrideUntil: companies.temporaryVitrinLimitOverrideUntil,
      temporaryBranchLimitOverride: companies.temporaryBranchLimitOverride,
      temporaryBranchLimitOverrideUntil: companies.temporaryBranchLimitOverrideUntil,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (companyRow.length === 0) return { ok: false, reason: 'not_found' };

  const activeVitrinRow = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(products)
    .where(
      and(
        eq(products.companyId, companyId),
        eq(products.vitrinPublished, true),
        sql`${products.deletedAt} IS NULL`,
      ),
    );
  const activeVitrinCount = activeVitrinRow[0]?.count ?? 0;

  const limitCheck = canPublishToVitrin(companyRow[0], activeVitrinCount, now);
  if (!limitCheck.ok) {
    return {
      ok: false,
      reason: 'vitrin_limit_exceeded',
      limit: limitCheck.limit,
      count: limitCheck.count,
    };
  }

  try {
    await db
      .update(products)
      .set({
        vitrinPublished: true,
        vitrinPublishedAt: now,
        vitrinPublishedById: userId,
        vitrinAutoUnpublishedAt: null,
        vitrinAutoUnpublishedReason: null,
        updatedAt: now,
      })
      .where(and(eq(products.id, productId), eq(products.companyId, companyId)));
    return { ok: true, alreadyPublished: false };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

// ─────────────────────────────────────────────────────────────────
// UNPUBLISH
// ─────────────────────────────────────────────────────────────────

export type UnpublishResult =
  | { ok: true; alreadyUnpublished: boolean }
  | { ok: false; reason: 'not_found' | 'unknown' };

/**
 * Manuel "Satışa Kapat" — vitrinPublished=false + reason='manual'.
 * Idempotent: zaten kapalıysa no-op.
 */
export async function unpublishProduct(
  companyId: string,
  productId: string,
  db: DbClient,
  now: Date = new Date(),
): Promise<UnpublishResult> {
  const current = await db
    .select({
      id: products.id,
      vitrinPublished: products.vitrinPublished,
    })
    .from(products)
    .where(
      and(
        eq(products.id, productId),
        eq(products.companyId, companyId),
        sql`${products.deletedAt} IS NULL`,
      ),
    )
    .limit(1);
  if (current.length === 0) {
    return { ok: false, reason: 'not_found' };
  }
  if (!current[0].vitrinPublished) {
    return { ok: true, alreadyUnpublished: true };
  }

  try {
    await db
      .update(products)
      .set({
        vitrinPublished: false,
        vitrinAutoUnpublishedAt: now,
        vitrinAutoUnpublishedReason: 'manual',
        updatedAt: now,
      })
      .where(eq(products.id, productId));
    return { ok: true, alreadyUnpublished: false };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

/**
 * Stock-related auto-notification triggers — Sprint 15 ext
 *
 * Transition-based: sadece eşik geçildiğinde notif at, spam YOK.
 *   - out_of_stock: prevQty > 0 ∧ newQty == 0
 *   - low_stock_critical: prevQty > threshold ∧ newQty <= threshold ∧ newQty > 0
 *   - vitrin_auto_unpublished: lib içinde auto-unpublish trigger'lanır,
 *     ayrı action helper'ından çağrılır (her şubede toplam 0 + vitrin yayındaysa)
 *
 * Variant bilgisi (product name + variant label + threshold) DB'den çekilir.
 * branchThresholds varsa o şubeye ait özel threshold kullanılır, yoksa variant.threshold.
 */

import { and, eq, gte } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { productVariants, products, branches } from '@/db/schema';
import { createNotificationAsync } from './manage';

interface VariantInfoForNotif {
  productName: string;
  variantLabel: string;
  threshold: number;
  branchName: string | null;
}

async function lookupVariantInfo(
  companyId: string,
  branchId: string,
  variantId: string,
  db: DbClient,
): Promise<VariantInfoForNotif | null> {
  const rows = await db
    .select({
      productName: products.name,
      variantLabel: productVariants.valueLabel,
      threshold: productVariants.threshold,
      branchThresholds: productVariants.branchThresholds,
      branchName: branches.name,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(branches, eq(branches.id, branchId))
    .where(and(eq(productVariants.id, variantId), eq(productVariants.companyId, companyId)))
    .limit(1);

  const r = rows[0];
  if (!r) return null;

  const perBranchThreshold = r.branchThresholds?.[branchId];
  return {
    productName: r.productName,
    variantLabel: r.variantLabel,
    threshold: perBranchThreshold ?? r.threshold,
    branchName: r.branchName,
  };
}

/**
 * Bir stok hareketi sonrası eşik geçişini kontrol eder + uygunsa notif at.
 *
 * Fire-and-forget — caller awaitlemez (createNotificationAsync zaten async).
 */
export async function checkAndNotifyStockChange(params: {
  companyId: string;
  branchId: string;
  variantId: string;
  beforeQty: number;
  afterQty: number;
  movementCreatedAt?: Date;
  db: DbClient;
}): Promise<void> {
  const { companyId, branchId, variantId, beforeQty, afterQty, movementCreatedAt, db } = params;

  // Yön: sadece düşüş yönünde (stok azaldı). Stok artışında uyarı atılmaz.
  if (afterQty >= beforeQty) return;

  const info = await lookupVariantInfo(companyId, branchId, variantId, db);
  if (!info) return;

  const branchLabel = info.branchName ?? '—';
  const productLabel = `${info.productName} · ${info.variantLabel}`;

  // 0. Vitrin otomatik kapatıldı mı? movements.ts applyInventoryChange içinde
  //    stock_zero trigger çalıştıysa products.vitrinAutoUnpublishedAt set olmuş
  //    olur (movement zamanından sonra). Bu transition product-level ve sadece
  //    tüm şube toplamı 0 olunca tetiklenir. Aynı movement turundan tetiklenen
  //    auto-unpublish için notif at.
  if (afterQty === 0 && beforeQty > 0 && movementCreatedAt) {
    void checkVitrinAutoUnpublished(companyId, variantId, movementCreatedAt, db);
  }

  // 1. Out-of-stock: 0'a düştü (transition)
  if (afterQty === 0 && beforeQty > 0) {
    createNotificationAsync(
      {
        companyId,
        type: 'out_of_stock',
        content: {
          title: `🔴 Stok bitti: ${productLabel}`,
          body: `${branchLabel} şubesinde stok 0. Tedarikçi sipariş veya transfer gerek.`,
          link: '/admin/low-stock',
          emoji: '🔴',
        },
      },
      db,
    );
    return; // out_of_stock varken low_stock_critical fazlalık olur
  }

  // 2. Low-stock-critical: threshold'u aştı (transition)
  if (info.threshold > 0 && afterQty <= info.threshold && beforeQty > info.threshold) {
    createNotificationAsync(
      {
        companyId,
        type: 'low_stock_critical',
        content: {
          title: `⚠ Düşük stok: ${productLabel}`,
          body: `${branchLabel} şubesinde ${afterQty}/${info.threshold} kaldı (eşik altı).`,
          link: '/admin/low-stock',
          emoji: '⚠',
        },
      },
      db,
    );
  }
}

/**
 * movements.ts applyInventoryChange içinde stock-out + total=0 + vitrinPublished=true
 * koşulu sağlandığında products.vitrin_auto_unpublished_at güncellenir.
 * Bu helper o transition'ı tespit edip notif atar (movement'tan hemen sonra çağrılır).
 */
async function checkVitrinAutoUnpublished(
  companyId: string,
  variantId: string,
  movementCreatedAt: Date,
  db: DbClient,
): Promise<void> {
  // variant → product lookup + auto-unpublish field check
  const rows = await db
    .select({
      productId: products.id,
      productName: products.name,
      vitrinAutoUnpublishedAt: products.vitrinAutoUnpublishedAt,
      vitrinAutoUnpublishedReason: products.vitrinAutoUnpublishedReason,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(
        eq(productVariants.id, variantId),
        eq(productVariants.companyId, companyId),
        // Auto-unpublish movement zamanı civarında olmalı (≤ 5 sn gecikme)
        eq(products.vitrinAutoUnpublishedReason, 'stock_zero'),
        gte(products.vitrinAutoUnpublishedAt, new Date(movementCreatedAt.getTime() - 5_000)),
      ),
    )
    .limit(1);

  const r = rows[0];
  if (!r) return;

  createNotificationAsync(
    {
      companyId,
      type: 'vitrin_auto_unpublished',
      content: {
        title: `🔒 Vitrin'den çekildi: ${r.productName}`,
        body: 'Tüm şubelerde stok 0 — vitrin otomatik kapatıldı. Stok girişi yapıp tekrar "Satışa Aç" toggle ile yayına aç.',
        link: `/admin/products/${r.productId}`,
        emoji: '🔒',
      },
    },
    db,
  );
}

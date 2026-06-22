/**
 * Transfer önerileri — Pano widget'ı için flat liste.
 *
 * Düşük stoklu variantlar için kaynak/hedef şube önerisi + product/variant
 * isim join. Aynı variant birden fazla hedef şubeye öneri üretebilir.
 *
 * getTransferSuggestionsBulk'un düşük stok variant ID'leri üzerinden top N
 * öneri çıkaran wrapper'ı. Pano "🤖 Transfer Önerileri" widget'ı kullanır.
 */

import { and, asc, eq, sql } from 'drizzle-orm';
import type { TenantDb } from '@/lib/db/with-tenant';
import { branchInventory, productVariants, products, branches } from '@/db/schema';
import {
  getTransferSuggestionsBulk,
  type TransferSuggestion,
} from '@/lib/stock/transfer-suggestions';

export interface TransferSuggestionFlat extends TransferSuggestion {
  productId: string;
  productName: string;
  variantLabel: string | null;
  sku: string;
}

export async function listTopTransferSuggestions(
  companyId: string,
  db: TenantDb,
  limit: number = 5,
): Promise<TransferSuggestionFlat[]> {
  // Düşük stoklu variant ID'leri (her şubedeki düşüklükler) toplu olarak çek
  const lowRows = await db
    .selectDistinct({
      variantId: branchInventory.variantId,
      productId: products.id,
      productName: products.name,
      variantLabel: productVariants.valueLabel,
      sku: productVariants.sku,
    })
    .from(branchInventory)
    .innerJoin(productVariants, eq(productVariants.id, branchInventory.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(branches, eq(branches.id, branchInventory.branchId))
    .where(
      and(
        eq(branchInventory.companyId, companyId),
        eq(productVariants.isActive, true),
        eq(branches.isActive, true),
        sql`${products.deletedAt} IS NULL`,
        sql`${branchInventory.stockQty} <= COALESCE(
          (${productVariants.branchThresholds} ->> ${branchInventory.branchId}::text)::int,
          ${productVariants.threshold}
        )`,
      ),
    )
    .orderBy(asc(productVariants.sku));

  if (lowRows.length === 0) return [];

  const variantIds = lowRows.map((r) => r.variantId);
  const meta = new Map(
    lowRows.map((r) => [
      r.variantId,
      {
        productId: r.productId,
        productName: r.productName,
        variantLabel: r.variantLabel,
        sku: r.sku,
      },
    ]),
  );

  const suggestionsMap = await getTransferSuggestionsBulk(companyId, variantIds, db);

  const flat: TransferSuggestionFlat[] = [];
  for (const [variantId, suggestions] of suggestionsMap) {
    const m = meta.get(variantId);
    if (!m) continue;
    for (const s of suggestions) {
      flat.push({
        ...s,
        productId: m.productId,
        productName: m.productName,
        variantLabel: m.variantLabel,
        sku: m.sku,
      });
    }
  }

  // Hedef stok 0 olanları üste al (en kritik) + suggestedQty büyük olanlar
  flat.sort((a, b) => {
    if (a.targetStock !== b.targetStock) return a.targetStock - b.targetStock;
    return b.suggestedQty - a.suggestedQty;
  });

  return flat.slice(0, limit);
}

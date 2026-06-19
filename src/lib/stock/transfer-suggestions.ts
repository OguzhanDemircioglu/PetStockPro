/**
 * Transfer önerisi — Düşük stok / sıfır stok satırlarına başka şubeden öneri.
 *
 * Düşük stoklu variant + aynı variant'ın başka şubelerinde stok varsa, transfer öner.
 *   - source: stoğu en yüksek olan dolu şube (threshold üstünde)
 *   - target: düşük/sıfır stok şubesi
 *   - suggested qty: source / 2 round (yarısını öner, max=target threshold * 2)
 */

import { and, eq, sql } from 'drizzle-orm';
import type { TenantDb } from '@/lib/db/with-tenant';
import { branchInventory, productVariants, branches } from '@/db/schema';

export interface TransferSuggestion {
  variantId: string;
  sourceBranchId: string;
  sourceBranchName: string;
  sourceStock: number;
  targetBranchId: string;
  targetBranchName: string;
  targetStock: number;
  suggestedQty: number;
}

/**
 * Bir variant için: düşük stoklu şubelere transfer önerileri döner.
 * Aynı variant'ın başka şubede dolu (threshold üstü) satırı varsa,
 * en yüksek stoklu şubeden hedef şubeye öneri çıkar.
 */
export async function getTransferSuggestionsForVariant(
  companyId: string,
  variantId: string,
  db: TenantDb,
): Promise<TransferSuggestion[]> {
  const rows = await db
    .select({
      branchId: branchInventory.branchId,
      branchName: branches.name,
      stockQty: branchInventory.stockQty,
      threshold: productVariants.threshold,
      branchThresholds: productVariants.branchThresholds,
    })
    .from(branchInventory)
    .innerJoin(branches, eq(branches.id, branchInventory.branchId))
    .innerJoin(productVariants, eq(productVariants.id, branchInventory.variantId))
    .where(
      and(
        eq(branchInventory.companyId, companyId),
        eq(branchInventory.variantId, variantId),
        eq(branches.isActive, true),
      ),
    );

  const branchesWithThreshold = rows.map((r) => {
    const perBranch = r.branchThresholds?.[r.branchId];
    return {
      branchId: r.branchId,
      branchName: r.branchName,
      stockQty: r.stockQty,
      threshold: perBranch ?? r.threshold,
    };
  });

  // Düşük şubeler (threshold altı)
  const targets = branchesWithThreshold.filter((b) => b.stockQty <= b.threshold);
  // Dolu şubeler (threshold + 2× üstü — yedek bırak)
  const sources = branchesWithThreshold
    .filter((b) => b.stockQty > b.threshold * 2 || (b.threshold === 0 && b.stockQty >= 5))
    .sort((a, b) => b.stockQty - a.stockQty); // en dolu önce

  const suggestions: TransferSuggestion[] = [];
  for (const target of targets) {
    const source = sources.find((s) => s.branchId !== target.branchId);
    if (!source) continue;

    // Suggested qty: kaynakta bırakılması gereken minimum = source threshold + 5 yedek.
    // Transfer edilebilir max = source.stock - (source.threshold + 5).
    // Hedef için ideal = target.threshold * 2 (yedekli stok).
    const sourceReserve = source.threshold + 5;
    const transferable = Math.max(0, source.stockQty - sourceReserve);
    const targetIdeal = Math.max(target.threshold * 2 - target.stockQty, 1);
    const suggestedQty = Math.min(transferable, targetIdeal);
    if (suggestedQty <= 0) continue;

    suggestions.push({
      variantId,
      sourceBranchId: source.branchId,
      sourceBranchName: source.branchName,
      sourceStock: source.stockQty,
      targetBranchId: target.branchId,
      targetBranchName: target.branchName,
      targetStock: target.stockQty,
      suggestedQty,
    });
  }

  return suggestions;
}

/**
 * Toplu çağrı — variant ID array için tüm önerileri tek seferde döner.
 * Düşük stok sayfası için pratik.
 */
export async function getTransferSuggestionsBulk(
  companyId: string,
  variantIds: string[],
  db: TenantDb,
): Promise<Map<string, TransferSuggestion[]>> {
  if (variantIds.length === 0) return new Map();

  const rows = await db
    .select({
      variantId: branchInventory.variantId,
      branchId: branchInventory.branchId,
      branchName: branches.name,
      stockQty: branchInventory.stockQty,
      threshold: productVariants.threshold,
      branchThresholds: productVariants.branchThresholds,
    })
    .from(branchInventory)
    .innerJoin(branches, eq(branches.id, branchInventory.branchId))
    .innerJoin(productVariants, eq(productVariants.id, branchInventory.variantId))
    .where(
      and(
        eq(branchInventory.companyId, companyId),
        sql`${branchInventory.variantId} IN ${variantIds}`,
        eq(branches.isActive, true),
      ),
    );

  // variant_id → branch listesi
  const byVariant = new Map<
    string,
    { branchId: string; branchName: string; stockQty: number; threshold: number }[]
  >();
  for (const r of rows) {
    const perBranch = r.branchThresholds?.[r.branchId];
    const list = byVariant.get(r.variantId) ?? [];
    list.push({
      branchId: r.branchId,
      branchName: r.branchName,
      stockQty: r.stockQty,
      threshold: perBranch ?? r.threshold,
    });
    byVariant.set(r.variantId, list);
  }

  // Her variant için önerileri hesapla (inline, fonksiyon tekrarı yok)
  const result = new Map<string, TransferSuggestion[]>();
  for (const [variantId, list] of byVariant) {
    const targets = list.filter((b) => b.stockQty <= b.threshold);
    const sources = list
      .filter((b) => b.stockQty > b.threshold * 2 || (b.threshold === 0 && b.stockQty >= 5))
      .sort((a, b) => b.stockQty - a.stockQty);

    const suggestions: TransferSuggestion[] = [];
    for (const target of targets) {
      const source = sources.find((s) => s.branchId !== target.branchId);
      if (!source) continue;
      const sourceReserve = source.threshold + 5;
      const transferable = Math.max(0, source.stockQty - sourceReserve);
      const targetIdeal = Math.max(target.threshold * 2 - target.stockQty, 1);
      const suggestedQty = Math.min(transferable, targetIdeal);
      if (suggestedQty <= 0) continue;
      suggestions.push({
        variantId,
        sourceBranchId: source.branchId,
        sourceBranchName: source.branchName,
        sourceStock: source.stockQty,
        targetBranchId: target.branchId,
        targetBranchName: target.branchName,
        targetStock: target.stockQty,
        suggestedQty,
      });
    }
    if (suggestions.length > 0) result.set(variantId, suggestions);
  }

  return result;
}

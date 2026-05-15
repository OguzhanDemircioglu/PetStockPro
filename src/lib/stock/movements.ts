/**
 * Stock Movements — Sprint 4.0 core helpers
 *
 * recordStockIn — alış girişi (tedarikçiden).
 * recordStockOut — satış / fire / hediye / numune / iade / dahili.
 * recordTransfer — iki entry: kaynak şube çıkış + hedef şube giriş,
 *                  aynı transferGroupId ile bağlanır.
 *
 * İnvariantlar (DB trigger değil, helper transaction ile garanti):
 * - stock_movements append-only (helper update/delete export etmez).
 * - branch_inventory (branchId, variantId) unique — yoksa INSERT, varsa UPDATE.
 * - beforeQty + delta = afterQty (movement satırında).
 * - products.totalStockQty denormalize toplam — her movement'ta tazelenir.
 * - Stock-out sonrası variant stock_qty 0'a düşerse + product vitrinPublished
 *   ise → auto-unpublish + reason='stock_zero'.
 * - Sale + payment_method='credit' → customerRef zorunlu (veresiye kim adına).
 *
 * Pattern: catalog/products.ts ve catalog/variants.ts gibi pure helper +
 *          dependency injection (db client + now Date).
 */

import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { DbClient } from '@/lib/db/client';
import {
  stockMovements,
  branchInventory,
  productVariants,
  products,
  branches,
} from '@/db/schema';

// ─────────────────────────────────────────────────────────────────
// SHARED SCHEMAS
// ─────────────────────────────────────────────────────────────────

const priceSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Geçerli fiyat (örn 120.50)');

const quantitySchema = z
  .number()
  .int()
  .positive('Miktar pozitif olmalı')
  .max(1_000_000, 'Mantıksız büyük miktar');

const baseContextSchema = z.object({
  branchId: z.string().uuid('Geçerli şube seç'),
  variantId: z.string().uuid('Geçerli variant seç'),
  note: z.string().max(500).nullable().optional(),
});

// ─────────────────────────────────────────────────────────────────
// INTERNAL — variant ownership + current stockQty fetch
// ─────────────────────────────────────────────────────────────────

interface VariantStockInfo {
  variantId: string;
  productId: string;
  companyId: string;
  branchId: string;
  currentQty: number;
  inventoryRowId: string | null; // null → henüz hiç hareket yok
}

/**
 * Tek sorguda: variant tenant'a ait mi + bu şube tenant'a ait mi +
 * (branch, variant) için mevcut stockQty + branch_inventory row var mı?
 */
async function fetchVariantStockInfo(
  companyId: string,
  branchId: string,
  variantId: string,
  db: DbClient,
): Promise<VariantStockInfo | null> {
  const rows = await db
    .select({
      variantId: productVariants.id,
      productId: productVariants.productId,
      variantCompanyId: productVariants.companyId,
      branchCompanyId: branches.companyId,
      currentQty: sql<number | null>`(
        SELECT ${branchInventory.stockQty} FROM ${branchInventory}
        WHERE ${branchInventory.branchId} = ${branchId}
          AND ${branchInventory.variantId} = ${variantId}
        LIMIT 1
      )`,
      inventoryRowId: sql<string | null>`(
        SELECT ${branchInventory.id} FROM ${branchInventory}
        WHERE ${branchInventory.branchId} = ${branchId}
          AND ${branchInventory.variantId} = ${variantId}
        LIMIT 1
      )`,
    })
    .from(productVariants)
    .innerJoin(branches, eq(branches.id, branchId))
    .where(eq(productVariants.id, variantId))
    .limit(1);

  const r = rows[0];
  if (!r) return null;
  if (r.variantCompanyId !== companyId || r.branchCompanyId !== companyId) {
    return null;
  }
  return {
    variantId: r.variantId,
    productId: r.productId,
    companyId,
    branchId,
    currentQty: r.currentQty ?? 0,
    inventoryRowId: r.inventoryRowId,
  };
}

/**
 * Transaction içinde branch_inventory upsert + product.totalStockQty refresh.
 * Stock-out sonrası 0'a düşerse + tüm şubelerde 0 ise vitrin auto-unpublish.
 *
 * tx parametresi DbClient transaction proxy'si (Drizzle tx).
 */
async function applyInventoryChange(
  tx: DbClient,
  info: VariantStockInfo,
  delta: number,
  productId: string,
  now: Date,
  isOutgoing: boolean,
): Promise<void> {
  const newQty = info.currentQty + delta;
  // delta negative ise (stock-out), 0 altına düşmemeli
  if (newQty < 0) {
    throw new InsufficientStockError(info.currentQty, Math.abs(delta));
  }

  if (info.inventoryRowId) {
    // UPDATE existing row
    await tx
      .update(branchInventory)
      .set({
        stockQty: newQty,
        ...(isOutgoing
          ? {
              lastSoldAt: now,
              totalSoldQty: sql`${branchInventory.totalSoldQty} + ${Math.abs(delta)}`,
            }
          : { lastReceivedAt: now }),
        updatedAt: now,
      })
      .where(eq(branchInventory.id, info.inventoryRowId));
  } else {
    // INSERT new row (ilk giriş)
    await tx.insert(branchInventory).values({
      companyId: info.companyId,
      branchId: info.branchId,
      variantId: info.variantId,
      stockQty: newQty,
      lastReceivedAt: isOutgoing ? null : now,
      lastSoldAt: isOutgoing ? now : null,
      totalSoldQty: isOutgoing ? Math.abs(delta) : 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Product.totalStockQty refresh (denormalize tüm şubeler toplamı)
  await tx
    .update(products)
    .set({
      totalStockQty: sql`(
        SELECT COALESCE(SUM(${branchInventory.stockQty}), 0)::int
        FROM ${branchInventory}
        WHERE ${branchInventory.variantId} IN (
          SELECT ${productVariants.id} FROM ${productVariants}
          WHERE ${productVariants.productId} = ${productId}
        )
      )`,
      updatedAt: now,
    })
    .where(eq(products.id, productId));

  // Stock-out sonrası 0 + tüm şubelerde 0 + vitrin yayında → auto-unpublish
  if (isOutgoing) {
    await tx
      .update(products)
      .set({
        vitrinPublished: false,
        vitrinAutoUnpublishedAt: now,
        vitrinAutoUnpublishedReason: 'stock_zero',
        updatedAt: now,
      })
      .where(
        and(
          eq(products.id, productId),
          eq(products.vitrinPublished, true),
          sql`(
            SELECT COALESCE(SUM(${branchInventory.stockQty}), 0)
            FROM ${branchInventory}
            WHERE ${branchInventory.variantId} IN (
              SELECT ${productVariants.id} FROM ${productVariants}
              WHERE ${productVariants.productId} = ${productId}
            )
          ) = 0`,
        ),
      );
  }
}

export class InsufficientStockError extends Error {
  readonly code = 'insufficient_stock';
  constructor(public available: number, public requested: number) {
    super(`Yetersiz stok — mevcut ${available}, istenen ${requested}`);
    this.name = 'InsufficientStockError';
  }
}

// ─────────────────────────────────────────────────────────────────
// STOCK IN — alış girişi
// ─────────────────────────────────────────────────────────────────

export const stockInSchema = baseContextSchema.extend({
  quantity: quantitySchema,
  unitCost: priceSchema.optional(),
  supplierId: z.string().uuid().nullable().optional(),
  documentNo: z.string().max(100).nullable().optional(),
  lotNumber: z.string().max(100).nullable().optional(),
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-AA-GG formatı')
    .nullable()
    .optional(),
});

export type StockInInput = z.input<typeof stockInSchema>;

export type StockMovementResult =
  | { ok: true; movementId: string; afterQty: number }
  | {
      ok: false;
      reason:
        | 'invalid_input'
        | 'not_found'
        | 'insufficient_stock'
        | 'invalid_state'
        | 'unknown';
      issues?: string[];
      meta?: { available?: number; requested?: number };
    };

export async function recordStockIn(
  companyId: string,
  userId: string,
  input: StockInInput,
  db: DbClient,
  now: Date = new Date(),
): Promise<StockMovementResult> {
  const parsed = stockInSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const data = parsed.data;

  const info = await fetchVariantStockInfo(
    companyId,
    data.branchId,
    data.variantId,
    db,
  );
  if (!info) return { ok: false, reason: 'not_found' };

  const beforeQty = info.currentQty;
  const afterQty = beforeQty + data.quantity;

  try {
    const movementId = await db.transaction(async (tx) => {
      const [m] = await tx
        .insert(stockMovements)
        .values({
          companyId,
          branchId: data.branchId,
          variantId: data.variantId,
          type: 'stock_in',
          subtype: null,
          quantity: data.quantity,
          beforeQty,
          afterQty,
          unitCost: data.unitCost ?? null,
          unitPrice: null,
          supplierId: data.supplierId ?? null,
          documentNo: data.documentNo ?? null,
          lotNumber: data.lotNumber ?? null,
          expiryDate: data.expiryDate ?? null,
          note: data.note ?? null,
          createdById: userId,
          createdAt: now,
        })
        .returning({ id: stockMovements.id });

      await applyInventoryChange(
        tx as unknown as DbClient,
        info,
        data.quantity,
        info.productId,
        now,
        false,
      );

      return m.id;
    });

    return { ok: true, movementId, afterQty };
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return {
        ok: false,
        reason: 'insufficient_stock',
        meta: { available: err.available, requested: err.requested },
      };
    }
    return { ok: false, reason: 'unknown' };
  }
}

// ─────────────────────────────────────────────────────────────────
// STOCK OUT — satış/fire/hediye/numune/iade/dahili
// ─────────────────────────────────────────────────────────────────

export const stockOutSubtypes = [
  'sale',
  'waste',
  'gift',
  'sample',
  'return',
  'internal_use',
  'other',
] as const;
export type StockOutSubtype = (typeof stockOutSubtypes)[number];

export const stockOutSchema = baseContextSchema.extend({
  quantity: quantitySchema,
  subtype: z.enum(stockOutSubtypes),
  unitPrice: priceSchema.optional(),
  discountAmount: priceSchema.optional(),
  customerRef: z.string().max(100).nullable().optional(),
  paymentMethod: z
    .enum(['cash', 'card', 'bank_transfer', 'credit'])
    .nullable()
    .optional(),
  reason: z.string().max(500).nullable().optional(),
});

export type StockOutInput = z.input<typeof stockOutSchema>;

export async function recordStockOut(
  companyId: string,
  userId: string,
  input: StockOutInput,
  db: DbClient,
  now: Date = new Date(),
): Promise<StockMovementResult> {
  const parsed = stockOutSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const data = parsed.data;

  // Sale + credit → customerRef zorunlu (veresiye kim adına?)
  if (
    data.subtype === 'sale' &&
    data.paymentMethod === 'credit' &&
    (!data.customerRef || data.customerRef.trim().length === 0)
  ) {
    return {
      ok: false,
      reason: 'invalid_state',
      issues: ['Veresiye satışta müşteri adı/telefonu zorunlu'],
    };
  }

  const info = await fetchVariantStockInfo(
    companyId,
    data.branchId,
    data.variantId,
    db,
  );
  if (!info) return { ok: false, reason: 'not_found' };

  if (info.currentQty < data.quantity) {
    return {
      ok: false,
      reason: 'insufficient_stock',
      meta: { available: info.currentQty, requested: data.quantity },
    };
  }

  const beforeQty = info.currentQty;
  const afterQty = beforeQty - data.quantity;

  try {
    const movementId = await db.transaction(async (tx) => {
      const [m] = await tx
        .insert(stockMovements)
        .values({
          companyId,
          branchId: data.branchId,
          variantId: data.variantId,
          type: 'stock_out',
          subtype: data.subtype,
          quantity: -data.quantity, // çıkış negatif kayıt
          beforeQty,
          afterQty,
          unitCost: null,
          unitPrice: data.unitPrice ?? null,
          discountAmount: data.discountAmount ?? null,
          customerRef: data.customerRef ?? null,
          paymentMethod: data.paymentMethod ?? null,
          reason: data.reason ?? null,
          note: data.note ?? null,
          createdById: userId,
          createdAt: now,
        })
        .returning({ id: stockMovements.id });

      await applyInventoryChange(
        tx as unknown as DbClient,
        info,
        -data.quantity,
        info.productId,
        now,
        true,
      );

      return m.id;
    });

    return { ok: true, movementId, afterQty };
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return {
        ok: false,
        reason: 'insufficient_stock',
        meta: { available: err.available, requested: err.requested },
      };
    }
    return { ok: false, reason: 'unknown' };
  }
}

// ─────────────────────────────────────────────────────────────────
// REVERSAL — 24 saat içinde geri alma (R1)
// ─────────────────────────────────────────────────────────────────

export const REVERSAL_WINDOW_MS = 24 * 60 * 60 * 1000;

export type ReverseResult =
  | { ok: true; reversalMovementId: string; reversalPairId?: string }
  | {
      ok: false;
      reason:
        | 'not_found'
        | 'already_reversed'
        | 'is_reversal'
        | 'window_expired'
        | 'insufficient_stock'
        | 'transfer_pair_missing'
        | 'unknown';
      meta?: { available?: number; requested?: number };
    };

/**
 * Bir stok hareketini "geri alır":
 * - Orijinali immutable kalır; reversedById ile işaretlenir (audit izi).
 * - Yeni bir movement (type=orijinalle aynı veya 'stocktake' için 'stocktake'),
 *   ters yönde quantity ile insert edilir. reversesId orijinali işaret eder.
 * - branch_inventory eski haline döndürülür.
 *
 * Kurallar:
 * - 24 saat içinde herkes (R1). Sprint 7b süperadmin için süresiz override
 *   ayrı tool — burada `isSuperadmin` flag ile by-pass edilir.
 * - Zaten geri alınmış movement bir daha geri alınamaz.
 * - Reversal kaydının kendisi geri alınamaz ("is_reversal" reddi).
 * - Stock-in'in geri alınması = ters yönde çıkış: yeterli stok olmalı
 *   (insufficient_stock).
 * - Transfer reversal (Sprint 4.6): aynı transferGroupId iki entry pair
 *   olarak birlikte geri alınır. Hedef şubede yetersiz stok → reject.
 *   Tek movement reversed olarak görünmez — pair'in DİĞER entry'sini
 *   bulamazsa transfer_pair_missing döner.
 */
export async function reverseStockMovement(
  companyId: string,
  movementId: string,
  userId: string,
  db: DbClient,
  opts: { isSuperadmin?: boolean; reason?: string | null } = {},
  now: Date = new Date(),
): Promise<ReverseResult> {
  // Orijinal movement'ı çek + tenant ownership
  const rows = await db
    .select({
      id: stockMovements.id,
      type: stockMovements.type,
      subtype: stockMovements.subtype,
      branchId: stockMovements.branchId,
      variantId: stockMovements.variantId,
      quantity: stockMovements.quantity,
      beforeQty: stockMovements.beforeQty,
      afterQty: stockMovements.afterQty,
      createdAt: stockMovements.createdAt,
      reversedById: stockMovements.reversedById,
      reversesId: stockMovements.reversesId,
      transferGroupId: stockMovements.transferGroupId,
    })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.id, movementId),
        eq(stockMovements.companyId, companyId),
      ),
    )
    .limit(1);
  const original = rows[0];
  if (!original) return { ok: false, reason: 'not_found' };
  if (original.reversedById) return { ok: false, reason: 'already_reversed' };
  if (original.reversesId) return { ok: false, reason: 'is_reversal' };

  // Transfer → pair handling (Sprint 4.6)
  if (original.type === 'transfer') {
    return reverseTransferPair(
      companyId,
      original,
      userId,
      db,
      opts,
      now,
    );
  }

  // 24h pencere kontrolü — süperadmin bypass
  if (!opts.isSuperadmin) {
    const ageMs = now.getTime() - new Date(original.createdAt).getTime();
    if (ageMs > REVERSAL_WINDOW_MS) {
      return { ok: false, reason: 'window_expired' };
    }
  }

  const info = await fetchVariantStockInfo(
    companyId,
    original.branchId,
    original.variantId,
    db,
  );
  if (!info) return { ok: false, reason: 'not_found' };

  // Ters yön = -orijinal.quantity
  const reverseDelta = -original.quantity;
  if (info.currentQty + reverseDelta < 0) {
    return {
      ok: false,
      reason: 'insufficient_stock',
      meta: {
        available: info.currentQty,
        requested: Math.abs(reverseDelta),
      },
    };
  }

  const newBefore = info.currentQty;
  const newAfter = info.currentQty + reverseDelta;
  const isOutgoing = reverseDelta < 0;

  try {
    const reversalMovementId = await db.transaction(async (tx) => {
      const [m] = await tx
        .insert(stockMovements)
        .values({
          companyId,
          branchId: original.branchId,
          variantId: original.variantId,
          type: original.type, // aynı tür — audit netliği için
          subtype: original.subtype,
          quantity: reverseDelta,
          beforeQty: newBefore,
          afterQty: newAfter,
          reversesId: original.id,
          reason: opts.reason ?? 'Geri alma',
          createdById: userId,
          performedAsSuperadmin: !!opts.isSuperadmin,
          createdAt: now,
        })
        .returning({ id: stockMovements.id });

      // Orijinali işaretle (immutable mantığı korunur — sadece reversedById set)
      await tx
        .update(stockMovements)
        .set({ reversedById: m.id })
        .where(eq(stockMovements.id, original.id));

      await applyInventoryChange(
        tx as unknown as DbClient,
        info,
        reverseDelta,
        info.productId,
        now,
        isOutgoing,
      );

      return m.id;
    });

    return { ok: true, reversalMovementId };
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return {
        ok: false,
        reason: 'insufficient_stock',
        meta: { available: err.available, requested: err.requested },
      };
    }
    return { ok: false, reason: 'unknown' };
  }
}

/**
 * Transfer pair'inin iki entry'sini birlikte geri alır.
 *
 * Transfer iki immutable entry üretir: kaynak çıkış (-N) + hedef giriş (+N),
 * aynı transferGroupId. Geri alma her iki entry'ye reversedById set eder ve
 * iki ters movement insert eder:
 *   - kaynak şubeye +N (giriş yönü)
 *   - hedef şubeden -N (çıkış yönü)
 *
 * Hedef şubede şu an N adet stok yoksa (zaten satıldı/transfer edildi)
 * insufficient_stock döner — kullanıcı önce hedef hareketleri geri almalı.
 */
async function reverseTransferPair(
  companyId: string,
  original: {
    id: string;
    branchId: string;
    variantId: string;
    quantity: number;
    createdAt: Date;
    transferGroupId: string | null;
  },
  userId: string,
  db: DbClient,
  opts: { isSuperadmin?: boolean; reason?: string | null },
  now: Date,
): Promise<ReverseResult> {
  if (!original.transferGroupId) {
    return { ok: false, reason: 'transfer_pair_missing' };
  }

  // 24h pencere
  if (!opts.isSuperadmin) {
    const ageMs = now.getTime() - new Date(original.createdAt).getTime();
    if (ageMs > REVERSAL_WINDOW_MS) {
      return { ok: false, reason: 'window_expired' };
    }
  }

  // Pair'i bul — aynı transferGroupId + reversesId NULL + id != original.id
  const pairRows = await db
    .select({
      id: stockMovements.id,
      branchId: stockMovements.branchId,
      variantId: stockMovements.variantId,
      quantity: stockMovements.quantity,
      reversedById: stockMovements.reversedById,
      reversesId: stockMovements.reversesId,
    })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.companyId, companyId),
        eq(stockMovements.transferGroupId, original.transferGroupId),
        sql`${stockMovements.id} != ${original.id}`,
        sql`${stockMovements.reversesId} IS NULL`,
      ),
    )
    .limit(1);
  const pair = pairRows[0];
  if (!pair) {
    return { ok: false, reason: 'transfer_pair_missing' };
  }
  if (pair.reversedById) {
    return { ok: false, reason: 'already_reversed' };
  }

  // Her iki entry için fetchVariantStockInfo (kaynak + hedef şube)
  const originalInfo = await fetchVariantStockInfo(
    companyId,
    original.branchId,
    original.variantId,
    db,
  );
  const pairInfo = await fetchVariantStockInfo(
    companyId,
    pair.branchId,
    pair.variantId,
    db,
  );
  if (!originalInfo || !pairInfo) {
    return { ok: false, reason: 'not_found' };
  }

  const originalReverseDelta = -original.quantity;
  const pairReverseDelta = -pair.quantity;

  // Çıkış yönü olan tarafta (negative delta) stok yetmiyorsa reject
  const originalIsOutgoing = originalReverseDelta < 0;
  const pairIsOutgoing = pairReverseDelta < 0;

  if (originalIsOutgoing && originalInfo.currentQty + originalReverseDelta < 0) {
    return {
      ok: false,
      reason: 'insufficient_stock',
      meta: {
        available: originalInfo.currentQty,
        requested: Math.abs(originalReverseDelta),
      },
    };
  }
  if (pairIsOutgoing && pairInfo.currentQty + pairReverseDelta < 0) {
    return {
      ok: false,
      reason: 'insufficient_stock',
      meta: {
        available: pairInfo.currentQty,
        requested: Math.abs(pairReverseDelta),
      },
    };
  }

  try {
    const result = await db.transaction(async (tx) => {
      // Yeni reversal pair için yeni transferGroupId
      const reversalTransferGroupId = crypto.randomUUID();

      const [origRev] = await tx
        .insert(stockMovements)
        .values({
          companyId,
          branchId: original.branchId,
          variantId: original.variantId,
          type: 'transfer',
          subtype: null,
          quantity: originalReverseDelta,
          beforeQty: originalInfo.currentQty,
          afterQty: originalInfo.currentQty + originalReverseDelta,
          transferGroupId: reversalTransferGroupId,
          transferTargetBranchId: pair.branchId,
          reversesId: original.id,
          reason: opts.reason ?? 'Transfer geri alma',
          createdById: userId,
          performedAsSuperadmin: !!opts.isSuperadmin,
          createdAt: now,
        })
        .returning({ id: stockMovements.id });

      const [pairRev] = await tx
        .insert(stockMovements)
        .values({
          companyId,
          branchId: pair.branchId,
          variantId: pair.variantId,
          type: 'transfer',
          subtype: null,
          quantity: pairReverseDelta,
          beforeQty: pairInfo.currentQty,
          afterQty: pairInfo.currentQty + pairReverseDelta,
          transferGroupId: reversalTransferGroupId,
          transferTargetBranchId: original.branchId,
          reversesId: pair.id,
          reason: opts.reason ?? 'Transfer geri alma',
          createdById: userId,
          performedAsSuperadmin: !!opts.isSuperadmin,
          createdAt: now,
        })
        .returning({ id: stockMovements.id });

      // Orijinalleri işaretle
      await tx
        .update(stockMovements)
        .set({ reversedById: origRev.id })
        .where(eq(stockMovements.id, original.id));
      await tx
        .update(stockMovements)
        .set({ reversedById: pairRev.id })
        .where(eq(stockMovements.id, pair.id));

      // Branch inventory iki şubede güncelle
      await applyInventoryChange(
        tx as unknown as DbClient,
        originalInfo,
        originalReverseDelta,
        originalInfo.productId,
        now,
        originalIsOutgoing,
      );
      await applyInventoryChange(
        tx as unknown as DbClient,
        pairInfo,
        pairReverseDelta,
        pairInfo.productId,
        now,
        pairIsOutgoing,
      );

      return { reversalMovementId: origRev.id, reversalPairId: pairRev.id };
    });

    return { ok: true, ...result };
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return {
        ok: false,
        reason: 'insufficient_stock',
        meta: { available: err.available, requested: err.requested },
      };
    }
    return { ok: false, reason: 'unknown' };
  }
}

// ─────────────────────────────────────────────────────────────────
// STOCKTAKE — sayım sonucu düzeltme
// ─────────────────────────────────────────────────────────────────

export const stocktakeAdjustmentSchema = baseContextSchema.extend({
  countedQty: z.number().int().min(0).max(1_000_000),
  reason: z.string().max(500).nullable().optional(),
});

export type StocktakeAdjustmentInput = z.input<typeof stocktakeAdjustmentSchema>;

export type StocktakeResult =
  | { ok: true; movementId: string; delta: number; afterQty: number }
  | {
      ok: false;
      reason: 'invalid_input' | 'not_found' | 'no_change' | 'unknown';
      issues?: string[];
    };

/**
 * Sayım sırasında bulunan miktar ile sistemdeki miktar arasındaki farkı
 * stock_movements'a 'stocktake' türünde kayıt yazar. delta = counted - current.
 *
 * - delta=0 → no_change (kayıt yapılmaz, çağıran biliyor olmalı).
 * - delta+ → giriş yönlü düzeltme (eksik sayım hatası).
 * - delta- → çıkış yönlü düzeltme (fazla sayım hatası); branch_inventory
 *   stockQty=countedQty olarak doğrudan set edilir, eksiye düşmez (countedQty
 *   negatif olamaz Zod gate ile).
 *
 * vitrin auto-unpublish stock-out yönüne benzer: countedQty=0 + vitrinPublished
 * → auto-unpublish trigger'lanır.
 */
export async function recordStocktakeAdjustment(
  companyId: string,
  userId: string,
  input: StocktakeAdjustmentInput,
  db: DbClient,
  now: Date = new Date(),
): Promise<StocktakeResult> {
  const parsed = stocktakeAdjustmentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const data = parsed.data;

  const info = await fetchVariantStockInfo(
    companyId,
    data.branchId,
    data.variantId,
    db,
  );
  if (!info) return { ok: false, reason: 'not_found' };

  const beforeQty = info.currentQty;
  const delta = data.countedQty - beforeQty;
  if (delta === 0) {
    return { ok: false, reason: 'no_change' };
  }

  const isOutgoing = delta < 0;
  const afterQty = data.countedQty;

  try {
    const movementId = await db.transaction(async (tx) => {
      const [m] = await tx
        .insert(stockMovements)
        .values({
          companyId,
          branchId: data.branchId,
          variantId: data.variantId,
          type: 'stocktake',
          subtype: null,
          quantity: delta,
          beforeQty,
          afterQty,
          reason: data.reason ?? null,
          note: data.note ?? null,
          createdById: userId,
          createdAt: now,
        })
        .returning({ id: stockMovements.id });

      await applyInventoryChange(
        tx as unknown as DbClient,
        info,
        delta,
        info.productId,
        now,
        isOutgoing,
      );
      return m.id;
    });

    return { ok: true, movementId, delta, afterQty };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

// ─────────────────────────────────────────────────────────────────
// TRANSFER — iki entry, aynı transferGroupId
// ─────────────────────────────────────────────────────────────────

export const transferSchema = z.object({
  sourceBranchId: z.string().uuid('Kaynak şube seç'),
  targetBranchId: z.string().uuid('Hedef şube seç'),
  variantId: z.string().uuid('Variant seç'),
  quantity: quantitySchema,
  note: z.string().max(500).nullable().optional(),
}).refine((d) => d.sourceBranchId !== d.targetBranchId, {
  message: 'Kaynak ve hedef şube farklı olmalı',
  path: ['targetBranchId'],
});

export type TransferInput = z.input<typeof transferSchema>;

export type TransferResult =
  | { ok: true; transferGroupId: string; sourceAfterQty: number; targetAfterQty: number }
  | {
      ok: false;
      reason:
        | 'invalid_input'
        | 'not_found'
        | 'insufficient_stock'
        | 'unknown';
      issues?: string[];
      meta?: { available?: number; requested?: number };
    };

export async function recordTransfer(
  companyId: string,
  userId: string,
  input: TransferInput,
  db: DbClient,
  now: Date = new Date(),
): Promise<TransferResult> {
  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const data = parsed.data;

  const sourceInfo = await fetchVariantStockInfo(
    companyId,
    data.sourceBranchId,
    data.variantId,
    db,
  );
  if (!sourceInfo) return { ok: false, reason: 'not_found' };

  if (sourceInfo.currentQty < data.quantity) {
    return {
      ok: false,
      reason: 'insufficient_stock',
      meta: { available: sourceInfo.currentQty, requested: data.quantity },
    };
  }

  const targetInfo = await fetchVariantStockInfo(
    companyId,
    data.targetBranchId,
    data.variantId,
    db,
  );
  if (!targetInfo) return { ok: false, reason: 'not_found' };

  const transferGroupId = crypto.randomUUID();
  const sourceBeforeQty = sourceInfo.currentQty;
  const sourceAfterQty = sourceBeforeQty - data.quantity;
  const targetBeforeQty = targetInfo.currentQty;
  const targetAfterQty = targetBeforeQty + data.quantity;

  try {
    await db.transaction(async (tx) => {
      // Kaynak çıkış kaydı
      await tx.insert(stockMovements).values({
        companyId,
        branchId: data.sourceBranchId,
        variantId: data.variantId,
        type: 'transfer',
        subtype: null,
        quantity: -data.quantity,
        beforeQty: sourceBeforeQty,
        afterQty: sourceAfterQty,
        transferGroupId,
        transferTargetBranchId: data.targetBranchId,
        note: data.note ?? null,
        createdById: userId,
        createdAt: now,
      });

      // Hedef giriş kaydı
      await tx.insert(stockMovements).values({
        companyId,
        branchId: data.targetBranchId,
        variantId: data.variantId,
        type: 'transfer',
        subtype: null,
        quantity: data.quantity,
        beforeQty: targetBeforeQty,
        afterQty: targetAfterQty,
        transferGroupId,
        transferTargetBranchId: data.sourceBranchId, // reference geri yön
        note: data.note ?? null,
        createdById: userId,
        createdAt: now,
      });

      // Branch_inventory'leri güncelle — kaynak isOutgoing=true, hedef false
      await applyInventoryChange(
        tx as unknown as DbClient,
        sourceInfo,
        -data.quantity,
        sourceInfo.productId,
        now,
        true,
      );
      await applyInventoryChange(
        tx as unknown as DbClient,
        targetInfo,
        data.quantity,
        targetInfo.productId,
        now,
        false,
      );
    });

    return {
      ok: true,
      transferGroupId,
      sourceAfterQty,
      targetAfterQty,
    };
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return {
        ok: false,
        reason: 'insufficient_stock',
        meta: { available: err.available, requested: err.requested },
      };
    }
    return { ok: false, reason: 'unknown' };
  }
}

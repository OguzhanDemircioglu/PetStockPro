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
import { getProductLimitContext } from '@/lib/catalog/product-limit';
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
  allowNegative: boolean = false,
): Promise<void> {
  const newQty = info.currentQty + delta;
  // delta negative ise (stock-out), 0 altına düşmemeli — süperadmin bypass dışında
  if (newQty < 0 && !allowNegative) {
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

/**
 * Transaction içinde branch_inventory satırını `FOR UPDATE` ile kilitler ve
 * **güncel** stockQty değerini döner. Concurrent satış race condition'ı
 * önlemek için (SPRINT-PLAN §7.4 — paralel iki satış aynı stok üzerinden
 * geçemez).
 *
 * - Mevcut row varsa: SELECT ... FOR UPDATE → kilitli okuma, paralel
 *   transaction'lar burada serializasyon noktası bekler.
 * - Row yoksa (henüz hiç hareket yok): NULL döner, INSERT path
 *   (branch_id, variant_id) unique constraint ile paralel iki INSERT'i
 *   ikincisinin fail etmesiyle koruma altında.
 */
async function refreshAndLockInfo(
  tx: DbClient,
  info: VariantStockInfo,
): Promise<VariantStockInfo> {
  if (info.inventoryRowId) {
    const locked = await tx
      .select({
        id: branchInventory.id,
        stockQty: branchInventory.stockQty,
      })
      .from(branchInventory)
      .where(eq(branchInventory.id, info.inventoryRowId))
      .for('update');
    if (locked.length > 0) {
      return {
        ...info,
        currentQty: locked[0].stockQty,
        inventoryRowId: locked[0].id,
      };
    }
    // Row arada silinmiş (nadir) — INSERT path'a düş
    return { ...info, inventoryRowId: null, currentQty: 0 };
  }
  return info;
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
  | { ok: true; movementId: string; afterQty: number; beforeQty?: number }
  | {
      ok: false;
      reason:
        | 'invalid_input'
        | 'not_found'
        | 'insufficient_stock'
        | 'invalid_state'
        | 'product_limit_exceeded'
        | 'unknown';
      issues?: string[];
      meta?: { available?: number; requested?: number };
      /** product_limit_exceeded için: kaç ürünü var / plan limiti / plan. */
      planContext?: { currentCount: number; limit: number; plan: string };
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

  // Plan limit guard: tenant ürün limitini AŞMIŞSA (örn. PRO+ → PRO downgrade sonrası
  // 700 ürün / limit 500) stok girişi BLOKE. Kullanıcı limite (500) düşürene (ürün sil)
  // veya plan yükseltene kadar yeni stok ekleyemez. Satış/çıkış serbest (stoğu eritebilsin).
  const planCtx = await getProductLimitContext(db, companyId);
  if (planCtx.exceeded) {
    return {
      ok: false,
      reason: 'product_limit_exceeded',
      planContext: { currentCount: planCtx.currentCount, limit: planCtx.limit, plan: planCtx.plan },
    };
  }

  const info = await fetchVariantStockInfo(
    companyId,
    data.branchId,
    data.variantId,
    db,
  );
  if (!info) return { ok: false, reason: 'not_found' };

  let beforeQty = info.currentQty;
  let afterQty = beforeQty + data.quantity;

  try {
    const movementId = await db.transaction(async (tx) => {
      // Concurrent race koruması — FOR UPDATE ile satırı kilitle, güncel
      // stockQty'yi yeniden oku (SPRINT-PLAN §7.4).
      const lockedInfo = await refreshAndLockInfo(tx as unknown as DbClient, info);
      beforeQty = lockedInfo.currentQty;
      afterQty = beforeQty + data.quantity;

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
        lockedInfo,
        data.quantity,
        lockedInfo.productId,
        now,
        false,
      );

      // Stock-in özel: branch_inventory.expiryDate / lotNumber, son partinin
      // bilgisi (yakın SKT izleme için PetPro Asistanı kullanır). Mevcut
      // değer üzerinden yazılır; null/empty gelirse dokunulmaz.
      if (data.expiryDate || data.lotNumber) {
        await tx
          .update(branchInventory)
          .set({
            ...(data.expiryDate ? { expiryDate: data.expiryDate } : {}),
            ...(data.lotNumber ? { lotNumber: data.lotNumber } : {}),
            updatedAt: now,
          })
          .where(
            and(
              eq(branchInventory.branchId, lockedInfo.branchId),
              eq(branchInventory.variantId, lockedInfo.variantId),
            ),
          );
      }

      return m.id;
    });

    return { ok: true, movementId, afterQty, beforeQty };
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

  // Tx dışı early reject — UI'a hızlı feedback, ama race koruması tx içi
  // FOR UPDATE + applyInventoryChange'in throw'u garantili (allowNegative=false).
  if (info.currentQty < data.quantity) {
    return {
      ok: false,
      reason: 'insufficient_stock',
      meta: { available: info.currentQty, requested: data.quantity },
    };
  }

  let beforeQty = info.currentQty;
  let afterQty = beforeQty - data.quantity;

  try {
    const movementId = await db.transaction(async (tx) => {
      // Concurrent satış race koruması — paralel iki satış aynı stockQty'yi
      // okuyamasın (SPRINT-PLAN §7.4). FOR UPDATE ile satırı kilitle.
      const lockedInfo = await refreshAndLockInfo(tx as unknown as DbClient, info);
      if (lockedInfo.currentQty < data.quantity) {
        throw new InsufficientStockError(lockedInfo.currentQty, data.quantity);
      }
      beforeQty = lockedInfo.currentQty;
      afterQty = beforeQty - data.quantity;

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
        lockedInfo,
        -data.quantity,
        lockedInfo.productId,
        now,
        true,
      );

      return m.id;
    });

    return { ok: true, movementId, afterQty, beforeQty };
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
  // Süperadmin negatife sokmaya izinli (rollback senaryoları için)
  if (info.currentQty + reverseDelta < 0 && !opts.isSuperadmin) {
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
        !!opts.isSuperadmin,
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
  | { ok: true; movementId: string; delta: number; afterQty: number; beforeQty: number }
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

  // Tx dışı early no_change kontrolü — UI feedback için. Asıl no_change
  // garantisi tx içi FOR UPDATE'lı re-hesapla.
  if (data.countedQty - info.currentQty === 0) {
    return { ok: false, reason: 'no_change' };
  }

  let beforeQty = info.currentQty;
  let delta = data.countedQty - beforeQty;
  let afterQty = data.countedQty;
  const earlyIsOutgoing = delta < 0;

  try {
    const result = await db.transaction(async (tx) => {
      // Sayım da concurrent satışla yarışabilir: aynı variant'ta paralel
      // satış olursa countedQty - currentQty yanıltıcı olur. FOR UPDATE
      // ile satırı kilitle, ardından delta'yı yeniden hesapla.
      const lockedInfo = await refreshAndLockInfo(tx as unknown as DbClient, info);
      beforeQty = lockedInfo.currentQty;
      delta = data.countedQty - beforeQty;
      afterQty = data.countedQty;
      const isOutgoing = delta < 0;

      if (delta === 0) {
        // Sayım sırasında başka biri tam istenilen miktarı satıvermiş —
        // düzeltme yapılmaz, tx rollback, no_change işareti döner.
        throw new NoStocktakeChangeError();
      }

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
        lockedInfo,
        delta,
        lockedInfo.productId,
        now,
        isOutgoing,
      );
      return { id: m.id, delta, afterQty, beforeQty };
    });

    return {
      ok: true,
      movementId: result.id,
      delta: result.delta,
      afterQty: result.afterQty,
      beforeQty: result.beforeQty,
    };
  } catch (err) {
    if (err instanceof NoStocktakeChangeError) {
      return { ok: false, reason: 'no_change' };
    }
    void earlyIsOutgoing; // suppress unused (tx içi isOutgoing kullanılıyor)
    return { ok: false, reason: 'unknown' };
  }
}

class NoStocktakeChangeError extends Error {
  readonly code = 'no_change';
  constructor() {
    super('Sayım sistemdeki miktarla aynı — düzeltme yok');
    this.name = 'NoStocktakeChangeError';
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
  let sourceBeforeQty = sourceInfo.currentQty;
  let sourceAfterQty = sourceBeforeQty - data.quantity;
  let targetBeforeQty = targetInfo.currentQty;
  let targetAfterQty = targetBeforeQty + data.quantity;

  try {
    await db.transaction(async (tx) => {
      // Concurrent satış/transfer race koruması — iki şubenin de inventory
      // satırlarını FOR UPDATE ile kilitle, güncel stockQty üzerinden hesapla
      // (SPRINT-PLAN §7.4). Lock sırası: önce kaynak (daha sıkı kontrol),
      // sonra hedef.
      const lockedSource = await refreshAndLockInfo(tx as unknown as DbClient, sourceInfo);
      if (lockedSource.currentQty < data.quantity) {
        throw new InsufficientStockError(lockedSource.currentQty, data.quantity);
      }
      const lockedTarget = await refreshAndLockInfo(tx as unknown as DbClient, targetInfo);

      sourceBeforeQty = lockedSource.currentQty;
      sourceAfterQty = sourceBeforeQty - data.quantity;
      targetBeforeQty = lockedTarget.currentQty;
      targetAfterQty = targetBeforeQty + data.quantity;

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
        lockedSource,
        -data.quantity,
        lockedSource.productId,
        now,
        true,
      );
      await applyInventoryChange(
        tx as unknown as DbClient,
        lockedTarget,
        data.quantity,
        lockedTarget.productId,
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

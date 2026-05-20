/**
 * Excel import execution — server-side DB insert.
 *
 * Validation client'ta yapıldı, burada defense-in-depth ile re-validate.
 * Tek transaction içinde:
 *  1. Brand auto-create (Excel'de yeni marka varsa)
 *  2. Category lookup
 *  3. Product insert (vitrinPublished=false zorunlu)
 *  4. Default variant insert
 *  5. İnitial stock_in (initialStock > 0 ise — ilk aktif şubeye)
 *
 * Hata varsa transaction rollback. Audit log fire-and-forget.
 */

import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { DbClient } from '@/lib/db/client';
import {
  products,
  productVariants,
  branchInventory,
  stockMovements,
  brands,
  categories,
  branches,
} from '@/db/schema';
import { makeSlug } from '@/lib/utils/slug';
import { writeAuditLogAsync } from '@/lib/audit/log';

// Client-side ile aynı shape — server'da re-validate için Zod
export const importRowSchema = z.object({
  name: z.string().min(2).max(200),
  sku: z.string().regex(/^[A-Za-z0-9-]{3,30}$/),
  categoryName: z.string().nullable(),
  brandName: z.string().nullable(),
  variantLabel: z.string().min(1).max(100),
  costPrice: z.number().min(0).max(50000).nullable(),
  salePrice: z.number().min(1).max(50000),
  threshold: z.number().int().min(0).max(9999),
  barcode: z.string().regex(/^\d{13}$/).nullable(),
  expiryDate: z.union([z.string().datetime(), z.string(), z.null()]),
  initialStock: z.number().int().min(0).max(100000),
});

export type ImportRowInput = z.infer<typeof importRowSchema>;

export interface ImportExecResult {
  ok: boolean;
  inserted: number;
  errors: Array<{ row: number; message: string }>;
}

export async function executeImport(opts: {
  companyId: string;
  userId: string;
  rows: ImportRowInput[];
  db: DbClient;
}): Promise<ImportExecResult> {
  const { companyId, userId, rows, db } = opts;

  if (rows.length === 0) {
    return { ok: false, inserted: 0, errors: [{ row: 0, message: 'Yüklenecek satır yok' }] };
  }
  if (rows.length > 1000) {
    return { ok: false, inserted: 0, errors: [{ row: 0, message: 'Tek seferde 1000 satırdan fazla yüklenemez' }] };
  }

  // Zod re-validate (defense)
  const parsed: ImportRowInput[] = [];
  const errors: ImportExecResult['errors'] = [];
  rows.forEach((r, i) => {
    const v = importRowSchema.safeParse(r);
    if (!v.success) {
      errors.push({ row: i + 1, message: v.error.issues.map((x) => x.message).join('; ') });
    } else {
      parsed.push(v.data);
    }
  });
  if (errors.length > 0) {
    return { ok: false, inserted: 0, errors };
  }

  // İlk aktif şube — initial stock için
  const [defaultBranch] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.companyId, companyId), eq(branches.isActive, true)))
    .limit(1);

  const needsBranch = parsed.some((r) => r.initialStock > 0);
  if (needsBranch && !defaultBranch) {
    return {
      ok: false,
      inserted: 0,
      errors: [
        { row: 0, message: 'Aktif şube yok — initial stok yazılamaz. Önce bir şube ekle veya İlk Stok sütununu boşalt.' },
      ],
    };
  }

  // Brand cache (case-insensitive)
  const existingBrands = await db
    .select({ id: brands.id, name: brands.name })
    .from(brands)
    .where(eq(brands.companyId, companyId));
  const brandByLower = new Map<string, string>();
  for (const b of existingBrands) {
    brandByLower.set(b.name.toLocaleLowerCase('tr-TR'), b.id);
  }

  // Category cache
  const existingCats = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.companyId, companyId));
  const catByLower = new Map<string, string>();
  for (const c of existingCats) {
    catByLower.set(c.name.toLocaleLowerCase('tr-TR'), c.id);
  }

  let inserted = 0;
  const execErrors: ImportExecResult['errors'] = [];

  try {
    await db.transaction(async (tx) => {
      for (let i = 0; i < parsed.length; i++) {
        const row = parsed[i];
        try {
          // Brand lookup / auto-create
          let brandId: string | null = null;
          if (row.brandName) {
            const lower = row.brandName.toLocaleLowerCase('tr-TR');
            const existing = brandByLower.get(lower);
            if (existing) {
              brandId = existing;
            } else {
              const slug = makeSlug(row.brandName);
              const [newBrand] = await tx
                .insert(brands)
                .values({ companyId, name: row.brandName, slug })
                .returning({ id: brands.id });
              brandId = newBrand.id;
              brandByLower.set(lower, brandId);
            }
          }

          // Category lookup
          let categoryId: string | null = null;
          if (row.categoryName) {
            categoryId = catByLower.get(row.categoryName.toLocaleLowerCase('tr-TR')) ?? null;
          }

          // Product insert (vitrinPublished=false zorunlu)
          const slug = makeSlug(row.name);
          const [newProduct] = await tx
            .insert(products)
            .values({
              companyId,
              name: row.name,
              slug,
              categoryId,
              brandId,
              isActive: true,
              vitrinPublished: false, // Excel import'tan gelenler asla otomatik açılmaz
            })
            .returning({ id: products.id });

          // Default variant
          const [newVariant] = await tx
            .insert(productVariants)
            .values({
              companyId,
              productId: newProduct.id,
              sku: row.sku,
              barcode: row.barcode,
              valueLabel: row.variantLabel,
              costPrice: row.costPrice !== null ? row.costPrice.toFixed(2) : '0',
              salePrice: row.salePrice.toFixed(2),
              threshold: row.threshold,
              isDefault: true,
              isActive: true,
              displayOrder: 1,
            })
            .returning({ id: productVariants.id });

          // İnitial stock (varsa)
          if (row.initialStock > 0 && defaultBranch) {
            await tx.insert(branchInventory).values({
              companyId,
              branchId: defaultBranch.id,
              variantId: newVariant.id,
              stockQty: row.initialStock,
              lastReceivedAt: new Date(),
            });
            await tx.insert(stockMovements).values({
              companyId,
              branchId: defaultBranch.id,
              variantId: newVariant.id,
              type: 'stock_in',
              quantity: row.initialStock,
              beforeQty: 0,
              afterQty: row.initialStock,
              unitCost: row.costPrice !== null ? row.costPrice.toFixed(2) : null,
              note: 'Excel import',
              createdById: userId,
            });
          }

          // Product denormalize stock total
          if (row.initialStock > 0) {
            await tx
              .update(products)
              .set({ totalStockQty: row.initialStock })
              .where(eq(products.id, newProduct.id));
          }

          inserted++;
        } catch (rowErr) {
          const msg = rowErr instanceof Error ? rowErr.message : 'unknown';
          execErrors.push({ row: i + 1, message: msg });
          throw rowErr; // tx rollback
        }
      }
    });
  } catch {
    return {
      ok: false,
      inserted: 0,
      errors: execErrors.length > 0 ? execErrors : [{ row: 0, message: 'Yükleme başarısız (transaction rollback)' }],
    };
  }

  writeAuditLogAsync(
    {
      companyId,
      userId,
      action: 'products.imported',
      entityType: 'product',
      entityId: null,
      afterState: { inserted },
    },
    db,
  );

  return { ok: true, inserted, errors: [] };
}

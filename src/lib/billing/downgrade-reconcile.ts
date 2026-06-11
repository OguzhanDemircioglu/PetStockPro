/**
 * Plan düşüş mutabakatı — vitrin over-limit auto-unpublish (I2 + b).
 *
 * Plan düştüğünde (FREE'ye expire VEYA PRO+ → PRO dönem-sonu switch) yeni planın
 * vitrin limitini aşan ürünleri otomatik vitrin'den çeker (en eski yayınlananlar).
 * Ürünler SİLİNMEZ — yalnız vitrinPublished=false + reason='plan_downgrade'.
 * En yeni `limit` ürün vitrin'de kalır. limit = Infinity ise no-op (upgrade).
 *
 * Hem renewals.expireDueSubscriptions (FREE limiti) hem orchestrator.applySuccess
 * (yeni plan limiti) bunu çağırır → tek kaynak, tutarlı davranış.
 */

import { and, desc, eq, inArray } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { products } from '@/db/schema';

/**
 * @returns vitrin'den çekilen ürün sayısı (0 = limit aşılmadı / sınırsız plan).
 */
export async function unpublishVitrinOverLimit(
  db: DbClient,
  companyId: string,
  limit: number,
  now: Date,
): Promise<number> {
  if (!Number.isFinite(limit)) return 0; // ∞ vitrin limiti → kırpma yok

  const published = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.companyId, companyId), eq(products.vitrinPublished, true)))
    .orderBy(desc(products.vitrinPublishedAt)); // en yeni → en eski
  if (published.length <= limit) return 0;

  const toUnpublish = published.slice(limit).map((p) => p.id); // limit'ten sonrakiler (en eskiler)
  await db
    .update(products)
    .set({
      vitrinPublished: false,
      vitrinAutoUnpublishedAt: now,
      vitrinAutoUnpublishedReason: 'plan_downgrade',
      updatedAt: now,
    })
    .where(inArray(products.id, toUnpublish));
  return toUnpublish.length;
}

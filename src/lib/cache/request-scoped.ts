/**
 * Request-scoped cache helpers — React.cache() ile aynı request içinde
 * çağrılan duplicate DB sorgu'larını otomatik memoize eder.
 *
 * Tur 2 (P0-2): Layout'taki 4 query + pano'daki 10 helper içinde aynı
 * `companies` ve `users` lookup'ları duplicate yapılıyordu. React.cache()
 * ile request başına 1 sorgu garantilenir.
 *
 * Kullanım:
 *   import { getCompanyById, getUnreadCountForUser } from '@/lib/cache/request-scoped';
 *   const company = await getCompanyById(companyId);  // ilk çağrı → DB
 *   const same = await getCompanyById(companyId);     // cache → 0 DB call
 *
 * cache(fn) signature: fn aynı args ile çağrılırsa promise'i cache'ler.
 * Args by reference compared (string/uuid OK, object problematic — use string keys).
 */

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { withTenant } from '@/lib/db/with-tenant';
import {
  cities as citiesTable,
  companies,
  productVariants,
  products,
  branchInventory,
  notifications,
  brands,
  categories,
} from '@/db/schema';

/**
 * Company lookup by ID — request-scoped.
 * Layout + pano + 8+ admin sayfa'da kullanılır.
 */
export const getCompanyById = cache(async (companyId: string) =>
  // Faz 4B — tenant tablosu; RLS context'i içinde (cached değer tek tx'te hesaplanır).
  withTenant(companyId, async (tx) => {
    const rows = await tx
      .select({
        id: companies.id,
        name: companies.name,
        plan: companies.plan,
        slug: companies.slug,
        vatNo: companies.vatNo,
        storefrontStatus: companies.storefrontStatus,
      })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);
    return rows[0] ?? null;
  }),
);

/**
 * Aktif ürün sayısı (soft delete hariç) — request-scoped.
 * Layout (plan progress) + pano (kpi-trio) duplicate.
 */
export const getProductCountForCompany = cache(async (companyId: string) =>
  withTenant(companyId, async (tx) => {
    const rows = await tx
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(products)
      .where(
        and(
          eq(products.companyId, companyId),
          isNull(products.deletedAt),
        ),
      );
    return rows[0]?.count ?? 0;
  }),
);

/**
 * Düşük stok variant sayısı (threshold per branch JSONB) — request-scoped.
 * Layout (sidebar rozet) + pano (alert band) + low-stock detay.
 */
export const getLowStockCountForCompany = cache(async (companyId: string) =>
  withTenant(companyId, async (tx) => {
    const rows = await tx
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(branchInventory)
      .innerJoin(
        productVariants,
        eq(productVariants.id, branchInventory.variantId),
      )
      .where(
        and(
          eq(branchInventory.companyId, companyId),
          eq(productVariants.isActive, true),
          sql`${branchInventory.stockQty} <= COALESCE(
            (${productVariants.branchThresholds} ->> ${branchInventory.branchId}::text)::int,
            ${productVariants.threshold}
          )`,
        ),
      );
    return rows[0]?.count ?? 0;
  }),
);

/**
 * Kullanıcı için okunmamış bildirim sayısı — request-scoped.
 * Layout (bell badge) + pano (notif-feed) + bell client component.
 */
export const getUnreadNotificationCount = cache(
  async (companyId: string, userId: string) =>
    withTenant(companyId, async (tx) => {
      const rows = await tx
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(notifications)
        .where(
          and(
            eq(notifications.companyId, companyId),
            // userId null = company-wide notification, eşleşir
            sql`(${notifications.userId} IS NULL OR ${notifications.userId} = ${userId})`,
            isNull(notifications.readAt),
          ),
        );
      return rows[0]?.count ?? 0;
    }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Cross-request cache — sabit / nadir değişen veriler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tüm il listesi — Türkiye 81 il, sabit data, 24 saatlik cache.
 * Frankly, son güncellemeyi tag invalidation ile yap (Faz 2).
 */
export const getAllCities = unstable_cache(
  async () => {
    return db
      .select({
        id: citiesTable.id,
        name: citiesTable.name,
        slug: citiesTable.slug,
      })
      .from(citiesTable)
      .orderBy(citiesTable.name);
  },
  ['cities-all'],
  { revalidate: 86400, tags: ['cities'] },
);

/**
 * Global kategoriler — Migration 0026'dan beri tenant'tan bağımsız (ortak referans).
 * Statik veri → cross-request cache, 1 saat revalidate. Ürün formu (new + edit)
 * her açılışta DB sorgusu yerine cache'ten okur. Süperadmin kategori CRUD'unda
 * `revalidateTag('categories')` ile anında tazelenir.
 * Faz 2B (PLAN-MIMARI-SAGLAMLASTIRMA-VE-STATE) — getAllCities pattern'i.
 */
export const getCachedCategories = unstable_cache(
  async () => {
    return db
      .select({
        id: categories.id,
        name: categories.name,
        emoji: categories.emoji,
        slug: categories.slug,
        parentId: categories.parentId,
        displayOrder: categories.displayOrder,
        sktRequired: categories.sktRequired,
      })
      .from(categories)
      .orderBy(categories.displayOrder);
  },
  ['categories-all'],
  { revalidate: 3600, tags: ['categories'] },
);

/**
 * Global markalar — Migration 0026'dan beri tenant'tan bağımsız.
 * Süperadmin marka CRUD'unda `revalidateTag('brands')` ile tazelenir.
 */
export const getCachedBrands = unstable_cache(
  async () => {
    return db
      .select({ id: brands.id, name: brands.name, slug: brands.slug, logoUrl: brands.logoUrl })
      .from(brands)
      .orderBy(brands.name);
  },
  ['brands-all'],
  { revalidate: 3600, tags: ['brands'] },
);

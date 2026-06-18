/**
 * Tenant izolasyon — tek doğruluk kaynağı (single source of truth).
 *
 * Bu modül, her bir DB tablosunu tenant izolasyonu açısından sınıflar. Saf veri:
 * runtime maliyeti yok, şema import etmez (drift'i test doğrular, bkz.
 * `tenant-guard.test.ts`).
 *
 * ─────────────────────────────────────────────────────────────────
 * KONVANSİYON (Faz 4A — mimari sağlamlaştırma)
 * ─────────────────────────────────────────────────────────────────
 * RLS bugün **dekoratif** (runtime owner rolüyle bağlanıp bypass ediyor); tenant
 * izolasyonu %100 elle `WHERE company_id = $companyId` disiplinine bağlı. Tek
 * unutulan cümle = sessiz cross-tenant sızıntı.
 *
 * Kural: **TENANT_SCOPED veya TENANT_CHILD bir tabloya dokunan her `src/lib`
 * helper'ı, `companyId` parametresi alır ve onunla filtreler.** Bu konvansiyonu
 * `tenant-guard.test.ts` statik olarak CI'da zorlar — `companyId` görmeyen yeni
 * bir tenant helper'ı testi kırar.
 *
 * 4A bir AĞ'dır (ucuz tripwire), DUVAR değil: "companyId mevcut mu" doğrular,
 * "WHERE'de doğru kullanıldı mı" değil. Yapısal garanti Faz 4B'de (gerçek RLS,
 * `app_user` NOBYPASSRLS rolü + `SET LOCAL app.current_company_id`) gelir; o zaman
 * unutulan filtre **sızdırmak yerine 0 satır** döndürür. Bu liste 4B politika
 * üretiminin de girdisidir.
 *
 * Kaynak: docs/PLAN-MIMARI-SAGLAMLASTIRMA-VE-STATE.md §FAZ 4,
 *         docs/STATE-MANAGEMENT-KURALI.md.
 */

/**
 * Doğrudan `company_id` kolonu taşıyan tenant iş/defter verisi. Sızıntı yüzeyi:
 * "kimliği doğrulanmış tenant yanlışlıkla başka tenant'ın kayıtlarını sorgular".
 * Her helper `companyId` ile filtrelemeli.
 */
export const TENANT_SCOPED_TABLE_IDS = [
  'branches',
  'suppliers',
  'products',
  'productVariants',
  'branchInventory',
  'stockMovements',
  'stocktakes',
  'vitrinEvents',
  'notifications',
  'storefrontSettings',
  'vitrinWhatsappFeedback',
  'vitrinReports',
  'aiUsage',
  'aiMessages',
  'subscriptions',
  'invoices',
  'auditLogs',
] as const;

/**
 * `company_id` kolonu YOK; tenant'a parent FK üzerinden bağlı (join ile scope
 * edilir). Bu tablolara dokunan helper de companyId görmeli — sahiplik parent
 * üzerinden doğrulanır (örn. productImages → products.companyId).
 */
export const TENANT_CHILD_TABLE_IDS = [
  'stocktakeItems', // → stocktakes.companyId
  'productImages', // → products / product_variants.companyId
  'userPermissions', // → users.companyId
] as const;

/**
 * Global/referans veri — tenant filtresi YOK, tüm tenant'lar paylaşır.
 * brands + categories 2026-05-22 (Migration 0026) ile global'e taşındı.
 */
export const GLOBAL_TABLE_IDS = [
  'cities',
  'districts',
  'brands',
  'categories',
  'catalogSeedProducts',
] as const;

/**
 * Kimlik + sistem tabloları — tenant liste-sızıntı yüzeyi DEĞİL. id / email /
 * harici ref ile erişilir (companyId-first liste sorgusu değil):
 *  - companies → tenant kökü, `id` = companyId (company_id kolonu yok).
 *  - users → kimlik; companyId nullable, login email/id ile çalışır (auth katmanı).
 *  - sessions → Auth.js oturumu (userId).
 *  - processedWebhooks → webhook idempotency (merchant_oid / eventId).
 *  - systemErrors → observability sink; superadmin tümünü okur (companyId opsiyonel).
 */
export const SYSTEM_IDENTITY_TABLE_IDS = [
  'companies',
  'users',
  'sessions',
  'processedWebhooks',
  'systemErrors',
] as const;

export type TenantScopedTableId = (typeof TENANT_SCOPED_TABLE_IDS)[number];
export type TenantChildTableId = (typeof TENANT_CHILD_TABLE_IDS)[number];
export type GlobalTableId = (typeof GLOBAL_TABLE_IDS)[number];
export type SystemIdentityTableId = (typeof SYSTEM_IDENTITY_TABLE_IDS)[number];

/**
 * Guard tetik kümesi: bu tablolardan birine bir sorgu fiili
 * (from/insert/update/delete/join) ile dokunan exported helper, companyId
 * görmek ZORUNDA (yoksa tenant-guard.test.ts kırar). = scoped + child.
 */
export const TENANT_GUARDED_TABLE_IDS = [
  ...TENANT_SCOPED_TABLE_IDS,
  ...TENANT_CHILD_TABLE_IDS,
] as const;

export type TenantGuardedTableId = (typeof TENANT_GUARDED_TABLE_IDS)[number];

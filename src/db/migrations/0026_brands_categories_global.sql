-- 2026-05-22 Brands + Categories GLOBAL refactor (kullanıcı kararı)
--
-- Sorun: brands.company_id + categories.company_id FK NOT NULL → her tenant
-- kendi tabloya seed ediyordu. 8 tenant × ortalama 24 brand = 196 row (98
-- unique slug). 8 tenant × ortalama 43 cat = 343 row (49 unique slug). Vitrin
-- cross-tenant slug ile GROUP BY zorunda — duplicate veri + karmaşık query.
--
-- Karar: brands + categories GLOBAL tabloya dönüştür (companyId YOK).
--   - SUPERADMIN-only CRUD (pet shop yeni brand/category ekleyemez)
--   - slug UNIQUE
--   - Mevcut data konsolide: distinct slug seçimi + products FK remap
--
-- Strategy:
--   1. Distinct brand'leri yeni global tabloya kopyala (en eski companyId
--      bazında MIN(id) — diğerleri silinecek)
--   2. Aynı şey categories için
--   3. products.brand_id + category_id remap (slug eşleme)
--   4. Eski FK constraints DROP
--   5. company_id column DROP + slug UNIQUE index
--
-- Bu migration idempotent değil — bir kez çalışır. Production'da fresh DB
-- olduğu için risk düşük.

-- ─── 1. brands GLOBAL — companyId kaldır + slug UNIQUE ─────────────

-- 1.a. Distinct brand'leri seç ve mevcut tabloyu temizle.
-- Önce her slug için MIN(id) bul, diğerlerini geçici olarak işaretle.

-- Mapping tablo (sonra silinir) — eski brand_id → global brand_id
CREATE TEMP TABLE _brand_id_map AS
SELECT
  b.id as old_id,
  (
    SELECT b2.id FROM petstockpro.brands b2
    WHERE b2.slug = b.slug
    ORDER BY b2.created_at ASC, b2.id ASC
    LIMIT 1
  ) as new_id
FROM petstockpro.brands b;

-- 1.b. products.brand_id remap (slug eşleştirmesi ile)
UPDATE petstockpro.products p
SET brand_id = m.new_id
FROM _brand_id_map m
WHERE p.brand_id = m.old_id
  AND m.old_id != m.new_id;

-- 1.c. Duplicate brand'leri sil (MIN(id) hariç)
DELETE FROM petstockpro.brands b
WHERE b.id NOT IN (
  SELECT DISTINCT new_id FROM _brand_id_map
);

-- 1.d. Eski unique index (company_id, slug) DROP
DROP INDEX IF EXISTS "petstockpro"."idx_brands_company_slug";

-- 1.e. company_id FK DROP
ALTER TABLE "petstockpro"."brands"
  DROP CONSTRAINT IF EXISTS "brands_company_id_companies_id_fk";

-- 1.f. company_id column DROP
ALTER TABLE "petstockpro"."brands"
  DROP COLUMN IF EXISTS "company_id";

-- 1.g. slug UNIQUE index (yeni global)
CREATE UNIQUE INDEX IF NOT EXISTS "idx_brands_slug" ON "petstockpro"."brands" ("slug");

-- ─── 2. categories GLOBAL — aynı pattern ───────────────────────────

CREATE TEMP TABLE _category_id_map AS
SELECT
  c.id as old_id,
  (
    SELECT c2.id FROM petstockpro.categories c2
    WHERE c2.slug = c.slug
    ORDER BY c2.created_at ASC, c2.id ASC
    LIMIT 1
  ) as new_id
FROM petstockpro.categories c;

-- parent_id remap
UPDATE petstockpro.categories c
SET parent_id = m.new_id
FROM _category_id_map m
WHERE c.parent_id = m.old_id
  AND m.old_id != m.new_id;

-- products.category_id remap
UPDATE petstockpro.products p
SET category_id = m.new_id
FROM _category_id_map m
WHERE p.category_id = m.old_id
  AND m.old_id != m.new_id;

-- stocktakes.category_id remap (sayım kategori filtresi)
UPDATE petstockpro.stocktakes s
SET category_id = m.new_id
FROM _category_id_map m
WHERE s.category_id = m.old_id
  AND m.old_id != m.new_id;

-- Duplicate category sil
DELETE FROM petstockpro.categories c
WHERE c.id NOT IN (
  SELECT DISTINCT new_id FROM _category_id_map
);

-- Eski indexes + FK DROP
DROP INDEX IF EXISTS "petstockpro"."idx_categories_company_slug";

ALTER TABLE "petstockpro"."categories"
  DROP CONSTRAINT IF EXISTS "categories_company_id_companies_id_fk";

ALTER TABLE "petstockpro"."categories"
  DROP COLUMN IF EXISTS "company_id";

CREATE UNIQUE INDEX IF NOT EXISTS "idx_categories_slug" ON "petstockpro"."categories" ("slug");

-- Cleanup temp tables
DROP TABLE _brand_id_map;
DROP TABLE _category_id_map;

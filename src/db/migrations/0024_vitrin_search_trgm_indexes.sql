-- Tur 5 (P1-4 Performance Deep Audit) — pg_trgm GIN index for vitrin search
--
-- Bulgu: src/lib/vitrin/search.ts `ILIKE %query%` leading wildcard
-- products.name + brands.name → B-tree index kullanmaz, her zaman seq scan.
-- 1K-10K ürün'de lineer kötüleşir.
--
-- pg_trgm extension Migration 0018'de eklenmiş, catalog_seed_products
-- üzerinde GIN var. Asıl tablolar (products + brands) eksik.
--
-- Çözüm: lower(name) trigram GIN index. Search query'i de lower() ile
-- normalize edilir (lib/vitrin/search.ts refactor).
--
-- CONCURRENTLY — production'da locking olmadan oluşur.

-- pg_trgm extension zaten var (0018), ek güvenlik için IF NOT EXISTS
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Not: `name gin_trgm_ops` (lower'sız) — PostgreSQL ILIKE zaten case-insensitive
-- ve pg_trgm GIN index'i ILIKE ile match eder. lower() wrap yok, search.ts
-- ilike(products.name, '%pattern%') olduğu gibi kalır.
-- Partial WHERE: sadece vitrin'de görünen ürün (vitrinPublished + !deleted)

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_products_name_trgm"
  ON "petstockpro"."products"
  USING GIN ("name" gin_trgm_ops)
  WHERE "deleted_at" IS NULL AND "vitrin_published" = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_brands_name_trgm"
  ON "petstockpro"."brands"
  USING GIN ("name" gin_trgm_ops);

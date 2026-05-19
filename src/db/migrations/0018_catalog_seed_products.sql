-- Sprint E — Catalog Seed Products (autocomplete dataset, global ref tablo)
--
-- `/admin/products/new` formundaki autocomplete combobox'ın veri kaynağı.
-- 1.240 curated TR pet ürünü — marka + ad + ağırlık + kategori + R2 image_path.
-- Tenant'a bağlı DEĞİL (global referans), FK yok, çok hızlı LIKE search.
--
-- Tasarım kararları:
--   - id INTEGER (UUID değil — 4 byte vs 16 byte, PK btree daha kompakt)
--   - animal_type VARCHAR(10) (ENUM kullanılmadı çünkü mevcut enum'da 'hamster' yok)
--   - image_path VARCHAR(48) — R2 object key "seed/{hash}.webp"
--   - Tek GIN trgm index: name (brand zaten name'in başında)
--   - UNIQUE (brand, name, weight): dedup invariant

CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint

CREATE TABLE "petstockpro"."catalog_seed_products" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "petstockpro"."catalog_seed_products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(180) NOT NULL,
	"brand" varchar(60) NOT NULL,
	"weight" varchar(16) NOT NULL,
	"animal_type" varchar(10) NOT NULL,
	"category_slug" varchar(40) NOT NULL,
	"image_path" varchar(48) NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX "catalog_seed_brand_name_weight_unique"
  ON "petstockpro"."catalog_seed_products" USING btree ("brand","name","weight");
--> statement-breakpoint

CREATE INDEX "idx_catalog_seed_name_trgm"
  ON "petstockpro"."catalog_seed_products" USING gin (lower("name") gin_trgm_ops);

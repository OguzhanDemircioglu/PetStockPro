-- Sprint UI cleanup — categories.vat_rate kaldırılıyor.
--
-- Gerekçe: UI/CSV/form/audit hiçbir yerde okumuyor veya yazmıyor. Default
-- kategori seed'i sadece kolonu null insert ediyordu. Ürün-bazlı KDV
-- ileride gerekirse `products`/`product_variants` üzerinde tutulacak.
--
-- Slug kolonuna dokunulmadı — vitrin route URL'leri ('/vitrin/kategori/[slug]'),
-- sitemap, cross-tenant kategori join'i hala slug üzerinden çalışıyor.

ALTER TABLE petstockpro.categories DROP COLUMN IF EXISTS vat_rate;

-- Tur 4 (P1-1 Performance Deep Audit) — companies.storefront_status partial index
--
-- Bulgu: EXPLAIN ANALYZE `WHERE storefront_status = 'approved'` → Seq Scan
-- on companies (filter, rows removed by filter). 7 row'da planning 4.4ms;
-- 1K tenant'ta lineer kötüleşir. Vitrin'in en sık filter'ı (popular products,
-- nearby, search, sitemap — hepsi 'approved' filter ile başlıyor).
--
-- Partial index — sadece 'approved' tenant'ları index'ler (vitrin'de görünen
-- tenant), index boyutu küçük + sorgu hızlı. 'pending' / 'rejected' /
-- 'auto_suspended' tenant'lar tablo scan yine ama çok seyrek (süperadmin'de).
--
-- CONCURRENTLY — production'da locking olmadan oluşur.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_companies_storefront_approved"
  ON "petstockpro"."companies" ("storefront_status")
  WHERE "storefront_status" = 'approved';

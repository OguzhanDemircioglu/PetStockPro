-- 0039_function_search_path_hardening — Supabase advisor 0011 (function_search_path_mutable)
--
-- ⚠ MANUEL APPLY: journal'a EKLENMEZ. node-postgres / execute_sql ile iki DB'ye.
--    Idempotent (ALTER FUNCTION ... SET search_path tekrar çalıştırılabilir).
--    SIRA: 0033'TEN SONRA uygulanmalı. 0033 immutable fn'leri CREATE OR REPLACE ile
--    yeniden tanımlarsa SET search_path sıfırlanır → 0033 yeniden uygulanırsa bunu da
--    tekrar uygula.
--
-- Trigger/helper fonksiyonlarına SABİT search_path ekler. Dördü de SECURITY INVOKER
-- (DEFINER değil) — yükseltilmiş yetkiyle çalışmaz, gerçek risk düşük; yine de linter
-- 0011'i kapatır ve pg_temp-shadowing sertleştirmesi sağlar (pg_temp en sonda).
--
-- Değerler:
--   set_updated_at / audit_logs_immutable / stock_movements_immutable
--     → pg_catalog, pg_temp  (yalnız built-in kullanır: NOW(), to_jsonb, jsonb '-', RAISE)
--   tr_slug
--     → pg_catalog, public, pg_temp  (unaccent extension'ı public şemasında — public
--        olmadan slug üretimi kırılır)

ALTER FUNCTION petstockpro.set_updated_at()            SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION petstockpro.audit_logs_immutable()      SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION petstockpro.stock_movements_immutable() SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION petstockpro.tr_slug(text)               SET search_path = pg_catalog, public, pg_temp;

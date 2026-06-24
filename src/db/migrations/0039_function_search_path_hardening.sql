-- 0039_function_search_path_hardening — Supabase advisor 0011 (function_search_path_mutable)
--
-- ⚠ MANUEL APPLY: journal'a EKLENMEZ. node-postgres / execute_sql ile İKİ DB'ye (Supabase + Aiven).
--    Idempotent + VAR-OLANA-KOŞULLU (IF EXISTS) → iki DB'de FARKLI fonksiyon seti olsa
--    bile güvenle çalışır.
--    SIRA: 0033'TEN SONRA. (0033 immutable fn'leri CREATE OR REPLACE ile yeniden
--    tanımlarsa SET search_path sıfırlanır → 0033 yeniden uygulanırsa bunu da tekrar uygula.)
--
-- ⚠ DB DRIFT NOTU (2026-06-24 keşfedildi):
--   set_updated_at + tr_slug → SADECE Supabase'de var (erken kurulumda manuel eklenmiş,
--     migration'da yok; app bu işleri TS'te yapıyor → updated_at Drizzle $onUpdate, slug
--     lib/utils/slug.ts → DB fonksiyonları atıl). Aiven'da YOK.
--   audit_logs_immutable + stock_movements_immutable → İKİ DB'de de var (migration 0033).
--   Bu yüzden her ALTER IF EXISTS ile sarıldı (Aiven'da olmayan 2 fn atlanır).
--
-- Hepsi SECURITY INVOKER (DEFINER değil) — yükseltilmiş yetkiyle çalışmaz, gerçek risk
-- düşük; yine de linter 0011'i kapatır ve pg_temp-shadowing sertleştirmesi sağlar.
--
-- Değerler:
--   set_updated_at / audit_logs_immutable / stock_movements_immutable
--     → pg_catalog, pg_temp        (yalnız built-in: NOW(), to_jsonb, jsonb '-', RAISE)
--   tr_slug
--     → pg_catalog, public, pg_temp (unaccent extension'ı public şemasında)

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'petstockpro' AND p.proname = 'set_updated_at') THEN
    ALTER FUNCTION petstockpro.set_updated_at() SET search_path = pg_catalog, pg_temp;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'petstockpro' AND p.proname = 'audit_logs_immutable') THEN
    ALTER FUNCTION petstockpro.audit_logs_immutable() SET search_path = pg_catalog, pg_temp;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'petstockpro' AND p.proname = 'stock_movements_immutable') THEN
    ALTER FUNCTION petstockpro.stock_movements_immutable() SET search_path = pg_catalog, pg_temp;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'petstockpro' AND p.proname = 'tr_slug') THEN
    ALTER FUNCTION petstockpro.tr_slug(text) SET search_path = pg_catalog, public, pg_temp;
  END IF;
END $$;

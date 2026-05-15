-- ============================================================
-- PetStockPro — Supabase Setup SQL
-- ============================================================
--
-- Bu dosyayı Supabase Dashboard → SQL Editor'da çalıştır.
-- Otoritatif: docs/SUPABASE-SETUP.md
--
-- Hazırlık:
-- 1. Supabase projesi açıldı mı? (Frankfurt region: eu-central-1)
-- 2. .env'de SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY var mı?
-- 3. .env'de DATABASE_URL (postgres connection string) var mı?
--
-- Sonra:
-- 1. Bu dosyayı SQL Editor'a yapıştır → Run
-- 2. Hata yoksa: drizzle-kit push (npm run db:push) ile şemayı uygula
-- ============================================================

-- ============================================================
-- 1. Schema yarat
-- ============================================================

CREATE SCHEMA IF NOT EXISTS petstockpro;

-- Schema'ya search_path öncelik ver (Drizzle Drizzle Kit search_path=petstockpro,public)
GRANT USAGE ON SCHEMA petstockpro TO postgres, authenticated, anon, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA petstockpro TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA petstockpro TO postgres, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA petstockpro TO postgres, service_role;

-- Default privileges (gelecekte oluşturulacak objeler için)
ALTER DEFAULT PRIVILEGES IN SCHEMA petstockpro
  GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA petstockpro
  GRANT ALL ON SEQUENCES TO postgres, service_role;

-- ============================================================
-- 2. Extensions
-- ============================================================
-- Hepsi PostgreSQL extensions schema'sında kurulur (Supabase default)

CREATE EXTENSION IF NOT EXISTS postgis;          -- Vitrin yakınlık sorgusu (ST_DWithin, ST_Distance)
CREATE EXTENSION IF NOT EXISTS pg_trgm;          -- Fuzzy search (trigram similarity, GIN index)
CREATE EXTENSION IF NOT EXISTS moddatetime;      -- updated_at otomatik trigger
CREATE EXTENSION IF NOT EXISTS unaccent;         -- Türkçe karakter-insensitive arama (Ünlü → unlu)
CREATE EXTENSION IF NOT EXISTS pg_jsonschema;    -- JSONB validation (audit_log metadata, vs.)

-- ============================================================
-- 3. Helper functions
-- ============================================================

-- updated_at auto-trigger fonksiyonu (moddatetime alternatifi, daha kontrollü)
CREATE OR REPLACE FUNCTION petstockpro.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Türkçe slug üretimi (unaccent + lowercase + tire)
CREATE OR REPLACE FUNCTION petstockpro.tr_slug(input TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN regexp_replace(
    regexp_replace(
      lower(unaccent(input)),
      '[^a-z0-9]+', '-', 'g'
    ),
    '^-+|-+$', '', 'g'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- 4. Doğrulama
-- ============================================================

SELECT
  'Schema yaratıldı: ' || EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = 'petstockpro') AS status_schema,
  'PostGIS aktif: ' || EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'postgis') AS status_postgis,
  'pg_trgm aktif: ' || EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') AS status_pg_trgm,
  'moddatetime aktif: ' || EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'moddatetime') AS status_moddatetime,
  'unaccent aktif: ' || EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'unaccent') AS status_unaccent,
  'pg_jsonschema aktif: ' || EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_jsonschema') AS status_pg_jsonschema;

-- Hepsi 'true' dönmeli. Eğer pg_jsonschema bulunmazsa Supabase Free tier'de henüz aktif değildir:
-- Dashboard → Database → Extensions sayfasından manuel aktive et.

-- ============================================================
-- Sıradaki adım
-- ============================================================
-- 1. Bu SQL başarıyla çalıştıysa: npm run db:push (Drizzle Kit ile şema uygulama)
-- 2. Sonra: npm run db:seed (Cities + Districts seed — 81 il + ~970 ilçe)
-- 3. Sonra: npm run dev (localhost:3000 test)

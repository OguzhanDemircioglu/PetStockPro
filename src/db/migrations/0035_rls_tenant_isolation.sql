-- 0035_rls_tenant_isolation — Faz 4B (docs/PLAN-FAZ-4B-RLS.md)
--
-- ⚠⚠ HENÜZ UYGULANMADI — STAGING-FIRST cutover runbook'una göre uygulanır.
--    Journal'a EKLENMEZ (manuel-apply, node-postgres / execute_sql, owner rolüyle).
--    Idempotent (DROP POLICY IF EXISTS + ENABLE RLS no-op).
--
-- ÖN KOŞUL (runbook STEP 0 — bu dosyadan ÖNCE, owner ile):
--    CREATE ROLE app_user LOGIN PASSWORD '***' NOBYPASSRLS;
--    -- (env: runtime DATABASE_URL = app_user, migrator/owner DATABASE_URL = postgres)
--
-- MODEL:
--  • Runtime `app_user` rolüyle bağlanır (NOBYPASSRLS). Her tenant request'i
--    withTenant() ile `app.current_company_id` GUC'unu transaction-local set eder.
--  • Owner/migrator (postgres) RLS'i BYPASS eder (FORCE ROW LEVEL SECURITY YOK) →
--    drizzle-kit migrate + withOwner() özel yolları etkilenmez.
--  • Politikalar `TO app_user` — yalnız runtime rolünü kısıtlar; anon/authenticated
--    (Supabase REST) mevcut default-deny posture'ı korunur.
--  • GUC unset/'' → nullif(...)::uuid = NULL → `company_id = NULL` = false →
--    0 satır (FAIL-CLOSED). Unutulan filtre sızdırmaz.
--
-- ÖZEL YOLLAR (withOwner / owner bağlantı — RLS bypass; tenant policy YOK):
--    auth (login/register/verify/reset), cron, webhook, süperadmin, vitrin public,
--    global tablo YAZMA (brands/categories CRUD), companies/users OLUŞTURMA.
--    Bkz. PLAN-FAZ-4B-RLS.md §Özel Yollar. (= tenant-guard.test.ts muaf bölgeleri.)

-- ═══════════════════════════════════════════════════════════════════════
-- 1) GRANT — app_user'a tablo erişimi (RLS satır düzeyinde ayrıca kısıtlar)
-- ═══════════════════════════════════════════════════════════════════════
GRANT USAGE ON SCHEMA petstockpro TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA petstockpro TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA petstockpro TO app_user;
-- Gelecekte eklenen tablolar/sequence'ler için default privileges (owner oluşturursa):
ALTER DEFAULT PRIVILEGES IN SCHEMA petstockpro
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA petstockpro
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- Owner-only tablolar — app_user erişimi YOK (auth/webhook/error owner-path):
--   sessions (Auth.js token), processed_webhooks (idempotency), system_errors (sink).
REVOKE ALL ON petstockpro.sessions FROM app_user;
REVOKE ALL ON petstockpro.processed_webhooks FROM app_user;
REVOKE ALL ON petstockpro.system_errors FROM app_user;

-- ═══════════════════════════════════════════════════════════════════════
-- 2) TENANT-SCOPED (17) — doğrudan company_id; tek-tip izolasyon politikası
-- ═══════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  t text;
  scoped text[] := ARRAY[
    'branches','suppliers','products','product_variants','branch_inventory',
    'stock_movements','stocktakes','vitrin_events','notifications','storefront_settings',
    'vitrin_whatsapp_feedback','vitrin_reports','ai_usage','ai_messages',
    'subscriptions','invoices','audit_logs'
  ];
BEGIN
  FOREACH t IN ARRAY scoped LOOP
    EXECUTE format('ALTER TABLE petstockpro.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON petstockpro.%I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON petstockpro.%I FOR ALL TO app_user '
      'USING (company_id = nullif(current_setting(''app.current_company_id'', true), '''')::uuid) '
      'WITH CHECK (company_id = nullif(current_setting(''app.current_company_id'', true), '''')::uuid)',
      t
    );
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 3) TENANT-CHILD (3) — company_id YOK; parent FK üzerinden EXISTS ile scope
-- ═══════════════════════════════════════════════════════════════════════
-- product_images → products.company_id
ALTER TABLE petstockpro.product_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON petstockpro.product_images;
CREATE POLICY tenant_isolation ON petstockpro.product_images FOR ALL TO app_user
  USING (EXISTS (SELECT 1 FROM petstockpro.products p
    WHERE p.id = product_images.product_id
      AND p.company_id = nullif(current_setting('app.current_company_id', true), '')::uuid))
  WITH CHECK (EXISTS (SELECT 1 FROM petstockpro.products p
    WHERE p.id = product_images.product_id
      AND p.company_id = nullif(current_setting('app.current_company_id', true), '')::uuid));

-- stocktake_items → stocktakes.company_id
ALTER TABLE petstockpro.stocktake_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON petstockpro.stocktake_items;
CREATE POLICY tenant_isolation ON petstockpro.stocktake_items FOR ALL TO app_user
  USING (EXISTS (SELECT 1 FROM petstockpro.stocktakes s
    WHERE s.id = stocktake_items.stocktake_id
      AND s.company_id = nullif(current_setting('app.current_company_id', true), '')::uuid))
  WITH CHECK (EXISTS (SELECT 1 FROM petstockpro.stocktakes s
    WHERE s.id = stocktake_items.stocktake_id
      AND s.company_id = nullif(current_setting('app.current_company_id', true), '')::uuid));

-- user_permissions → users.company_id
ALTER TABLE petstockpro.user_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON petstockpro.user_permissions;
CREATE POLICY tenant_isolation ON petstockpro.user_permissions FOR ALL TO app_user
  USING (EXISTS (SELECT 1 FROM petstockpro.users u
    WHERE u.id = user_permissions.user_id
      AND u.company_id = nullif(current_setting('app.current_company_id', true), '')::uuid))
  WITH CHECK (EXISTS (SELECT 1 FROM petstockpro.users u
    WHERE u.id = user_permissions.user_id
      AND u.company_id = nullif(current_setting('app.current_company_id', true), '')::uuid));

-- ═══════════════════════════════════════════════════════════════════════
-- 4) TENANT-ROOT / IDENTITY — companies (id=GUC), users (company_id=GUC)
--    OLUŞTURMA (register/invite) + login (email, GUC yok) = owner-path (withOwner).
--    Buradaki politikalar yalnız OTURUMLU self/tenant okuma-güncellemeyi kapsar.
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE petstockpro.companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_self ON petstockpro.companies;
CREATE POLICY tenant_self ON petstockpro.companies FOR ALL TO app_user
  USING (id = nullif(current_setting('app.current_company_id', true), '')::uuid)
  WITH CHECK (id = nullif(current_setting('app.current_company_id', true), '')::uuid);

ALTER TABLE petstockpro.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_users ON petstockpro.users;
CREATE POLICY tenant_users ON petstockpro.users FOR ALL TO app_user
  USING (company_id = nullif(current_setting('app.current_company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.current_company_id', true), '')::uuid);

-- ═══════════════════════════════════════════════════════════════════════
-- 5) GLOBAL/REFERANS (5) — tenant filtresi YOK; app_user yalnız OKUR.
--    YAZMA (brands/categories CRUD süperadmin) = owner-path (withOwner).
-- ═══════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  t text;
  globals text[] := ARRAY['cities','districts','brands','categories','catalog_seed_products'];
BEGIN
  FOREACH t IN ARRAY globals LOOP
    EXECUTE format('ALTER TABLE petstockpro.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS global_read ON petstockpro.%I', t);
    EXECUTE format(
      'CREATE POLICY global_read ON petstockpro.%I FOR SELECT TO app_user USING (true)', t);
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- ROLLBACK (acil — runtime'ı owner'a geri al + politikaları kaldır):
--   Runtime DATABASE_URL = owner (anında etki) → uygulama owner ile RLS bypass.
--   İsteğe bağlı temizlik: her tabloda DROP POLICY + DISABLE ROW LEVEL SECURITY.
--   Bkz. PLAN-FAZ-4B-RLS.md §Rollback.
-- ═══════════════════════════════════════════════════════════════════════

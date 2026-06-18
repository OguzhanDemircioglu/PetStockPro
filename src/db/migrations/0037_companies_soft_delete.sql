-- 0037_companies_soft_delete — Faz 5C (docs/PLAN-MIMARI-SAGLAMLASTIRMA-VE-STATE.md §FAZ 5C)
--
-- ⚠ MANUEL APPLY: journal'a EKLENMEZ. node-postgres / execute_sql ile İKİ DB'ye (Supabase + Aiven).
--    Additive (nullable ADD COLUMN) → sıra önemsiz, eski kodla uyumlu, güvenli (0036'nın aksine).
--
-- companies.deleted_at — tenant soft-delete (geri alınabilir). HARD-delete (cascade)
-- bilinçli olarak feature DEĞİL + yapısal engelli (audit_logs immutability 0033 +
-- invoices FK restrict). Bkz. lib/superadmin/company-lifecycle.ts.

ALTER TABLE petstockpro.companies ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

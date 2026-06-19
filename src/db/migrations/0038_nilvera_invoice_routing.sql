-- 0038_nilvera_invoice_routing — Nilvera VKN doğrulama + fatura tipi yönlendirme
--
-- ⚠ MANUEL APPLY: 0023+ pattern — _journal.json'a EKLENMEZ.
--    İKİ DB'ye uygulanır: Supabase (prod, MCP apply_migration) + Aiven (lokal dev).
--    (bkz. memory reference_db_migration_access)
--
-- Tamamı additive ADD COLUMN (nullable) — geri uyumlu, veri kaybı yok.

-- 1) companies: müşteri (pet shop) VKN canlı doğrulama sonucu + fatura adresi.
--    vat_no_status: 'efatura' | 'earsiv' | 'invalid' (Nilvera GlobalCompany/Check sonucu).
--    vat_no_title:  GİB'de kayıtlı resmi ünvan (e-Fatura mükellefinde dolu).
--    billing_address: e-Arşiv/e-Fatura CustomerInfo.Address açık adres satırı.
ALTER TABLE "petstockpro"."companies"
  ADD COLUMN IF NOT EXISTS "vat_no_status"      varchar(20),
  ADD COLUMN IF NOT EXISTS "vat_no_title"       text,
  ADD COLUMN IF NOT EXISTS "vat_no_verified_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "billing_address"    text;

-- 2) invoices: kesilen fatura tipi ('efatura' e-Fatura mükellefine | 'earsiv' e-Arşiv).
ALTER TABLE "petstockpro"."invoices"
  ADD COLUMN IF NOT EXISTS "invoice_kind" varchar(16);

-- 0029_paytr_subscription_fields — iyzico → PayTR alanları (Faz 2)
--
-- ⚠ MANUEL APPLY: ALTER TYPE ADD VALUE, Drizzle migrator transaction'ında çalışmaz
--    → _journal.json'a EKLENMEZ. psql / execute_sql ile uygulanır.
--    (0023-0028 ile aynı pattern — bkz. docs/DEPLOYMENT.md §5.2)
--
-- subscriptions tablosu canlıda boş (henüz aktif abonelik yok) → DROP COLUMN güvenli.

-- 1) subscription_status enum'a 'incomplete' ekle (checkout başladı, ödeme onaylanmadı).
--    NOT: Bu ifade kendi başına / ilk çalıştırılmalı (aynı tx'te yeni değer KULLANILMAZ).
ALTER TYPE "petstockpro"."subscription_status" ADD VALUE IF NOT EXISTS 'incomplete';

-- 2) subscriptions: iyzico alanlarını çıkar + PayTR kart-token alanları ekle.
--    iyzico_subscription_ref DROP'u UNIQUE constraint'ini de otomatik kaldırır.
ALTER TABLE "petstockpro"."subscriptions"
  DROP COLUMN IF EXISTS "iyzico_subscription_ref",
  DROP COLUMN IF EXISTS "iyzico_customer_ref",
  ADD COLUMN IF NOT EXISTS "paytr_utoken"          varchar(128),
  ADD COLUMN IF NOT EXISTS "paytr_ctoken"          varchar(190),
  ADD COLUMN IF NOT EXISTS "paytr_card_masked"     varchar(32),
  ADD COLUMN IF NOT EXISTS "paytr_card_brand"      varchar(20),
  ADD COLUMN IF NOT EXISTS "pending_merchant_oid"  varchar(64),
  ADD COLUMN IF NOT EXISTS "payment_retry_count"   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "next_retry_at"         timestamptz;

-- 3) invoices: başarılı ödeme ↔ fatura eşleştirme
ALTER TABLE "petstockpro"."invoices"
  ADD COLUMN IF NOT EXISTS "merchant_oid" varchar(64);

-- 4) Index'ler — callback lookup + idempotency
CREATE INDEX IF NOT EXISTS "idx_subscriptions_pending_oid"
  ON "petstockpro"."subscriptions" ("pending_merchant_oid");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_invoices_merchant_oid"
  ON "petstockpro"."invoices" ("merchant_oid")
  WHERE "merchant_oid" IS NOT NULL;

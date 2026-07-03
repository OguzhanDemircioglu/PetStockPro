-- 0041_subscriptions_pending_upgrade — dönem-içi PRO→PRO+ yükseltmesini iframe ile tamamla
--
-- ⚠ MANUEL APPLY: 0023+ pattern — _journal.json'a EKLENMEZ.
--    İKİ DB'ye uygulanır: Supabase (prod, MCP apply_migration) + Aiven (lokal dev).
--    (bkz. memory reference_db_migration_access)
--
-- Tamamı additive ADD COLUMN (nullable) — geri uyumlu, veri kaybı yok.
--
-- Neden: PRO→PRO+ anlık yükseltme normalde saklı karttan prorated farkı çeker
-- (upgrade-now.ts). Saklı kart YOKSA (PayTR o utoken altında kart saklamamış) kullanıcı
-- kartını PayTR iframe'inde girer; prorated fark iframe'de tahsil edilir, callback döner.
-- Callback'in bu ödemenin bir UPGRADE olduğunu tanıması + prorated tutarı doğrulaması
-- (manipülasyon koruması) için pending_upgrade_* alanları gerekir. Mevcut
-- pending_merchant_oid (yenileme/ilk-checkout) yolundan İZOLE — o yolu hiç etkilemez.
ALTER TABLE "petstockpro"."subscriptions"
  ADD COLUMN IF NOT EXISTS "pending_upgrade_oid"        varchar(64),
  ADD COLUMN IF NOT EXISTS "pending_upgrade_amount_try" numeric(10, 2);

-- Callback lookup: pending_upgrade_oid == merchant_oid
CREATE INDEX IF NOT EXISTS "idx_subscriptions_pending_upgrade_oid"
  ON "petstockpro"."subscriptions" ("pending_upgrade_oid");

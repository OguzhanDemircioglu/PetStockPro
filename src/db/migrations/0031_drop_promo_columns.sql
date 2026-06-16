-- Migration 0031: İlk-100 PRO promosyonu kaldırıldı (2026-06-16)
-- Promo grant (verify-email) + cron + Pano/superadmin UI + lib (first-100.ts) +
-- brevo template'leri silindi. companies tablosundaki promo_* kolonları ve
-- indexleri düşürülür. (Migration 0028 ile eklenmişti.)
--
-- NOT: Bu migration _journal.json'a EKLENMEZ — production'da manuel apply edilir
-- (0023+ deseni). Drop'lar IF EXISTS ile idempotent.

DROP INDEX IF EXISTS "petstockpro"."idx_companies_promo_until";
DROP INDEX IF EXISTS "petstockpro"."idx_companies_promo_slot_unique";

ALTER TABLE "petstockpro"."companies"
  DROP COLUMN IF EXISTS "promo_first_100_eligible",
  DROP COLUMN IF EXISTS "promo_first_100_until",
  DROP COLUMN IF EXISTS "promo_first_100_slot_number",
  DROP COLUMN IF EXISTS "promo_expired_handled_at",
  DROP COLUMN IF EXISTS "promo_reminder_7_sent",
  DROP COLUMN IF EXISTS "promo_reminder_1_sent";

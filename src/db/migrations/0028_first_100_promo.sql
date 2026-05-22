-- Migration 0028: First-100 Promo
-- E-posta verify olan ilk 100 tenant otomatik 3 ay PRO ücretsiz promosyon alır.
-- T+0'da cron plan='PRO' → 'FREE' revert eder. UI banner sadece BAYI_SAHIBI'a.
-- Manuel apply pattern (CLAUDE.md kuralı — _journal'a EKLENMEZ).

ALTER TABLE "petstockpro"."companies"
  ADD COLUMN "promo_first_100_eligible" boolean NOT NULL DEFAULT false,
  ADD COLUMN "promo_first_100_until" timestamp with time zone,
  ADD COLUMN "promo_first_100_slot_number" integer,
  ADD COLUMN "promo_expired_handled_at" timestamp with time zone,
  ADD COLUMN "promo_reminder_7_sent" boolean NOT NULL DEFAULT false,
  ADD COLUMN "promo_reminder_1_sent" boolean NOT NULL DEFAULT false;

-- Slot number unique constraint (audit + integrity — aynı slot iki tenant'a verilemez)
CREATE UNIQUE INDEX "idx_companies_promo_slot_unique"
  ON "petstockpro"."companies" ("promo_first_100_slot_number")
  WHERE "promo_first_100_slot_number" IS NOT NULL;

-- Cron job index: süresi dolan promo'ları hızlı tara (T+0 + T-7 + T-1)
CREATE INDEX "idx_companies_promo_until"
  ON "petstockpro"."companies" ("promo_first_100_until")
  WHERE "promo_first_100_eligible" = true AND "promo_expired_handled_at" IS NULL;

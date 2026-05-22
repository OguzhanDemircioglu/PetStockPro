-- 2026-05-22 Karar A revize — 4 yeni PRO farklılaşması
--
-- Karar A (2026-05-20): tek farklılaşma stok limiti idi → yetersiz görüldü.
-- Yeni Karar A (2026-05-22):
--   - Stok limiti (mevcut, plans master): FREE 50 / PRO 500 / PRO+ ∞
--   - Vitrin limiti (yeni):              FREE 10 / PRO 500 / PRO+ ∞
--   - Şube sayısı (yeni):                FREE 1 / PRO ∞ / PRO+ ∞
--   - Excel ürün import (yeni):          FREE ❌ / PRO ✅ / PRO+ ✅
--   - Gelişmiş raporlar (yeni):          FREE ❌ / PRO ✅ / PRO+ ✅
--
-- Plan-level karşılaştırma `src/lib/constants/plan-limits.ts` canonical.
-- Bu migration sadece companies tablosuna SÜPERADMİN override field'ları
-- ekler (mevcut paralel pattern: temporary_limit_override — fakat product
-- limit için ayrı eklenecek scope dışı).
--
-- DDL — kullanıcı çalıştıracak (memory feedback_sql_user_runs).

-- ─── 1. companies.temporary_vitrin_limit_override ─────────────────────
-- Süperadmin tek tenant için vitrin limit override edebilir (örn FREE
-- müşterisine 20 vitrin → temporary, 14 gün TTL). NULL = override yok.

ALTER TABLE "petstockpro"."companies"
  ADD COLUMN IF NOT EXISTS "temporary_vitrin_limit_override" integer;
--> statement-breakpoint

ALTER TABLE "petstockpro"."companies"
  ADD COLUMN IF NOT EXISTS "temporary_vitrin_limit_override_until" timestamp with time zone;
--> statement-breakpoint

-- ─── 2. companies.temporary_branch_limit_override ─────────────────────
-- Süperadmin tek tenant için şube limit override edebilir.

ALTER TABLE "petstockpro"."companies"
  ADD COLUMN IF NOT EXISTS "temporary_branch_limit_override" integer;
--> statement-breakpoint

ALTER TABLE "petstockpro"."companies"
  ADD COLUMN IF NOT EXISTS "temporary_branch_limit_override_until" timestamp with time zone;

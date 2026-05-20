-- Faz 1 — Observer + Şube state + Yetki sistemi schema
--
-- 3 değişiklik:
--   1. user_role enum: 'SUBE_MUDURU' → 'OBSERVER' rename
--      (Faz 3 BAYI_ADMIN değeri kalıyor — Postgres enum value drop limited.
--       UI'dan kaldırılır, mevcut user yok zaten).
--      idx_users_one_sube_muduru_per_branch partial index DROP (OBSERVER
--      multi-branch viewer, 1-branch-1-müdür constraint anlamsız).
--   2. branch_status enum (active|holiday|inactive) + branches.status column
--      (isActive korunur — geri uyumluluk + sync trigger Faz 4'te).
--   3. user_permissions tablo (per-user permission grant — STAFF granular)
--
-- DDL — kullanıcı çalıştıracak (memory feedback_sql_user_runs).

-- ─── 1. user_role enum güncelleme ─────────────────────────────────

ALTER TYPE "petstockpro"."user_role" RENAME VALUE 'SUBE_MUDURU' TO 'OBSERVER';
--> statement-breakpoint

-- Eski "1 SUBE_MUDURU per branch" partial unique index drop
-- (OBSERVER multi-branch viewer — branch atama YOK)
DROP INDEX IF EXISTS "petstockpro"."idx_users_one_sube_muduru_per_branch";
--> statement-breakpoint

-- ─── 2. branch_status enum + branches.status ──────────────────────

CREATE TYPE "petstockpro"."branch_status" AS ENUM ('active', 'holiday', 'inactive');
--> statement-breakpoint

ALTER TABLE "petstockpro"."branches"
  ADD COLUMN IF NOT EXISTS "status" "petstockpro"."branch_status" NOT NULL DEFAULT 'active';
--> statement-breakpoint

-- Backfill: isActive → status
UPDATE "petstockpro"."branches"
  SET "status" = CASE
    WHEN "is_active" = true THEN 'active'::"petstockpro"."branch_status"
    ELSE 'inactive'::"petstockpro"."branch_status"
  END;
--> statement-breakpoint

-- ─── 3. user_permissions tablo ────────────────────────────────────

CREATE TABLE IF NOT EXISTS "petstockpro"."user_permissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "permission_key" varchar(60) NOT NULL,
  "enabled" boolean NOT NULL DEFAULT false,
  "granted_by_id" uuid,
  "granted_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "user_permissions_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "petstockpro"."users"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "user_permissions_granted_by_id_fk"
    FOREIGN KEY ("granted_by_id") REFERENCES "petstockpro"."users"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "user_permissions_user_key_unique"
    UNIQUE ("user_id", "permission_key")
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_user_permissions_user"
  ON "petstockpro"."user_permissions" ("user_id");
--> statement-breakpoint

-- RLS: backend (service_role/postgres) bypass eder, anon REST default-deny.
ALTER TABLE "petstockpro"."user_permissions" ENABLE ROW LEVEL SECURITY;

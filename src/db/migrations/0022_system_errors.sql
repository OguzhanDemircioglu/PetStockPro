-- PLAN-BETA-PERFORMANCE FAZ 2.B — system_errors tablo (Sentry replacement)
--
-- 90 gün retention (cleanup-old-logs cron Faz 2.A çalıştırır).
-- RLS: backend service-role bypass, anon REST default-deny.
-- Süperadmin /admin/superadmin/errors sayfasından sunulur.
--
-- DDL — kullanıcı çalıştıracak (memory feedback_sql_user_runs).

-- ─── 1. severity enum ─────────────────────────────────────────────

CREATE TYPE "petstockpro"."system_error_severity" AS ENUM (
  'info',
  'warning',
  'error',
  'critical'
);
--> statement-breakpoint

-- ─── 2. system_errors tablo ───────────────────────────────────────

CREATE TABLE "petstockpro"."system_errors" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "error_type"     varchar(80) NOT NULL,
  "message"        text NOT NULL,
  "stack"          text,
  "severity"       "petstockpro"."system_error_severity" NOT NULL DEFAULT 'error',
  "context"        jsonb,

  "company_id"     uuid REFERENCES "petstockpro"."companies"("id") ON DELETE SET NULL,
  "user_id"        uuid REFERENCES "petstockpro"."users"("id") ON DELETE SET NULL,
  "route"          varchar(200),
  "action"         varchar(80),

  "resolved"       boolean NOT NULL DEFAULT false,
  "resolved_at"    timestamptz,
  "resolved_by_id" uuid REFERENCES "petstockpro"."users"("id") ON DELETE SET NULL,
  "alert_sent_at"  timestamptz,

  "created_at"     timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

-- ─── 3. Index'ler ─────────────────────────────────────────────────

CREATE INDEX "idx_system_errors_created_at"
  ON "petstockpro"."system_errors" ("created_at" DESC);
--> statement-breakpoint

CREATE INDEX "idx_system_errors_type_time"
  ON "petstockpro"."system_errors" ("error_type", "created_at" DESC);
--> statement-breakpoint

CREATE INDEX "idx_system_errors_severity_resolved"
  ON "petstockpro"."system_errors" ("severity", "resolved", "created_at" DESC);
--> statement-breakpoint

CREATE INDEX "idx_system_errors_company"
  ON "petstockpro"."system_errors" ("company_id", "created_at" DESC);
--> statement-breakpoint

-- ─── 4. RLS — backend bypass, anon default-deny ───────────────────

ALTER TABLE "petstockpro"."system_errors" ENABLE ROW LEVEL SECURITY;

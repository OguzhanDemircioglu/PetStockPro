ALTER TABLE "petstockpro"."users" ADD COLUMN "two_factor_secret" text;--> statement-breakpoint
ALTER TABLE "petstockpro"."users" ADD COLUMN "two_factor_recovery_codes" jsonb;--> statement-breakpoint
ALTER TABLE "petstockpro"."users" ADD COLUMN "two_factor_enabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "petstockpro"."users" ADD COLUMN "two_factor_setup_secret" text;--> statement-breakpoint
ALTER TABLE "petstockpro"."users" ADD COLUMN "two_factor_setup_expires_at" timestamp with time zone;
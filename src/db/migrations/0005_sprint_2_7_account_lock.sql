ALTER TABLE "petstockpro"."users" ADD COLUMN "locked_reason" varchar(50);--> statement-breakpoint
ALTER TABLE "petstockpro"."users" ADD COLUMN "recent_lock_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "petstockpro"."users" ADD COLUMN "last_locked_at" timestamp with time zone;
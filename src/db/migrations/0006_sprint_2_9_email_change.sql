ALTER TABLE "petstockpro"."users" ADD COLUMN "pending_email" varchar(255);--> statement-breakpoint
ALTER TABLE "petstockpro"."users" ADD COLUMN "pending_email_token" varchar(100);--> statement-breakpoint
ALTER TABLE "petstockpro"."users" ADD COLUMN "pending_email_expires_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_users_pending_email_token" ON "petstockpro"."users" USING btree ("pending_email_token");
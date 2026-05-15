ALTER TABLE "petstockpro"."users" ADD COLUMN "password_reset_token" varchar(100);--> statement-breakpoint
ALTER TABLE "petstockpro"."users" ADD COLUMN "password_reset_expires_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_users_password_reset_token" ON "petstockpro"."users" USING btree ("password_reset_token");
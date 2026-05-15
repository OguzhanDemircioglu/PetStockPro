ALTER TABLE "petstockpro"."users" ADD COLUMN "email_verification_token" varchar(100);--> statement-breakpoint
ALTER TABLE "petstockpro"."users" ADD COLUMN "email_verification_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "petstockpro"."users" ADD COLUMN "email_verification_resend_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "petstockpro"."users" ADD COLUMN "email_verification_last_sent_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_users_verification_token" ON "petstockpro"."users" USING btree ("email_verification_token");
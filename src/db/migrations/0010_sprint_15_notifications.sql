CREATE TYPE "petstockpro"."notification_type" AS ENUM('low_stock_critical', 'out_of_stock', 'high_sale', 'new_user', 'plan_limit_warning', 'daily_summary', 'weekly_summary', 'transfer_received', 'stocktake_completed', 'superadmin_session', 'subscription_payment_failed', 'subscription_renewed', 'invoice_issued', 'vitrin_approved', 'vitrin_report_received', 'vitrin_auto_unpublished');--> statement-breakpoint
CREATE TABLE "petstockpro"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid,
	"type" "petstockpro"."notification_type" NOT NULL,
	"channel" varchar(20) DEFAULT 'screen' NOT NULL,
	"content" jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "petstockpro"."notifications" ADD CONSTRAINT "notifications_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "petstockpro"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "petstockpro"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_notifications_company_user" ON "petstockpro"."notifications" USING btree ("company_id","user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_unread" ON "petstockpro"."notifications" USING btree ("company_id","user_id") WHERE "petstockpro"."notifications"."read_at" IS NULL;
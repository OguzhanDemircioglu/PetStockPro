CREATE TYPE "petstockpro"."vitrin_report_reason" AS ENUM('wrong_photo', 'wrong_info', 'spam', 'duplicate', 'inappropriate', 'closed_shop', 'other');--> statement-breakpoint
CREATE TYPE "petstockpro"."vitrin_report_status" AS ENUM('pending', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "petstockpro"."vitrin_report_target_type" AS ENUM('storefront', 'product');--> statement-breakpoint
CREATE TABLE "petstockpro"."vitrin_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"target_type" "petstockpro"."vitrin_report_target_type" NOT NULL,
	"product_id" uuid,
	"reason" "petstockpro"."vitrin_report_reason" NOT NULL,
	"note" text,
	"reporter_ip_hash" varchar(64) NOT NULL,
	"country_code" varchar(2),
	"user_agent" text,
	"status" "petstockpro"."vitrin_report_status" NOT NULL DEFAULT 'pending',
	"resolved_by_id" uuid,
	"resolved_at" timestamp with time zone,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "petstockpro"."vitrin_reports" ADD CONSTRAINT "vitrin_reports_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "petstockpro"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."vitrin_reports" ADD CONSTRAINT "vitrin_reports_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "petstockpro"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."vitrin_reports" ADD CONSTRAINT "vitrin_reports_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "petstockpro"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_vitrin_reports_status" ON "petstockpro"."vitrin_reports" USING btree ("status","created_at" DESC);--> statement-breakpoint
CREATE INDEX "idx_vitrin_reports_company" ON "petstockpro"."vitrin_reports" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_vitrin_reports_target_product" ON "petstockpro"."vitrin_reports" USING btree ("product_id") WHERE "product_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "petstockpro"."vitrin_reports" ENABLE ROW LEVEL SECURITY;

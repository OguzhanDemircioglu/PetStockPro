CREATE TYPE "petstockpro"."invoice_status" AS ENUM('pending', 'issued', 'delivered', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "petstockpro"."subscription_status" AS ENUM('active', 'past_due', 'suspended', 'cancelled', 'expired', 'trialing');--> statement-breakpoint
CREATE TYPE "petstockpro"."superadmin_action_type" AS ENUM('impersonation', 'bypass', 'dbfix', 'system', 'user');--> statement-breakpoint
CREATE TABLE "petstockpro"."audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"user_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50),
	"entity_id" uuid,
	"before_state" jsonb,
	"after_state" jsonb,
	"ip_address" varchar(50),
	"user_agent" text,
	"performed_as_superadmin" boolean DEFAULT false NOT NULL,
	"superadmin_session_id" uuid,
	"superadmin_action_type" "petstockpro"."superadmin_action_type",
	"superadmin_reason" text,
	"superadmin_silent" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petstockpro"."invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"amount_matrah" numeric(10, 2) NOT NULL,
	"vat_amount" numeric(10, 2) NOT NULL,
	"amount_total" numeric(10, 2) NOT NULL,
	"nilvera_invoice_id" varchar(100),
	"nilvera_invoice_number" varchar(50),
	"pdf_url" text,
	"status" "petstockpro"."invoice_status" DEFAULT 'pending' NOT NULL,
	"issued_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petstockpro"."processed_webhooks" (
	"event_id" varchar(200) PRIMARY KEY NOT NULL,
	"source" varchar(30) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "petstockpro"."subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"plan" "petstockpro"."plan" NOT NULL,
	"status" "petstockpro"."subscription_status" DEFAULT 'active' NOT NULL,
	"iyzico_subscription_ref" varchar(100),
	"iyzico_customer_ref" varchar(100),
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"cancelled_at" timestamp with time zone,
	"amount_try" numeric(10, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_iyzico_subscription_ref_unique" UNIQUE("iyzico_subscription_ref")
);
--> statement-breakpoint
ALTER TABLE "petstockpro"."audit_logs" ADD CONSTRAINT "audit_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "petstockpro"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "petstockpro"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."invoices" ADD CONSTRAINT "invoices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "petstockpro"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "petstockpro"."subscriptions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."subscriptions" ADD CONSTRAINT "subscriptions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "petstockpro"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_company_date" ON "petstockpro"."audit_logs" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_user" ON "petstockpro"."audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_action" ON "petstockpro"."audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_superadmin_session" ON "petstockpro"."audit_logs" USING btree ("superadmin_session_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_company_period" ON "petstockpro"."invoices" USING btree ("company_id","period_end");--> statement-breakpoint
CREATE INDEX "idx_invoices_subscription" ON "petstockpro"."invoices" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_status" ON "petstockpro"."invoices" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_invoices_nilvera_id" ON "petstockpro"."invoices" USING btree ("nilvera_invoice_id") WHERE "petstockpro"."invoices"."nilvera_invoice_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_processed_webhooks_processed_at" ON "petstockpro"."processed_webhooks" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX "idx_processed_webhooks_source_type" ON "petstockpro"."processed_webhooks" USING btree ("source","event_type");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_company_status" ON "petstockpro"."subscriptions" USING btree ("company_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_subscription_per_tenant" ON "petstockpro"."subscriptions" USING btree ("company_id") WHERE "petstockpro"."subscriptions"."status" = 'active';--> statement-breakpoint
CREATE INDEX "idx_branches_company" ON "petstockpro"."branches" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_districts_city" ON "petstockpro"."districts" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "idx_users_company" ON "petstockpro"."users" USING btree ("company_id");
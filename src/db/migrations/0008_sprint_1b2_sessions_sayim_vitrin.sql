CREATE TYPE "petstockpro"."stocktake_mode" AS ENUM('full', 'category', 'manual');--> statement-breakpoint
CREATE TYPE "petstockpro"."stocktake_reason" AS ENUM('loss', 'overage', 'wrong_entry', 'expired', 'damage', 'theft', 'other');--> statement-breakpoint
CREATE TYPE "petstockpro"."stocktake_status" AS ENUM('in_progress', 'waiting', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "petstockpro"."vitrin_event_type" AS ENUM('home_view', 'profile_view', 'product_view', 'listing_impression', 'category_view', 'whatsapp_click', 'phone_click', 'telegram_click', 'directions_click', 'search', 'feedback_balloon_shown', 'feedback_submitted', 'feedback_closed_manually', 'feedback_dismissed');--> statement-breakpoint
CREATE TABLE "petstockpro"."sessions" (
	"session_token" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	"ip_address" varchar(50),
	"user_agent" text,
	"device_label" varchar(100),
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petstockpro"."stocktake_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stocktake_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"system_qty" integer NOT NULL,
	"counted_qty" integer,
	"diff" integer,
	"reason" "petstockpro"."stocktake_reason",
	"custom_reason" text,
	"is_skipped" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petstockpro"."stocktakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"mode" "petstockpro"."stocktake_mode" NOT NULL,
	"category_id" uuid,
	"soft_lock" boolean DEFAULT true NOT NULL,
	"status" "petstockpro"."stocktake_status" DEFAULT 'in_progress' NOT NULL,
	"total_items" integer DEFAULT 0 NOT NULL,
	"counted_items" integer DEFAULT 0 NOT NULL,
	"diff_items" integer DEFAULT 0 NOT NULL,
	"value_impact" numeric(12, 2),
	"note" text,
	"started_by_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "petstockpro"."vitrin_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"product_id" uuid,
	"variant_id" uuid,
	"event_type" "petstockpro"."vitrin_event_type" NOT NULL,
	"visitor_ip_hash" varchar(64),
	"visitor_city_id" integer,
	"visitor_country" varchar(2),
	"user_agent" text,
	"referrer_url" text,
	"search_query" text,
	"utm_source" varchar(50),
	"utm_medium" varchar(50),
	"utm_campaign" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "petstockpro"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "petstockpro"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."stocktake_items" ADD CONSTRAINT "stocktake_items_stocktake_id_stocktakes_id_fk" FOREIGN KEY ("stocktake_id") REFERENCES "petstockpro"."stocktakes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."stocktake_items" ADD CONSTRAINT "stocktake_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "petstockpro"."product_variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."stocktakes" ADD CONSTRAINT "stocktakes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "petstockpro"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."stocktakes" ADD CONSTRAINT "stocktakes_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "petstockpro"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."stocktakes" ADD CONSTRAINT "stocktakes_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "petstockpro"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."stocktakes" ADD CONSTRAINT "stocktakes_started_by_id_users_id_fk" FOREIGN KEY ("started_by_id") REFERENCES "petstockpro"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."vitrin_events" ADD CONSTRAINT "vitrin_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "petstockpro"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."vitrin_events" ADD CONSTRAINT "vitrin_events_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "petstockpro"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."vitrin_events" ADD CONSTRAINT "vitrin_events_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "petstockpro"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."vitrin_events" ADD CONSTRAINT "vitrin_events_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "petstockpro"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."vitrin_events" ADD CONSTRAINT "vitrin_events_visitor_city_id_cities_id_fk" FOREIGN KEY ("visitor_city_id") REFERENCES "petstockpro"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_sessions_user" ON "petstockpro"."sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires" ON "petstockpro"."sessions" USING btree ("expires");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_stocktake_items_unique" ON "petstockpro"."stocktake_items" USING btree ("stocktake_id","variant_id");--> statement-breakpoint
CREATE INDEX "idx_stocktake_items_variant" ON "petstockpro"."stocktake_items" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "idx_stocktakes_company_status" ON "petstockpro"."stocktakes" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "idx_stocktakes_branch" ON "petstockpro"."stocktakes" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_vitrin_events_company_date" ON "petstockpro"."vitrin_events" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_vitrin_events_type_date" ON "petstockpro"."vitrin_events" USING btree ("company_id","event_type","created_at");--> statement-breakpoint
CREATE INDEX "idx_vitrin_events_product" ON "petstockpro"."vitrin_events" USING btree ("product_id","created_at") WHERE "petstockpro"."vitrin_events"."product_id" IS NOT NULL;
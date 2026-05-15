CREATE TYPE "petstockpro"."animal_type" AS ENUM('cat', 'dog', 'bird', 'fish', 'rabbit', 'reptile', 'other');--> statement-breakpoint
CREATE TYPE "petstockpro"."movement_subtype" AS ENUM('sale', 'waste', 'gift', 'sample', 'return', 'internal_use', 'other');--> statement-breakpoint
CREATE TYPE "petstockpro"."movement_type" AS ENUM('stock_in', 'stock_out', 'transfer', 'stocktake', 'stocktake_initial');--> statement-breakpoint
CREATE TYPE "petstockpro"."payment_method" AS ENUM('cash', 'card', 'bank_transfer', 'credit');--> statement-breakpoint
CREATE TYPE "petstockpro"."supplier_payment_terms" AS ENUM('cash', 'net_30', 'net_60', 'other');--> statement-breakpoint
CREATE TABLE "petstockpro"."branch_inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"stock_qty" integer DEFAULT 0 NOT NULL,
	"expiry_date" date,
	"lot_number" varchar(100),
	"last_sold_at" timestamp with time zone,
	"last_received_at" timestamp with time zone,
	"total_sold_qty" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petstockpro"."brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"logo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petstockpro"."categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"emoji" varchar(10),
	"display_order" integer DEFAULT 0 NOT NULL,
	"vat_rate" numeric(5, 2),
	"skt_required" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petstockpro"."product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"url" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"alt_text" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petstockpro"."product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"axis_label" varchar(50) DEFAULT 'Boyut' NOT NULL,
	"value_label" varchar(50) NOT NULL,
	"sku" varchar(100) NOT NULL,
	"barcode" varchar(13),
	"cost_price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"sale_price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"threshold" integer DEFAULT 5 NOT NULL,
	"branch_thresholds" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petstockpro"."products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"category_id" uuid,
	"brand_id" uuid,
	"animal_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"admin_note" text,
	"vitrin_published" boolean DEFAULT false NOT NULL,
	"vitrin_published_at" timestamp with time zone,
	"vitrin_published_by_id" uuid,
	"vitrin_auto_unpublished_at" timestamp with time zone,
	"vitrin_auto_unpublished_reason" varchar(50),
	"total_stock_qty" integer DEFAULT 0 NOT NULL,
	"last_supplier_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "petstockpro"."stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"type" "petstockpro"."movement_type" NOT NULL,
	"subtype" "petstockpro"."movement_subtype",
	"quantity" integer NOT NULL,
	"before_qty" integer NOT NULL,
	"after_qty" integer NOT NULL,
	"unit_cost" numeric(10, 2),
	"unit_price" numeric(10, 2),
	"discount_amount" numeric(10, 2),
	"supplier_id" uuid,
	"customer_ref" varchar(100),
	"payment_method" "petstockpro"."payment_method",
	"credit_paid_at" timestamp with time zone,
	"document_no" varchar(100),
	"lot_number" varchar(100),
	"expiry_date" date,
	"reason" text,
	"note" text,
	"transfer_group_id" uuid,
	"transfer_target_branch_id" uuid,
	"reverses_id" uuid,
	"reversed_by_id" uuid,
	"created_by_id" uuid NOT NULL,
	"performed_as_superadmin" boolean DEFAULT false NOT NULL,
	"superadmin_session_id" uuid,
	"ip_address" varchar(50),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petstockpro"."suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"vat_no" varchar(20),
	"vat_office" varchar(100),
	"contact_name" varchar(100),
	"phone" varchar(20),
	"email" varchar(255),
	"city" varchar(100),
	"district" varchar(100),
	"address_line" text,
	"lead_time_days" integer DEFAULT 7 NOT NULL,
	"payment_terms" "petstockpro"."supplier_payment_terms" DEFAULT 'net_30' NOT NULL,
	"iban" varchar(34),
	"is_active" boolean DEFAULT true NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "petstockpro"."branch_inventory" ADD CONSTRAINT "branch_inventory_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "petstockpro"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."branch_inventory" ADD CONSTRAINT "branch_inventory_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "petstockpro"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."branch_inventory" ADD CONSTRAINT "branch_inventory_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "petstockpro"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."brands" ADD CONSTRAINT "brands_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "petstockpro"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."categories" ADD CONSTRAINT "categories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "petstockpro"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "petstockpro"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."product_variants" ADD CONSTRAINT "product_variants_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "petstockpro"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "petstockpro"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."products" ADD CONSTRAINT "products_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "petstockpro"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "petstockpro"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "petstockpro"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."products" ADD CONSTRAINT "products_vitrin_published_by_id_users_id_fk" FOREIGN KEY ("vitrin_published_by_id") REFERENCES "petstockpro"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."products" ADD CONSTRAINT "products_last_supplier_id_suppliers_id_fk" FOREIGN KEY ("last_supplier_id") REFERENCES "petstockpro"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."stock_movements" ADD CONSTRAINT "stock_movements_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "petstockpro"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."stock_movements" ADD CONSTRAINT "stock_movements_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "petstockpro"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."stock_movements" ADD CONSTRAINT "stock_movements_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "petstockpro"."product_variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."stock_movements" ADD CONSTRAINT "stock_movements_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "petstockpro"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."stock_movements" ADD CONSTRAINT "stock_movements_transfer_target_branch_id_branches_id_fk" FOREIGN KEY ("transfer_target_branch_id") REFERENCES "petstockpro"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."stock_movements" ADD CONSTRAINT "stock_movements_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "petstockpro"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."suppliers" ADD CONSTRAINT "suppliers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "petstockpro"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_branch_inventory_unique" ON "petstockpro"."branch_inventory" USING btree ("branch_id","variant_id");--> statement-breakpoint
CREATE INDEX "idx_branch_inventory_company" ON "petstockpro"."branch_inventory" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_branch_inventory_low" ON "petstockpro"."branch_inventory" USING btree ("branch_id","stock_qty");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_brands_company_slug" ON "petstockpro"."brands" USING btree ("company_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_categories_company_slug" ON "petstockpro"."categories" USING btree ("company_id","slug");--> statement-breakpoint
CREATE INDEX "idx_categories_parent" ON "petstockpro"."categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_product_images_product" ON "petstockpro"."product_images" USING btree ("product_id","display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_variants_company_sku" ON "petstockpro"."product_variants" USING btree ("company_id","sku");--> statement-breakpoint
CREATE INDEX "idx_variants_product" ON "petstockpro"."product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_variants_barcode" ON "petstockpro"."product_variants" USING btree ("barcode");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_products_company_slug" ON "petstockpro"."products" USING btree ("company_id","slug");--> statement-breakpoint
CREATE INDEX "idx_products_company_active" ON "petstockpro"."products" USING btree ("company_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_products_category" ON "petstockpro"."products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_products_brand" ON "petstockpro"."products" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "idx_products_vitrin" ON "petstockpro"."products" USING btree ("company_id","vitrin_published") WHERE "petstockpro"."products"."vitrin_published" = true;--> statement-breakpoint
CREATE INDEX "idx_stock_movements_company_date" ON "petstockpro"."stock_movements" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_stock_movements_branch_date" ON "petstockpro"."stock_movements" USING btree ("branch_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_stock_movements_variant" ON "petstockpro"."stock_movements" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "idx_stock_movements_transfer_group" ON "petstockpro"."stock_movements" USING btree ("transfer_group_id");--> statement-breakpoint
CREATE INDEX "idx_stock_movements_supplier" ON "petstockpro"."stock_movements" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_stock_movements_type" ON "petstockpro"."stock_movements" USING btree ("type","subtype");--> statement-breakpoint
CREATE INDEX "idx_suppliers_company" ON "petstockpro"."suppliers" USING btree ("company_id");
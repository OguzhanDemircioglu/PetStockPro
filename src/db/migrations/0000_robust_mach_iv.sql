CREATE SCHEMA IF NOT EXISTS "petstockpro";
--> statement-breakpoint
CREATE TYPE "petstockpro"."plan" AS ENUM('FREE', 'PRO', 'PRO_PLUS');--> statement-breakpoint
CREATE TYPE "petstockpro"."storefront_status" AS ENUM('disabled', 'pending', 'approved', 'rejected', 'auto_suspended');--> statement-breakpoint
CREATE TYPE "petstockpro"."user_invite_method" AS ENUM('email', 'link');--> statement-breakpoint
CREATE TYPE "petstockpro"."user_role" AS ENUM('SUPERADMIN', 'BAYI_SAHIBI', 'SUBE_MUDURU', 'STAFF', 'BAYI_ADMIN');--> statement-breakpoint
CREATE TABLE "petstockpro"."branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"city_id" integer,
	"district_id" uuid,
	"address" text,
	"lat" text,
	"lng" text,
	"whatsapp_phone" varchar(20),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petstockpro"."cities" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(50) NOT NULL,
	CONSTRAINT "cities_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "petstockpro"."companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(100) NOT NULL,
	"plan" "petstockpro"."plan" DEFAULT 'FREE' NOT NULL,
	"vat_no" varchar(11),
	"vat_required_at" timestamp with time zone,
	"whatsapp_phone" varchar(20),
	"city_id" integer,
	"district_id" uuid,
	"storefront_status" "petstockpro"."storefront_status" DEFAULT 'disabled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "petstockpro"."districts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" integer NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(50) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petstockpro"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"email" varchar(255) NOT NULL,
	"password_hash" text,
	"email_verified_at" timestamp with time zone,
	"name" text,
	"role" "petstockpro"."user_role" DEFAULT 'STAFF' NOT NULL,
	"invite_method" "petstockpro"."user_invite_method",
	"invited_by_id" uuid,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"locked_until" timestamp with time zone,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"kvkk_consented_at" timestamp with time zone,
	"data_location_consented_at" timestamp with time zone,
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "petstockpro"."branches" ADD CONSTRAINT "branches_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "petstockpro"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."branches" ADD CONSTRAINT "branches_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "petstockpro"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."branches" ADD CONSTRAINT "branches_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "petstockpro"."districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."companies" ADD CONSTRAINT "companies_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "petstockpro"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."companies" ADD CONSTRAINT "companies_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "petstockpro"."districts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."districts" ADD CONSTRAINT "districts_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "petstockpro"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petstockpro"."users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "petstockpro"."companies"("id") ON DELETE no action ON UPDATE no action;
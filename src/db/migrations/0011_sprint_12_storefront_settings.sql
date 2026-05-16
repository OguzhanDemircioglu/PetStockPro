CREATE TABLE "petstockpro"."storefront_settings" (
	"company_id" uuid PRIMARY KEY NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"about_content" text,
	"contact_phone" varchar(20),
	"contact_whatsapp" varchar(20),
	"contact_telegram" varchar(100),
	"contact_email" varchar(255),
	"social_instagram" varchar(100),
	"social_facebook" varchar(100),
	"social_twitter" varchar(100),
	"social_tiktok" varchar(100),
	"meta_description" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "petstockpro"."storefront_settings" ADD CONSTRAINT "storefront_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "petstockpro"."companies"("id") ON DELETE cascade ON UPDATE no action;
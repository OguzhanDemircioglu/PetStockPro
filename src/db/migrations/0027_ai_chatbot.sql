-- Migration 0027: AI Chatbot tabloları (PLAN-AI-CHATBOT.md Faz 3)
-- Yeni: ai_message_role enum + ai_usage + ai_messages tabloları
-- Manuel apply (Drizzle _journal'a EKLENMEZ, baseline pattern — CLAUDE.md kuralı).

CREATE TYPE "petstockpro"."ai_message_role" AS ENUM('user', 'assistant');

CREATE TABLE "petstockpro"."ai_usage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "date" date NOT NULL,
  "message_count" integer DEFAULT 0 NOT NULL,
  "total_input_tokens" integer DEFAULT 0 NOT NULL,
  "total_output_tokens" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ai_usage_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "petstockpro"."companies"("id") ON DELETE CASCADE,
  CONSTRAINT "ai_usage_user_id_users_id_fk"     FOREIGN KEY ("user_id")    REFERENCES "petstockpro"."users"("id")     ON DELETE CASCADE
);

CREATE UNIQUE INDEX "idx_ai_usage_company_user_date"
  ON "petstockpro"."ai_usage" USING btree ("company_id", "user_id", "date");

CREATE TABLE "petstockpro"."ai_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "user_id" uuid,
  "role" "petstockpro"."ai_message_role" NOT NULL,
  "content" text NOT NULL,
  "retrieved_chunk_ids" jsonb,
  "input_tokens" integer,
  "output_tokens" integer,
  "model_used" varchar(100),
  "response_time_ms" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ai_messages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "petstockpro"."companies"("id") ON DELETE CASCADE,
  CONSTRAINT "ai_messages_user_id_users_id_fk"        FOREIGN KEY ("user_id")    REFERENCES "petstockpro"."users"("id")     ON DELETE SET NULL
);

CREATE INDEX "idx_ai_messages_company_date"
  ON "petstockpro"."ai_messages" USING btree ("company_id", "created_at" DESC NULLS LAST);

CREATE INDEX "idx_ai_messages_user_date"
  ON "petstockpro"."ai_messages" USING btree ("user_id", "created_at" DESC NULLS LAST);

-- RLS (postgres user bypass eder, server actions etkilenmez)
ALTER TABLE "petstockpro"."ai_usage"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "petstockpro"."ai_messages" ENABLE ROW LEVEL SECURITY;

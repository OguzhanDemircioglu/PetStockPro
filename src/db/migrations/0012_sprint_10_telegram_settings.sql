-- Sprint 10 — Telegram tenant-level bildirim kanalı
-- companies tablosuna 4 field: bot token + chat id + enabled flag + configured timestamp
-- Bot token plaintext (KMS Faz 2). Token Telegram BotFather'dan alınır, tenant binding kullanıcı tarafından yapılır.

ALTER TABLE "petstockpro"."companies"
  ADD COLUMN "telegram_bot_token" varchar(100),
  ADD COLUMN "telegram_chat_id" varchar(50),
  ADD COLUMN "telegram_enabled" boolean DEFAULT false NOT NULL,
  ADD COLUMN "telegram_configured_at" timestamp with time zone;

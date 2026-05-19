-- Sprint E ext — catalog_seed_products.description kolonu
--
-- Form prefill için TR satış-pazarlama metni (1-2 cümle).
-- Nullable — eski 1.240 seed kayıtlarında null kalır, seed-catalog-table.ts
-- yeniden çalıştırılırsa JSON'daki description'larla UPSERT eder.

ALTER TABLE "petstockpro"."catalog_seed_products"
  ADD COLUMN IF NOT EXISTS "description" text;

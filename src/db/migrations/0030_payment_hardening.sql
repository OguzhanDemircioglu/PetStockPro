-- 0030_payment_hardening — ödeme akışı sağlamlaştırma (plan: precious-popping-mochi)
--
-- ⚠ MANUEL APPLY: 0023-0029 ile aynı pattern → _journal.json'a EKLENMEZ.
--    execute_sql / node-postgres ile her iki DB'ye uygulanır (bkz. docs/DEPLOYMENT.md §5.2).
--    Idempotent (IF NOT EXISTS) — tekrar çalıştırmak güvenli.
--
-- 1) subscriptions.pending_plan: dönem-sonu plan değişimi (PRO↔PRO+).
--    NULL = bekleyen değişiklik yok. Renewal'da çekimden ÖNCE uygulanır (proration yok).
-- 2) invoices.nilvera_retry_count + last_nilvera_error: 'pending' kalan faturanın
--    otomatik mutabakatı (invoice-reconcile cron) için retry takibi.

ALTER TABLE "petstockpro"."subscriptions"
  ADD COLUMN IF NOT EXISTS "pending_plan" "petstockpro"."plan";

ALTER TABLE "petstockpro"."invoices"
  ADD COLUMN IF NOT EXISTS "nilvera_retry_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "last_nilvera_error"  text;

-- 0034_reconcile_index — Faz 3 (docs/PLAN-MIMARI-SAGLAMLASTIRMA-VE-STATE.md §FAZ 3)
--
-- ⚠ MANUEL APPLY: journal'a EKLENMEZ. node-postgres / execute_sql ile iki DB'ye.
--    Idempotent (IF NOT EXISTS).
--
-- Reconcile sorgusu stock_movements'ı (branch_id, variant_id) ile join'ler
-- (GROUP BY per branch+variant). Mevcut index'ler — idx_stock_movements_variant
-- (yalnız variant) ve idx_stock_movements_branch_date (branch+created_at) — bu
-- join'i tam karşılamıyor. Composite index ekler. Küçük veride etkisiz; prod
-- ölçeğinde (çok hareketli tenant) gece reconcile cron'unu hızlandırır.

CREATE INDEX IF NOT EXISTS idx_stock_movements_variant_branch
  ON petstockpro.stock_movements (variant_id, branch_id);

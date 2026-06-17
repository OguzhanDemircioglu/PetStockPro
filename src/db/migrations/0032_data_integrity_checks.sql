-- 0032_data_integrity_checks — Faz 1A (docs/PLAN-MIMARI-SAGLAMLASTIRMA-VE-STATE.md §FAZ 1A)
--
-- ⚠ MANUEL APPLY: 0023-0031 ile aynı pattern → _journal.json'a EKLENMEZ.
--    execute_sql / node-postgres ile her iki DB'ye (Supabase + Aiven) uygulanır.
--    Idempotent (pg_constraint guard) — tekrar çalıştırmak güvenli.
--
-- Amaç: Şema yorumlarının "DB CHECK Sprint 4" diye vaat ettiği ama hiç eklenmemiş
--       invariant'ları GERÇEK DB-seviyesi constraint'e çevir. Artık tek Zod yolu
--       dışındaki her insert (script, süperadmin DB-fix, gelecek action) de korunur.
--
-- Ön-tarama (2026-06-17): 4 ihlal sorgusu da 0 döndü → güvenle eklenebilir.

-- 1) Veresiye satışta müşteri zorunlu (payment_method='credit' → customer_ref NOT NULL)
--    IS DISTINCT FROM ile NULL payment_method temiz geçer (sadece 'credit' kısıtlanır).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sm_credit_requires_customer') THEN
    ALTER TABLE petstockpro.stock_movements
      ADD CONSTRAINT chk_sm_credit_requires_customer
      CHECK (payment_method IS DISTINCT FROM 'credit' OR customer_ref IS NOT NULL);
  END IF;
END $$;

-- 2) Stok eksiye düşemez
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_bi_stock_qty_nonneg') THEN
    ALTER TABLE petstockpro.branch_inventory
      ADD CONSTRAINT chk_bi_stock_qty_nonneg CHECK (stock_qty >= 0);
  END IF;
END $$;

-- 3) Variant fiyatları negatif olamaz
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_pv_prices_nonneg') THEN
    ALTER TABLE petstockpro.product_variants
      ADD CONSTRAINT chk_pv_prices_nonneg CHECK (cost_price >= 0 AND sale_price >= 0);
  END IF;
END $$;

-- 4) Hareket para alanları negatif olamaz (NULL serbest)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sm_money_nonneg') THEN
    ALTER TABLE petstockpro.stock_movements
      ADD CONSTRAINT chk_sm_money_nonneg
      CHECK ((unit_cost IS NULL OR unit_cost >= 0)
         AND (unit_price IS NULL OR unit_price >= 0)
         AND (discount_amount IS NULL OR discount_amount >= 0));
  END IF;
END $$;

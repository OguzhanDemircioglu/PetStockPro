-- 0033_ledger_immutability — Faz 1B (docs/PLAN-MIMARI-SAGLAMLASTIRMA-VE-STATE.md §FAZ 1B)
--
-- ⚠ MANUEL APPLY: journal'a EKLENMEZ. node-postgres / execute_sql ile iki DB'ye.
--    Idempotent (CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS).
--
-- "Immutable ledger" niyetini GERÇEK DB zorlamasına çevirir. Önceden immutability
-- yalnız helper'ların update/delete export etmemesiyle sağlanıyordu (psql / süperadmin
-- / gelecek bir bug bypass edebilirdi). Artık DB seviyesinde garanti.
--
-- stock_movements MEŞRU UPDATE yolları (kod taraması 2026-06-17):
--   reversed_by_id  → reversal pointer (lib/stock/movements.ts)
--   credit_paid_at  → veresiye kapama (lib/reports/open-credits.ts)
--   reason/note/customer_ref/document_no → süperadmin metadata-fix (lib/superadmin/metadata-fix.ts)
-- ÇEKİRDEK kolonlar (quantity/before_qty/after_qty/type/subtype/branch_id/variant_id/
--   company_id/created_at/unit_cost/unit_price/discount_amount/transfer*) DEĞİŞTİRİLEMEZ.
-- audit_logs: hiçbir UPDATE/DELETE yolu yok → tamamen immutable.

-- ── stock_movements: DELETE yasak; UPDATE yalnız izinli metadata/state kolonlarında
CREATE OR REPLACE FUNCTION petstockpro.stock_movements_immutable()
RETURNS trigger AS $$
DECLARE
  allowed text[] := ARRAY['reversed_by_id','credit_paid_at','reason','note','customer_ref','document_no'];
  new_core jsonb := to_jsonb(NEW);
  old_core jsonb := to_jsonb(OLD);
  k text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'stock_movements append-only: DELETE yasak (id=%)', OLD.id;
  END IF;
  FOREACH k IN ARRAY allowed LOOP
    new_core := new_core - k;
    old_core := old_core - k;
  END LOOP;
  IF new_core IS DISTINCT FROM old_core THEN
    RAISE EXCEPTION 'stock_movements immutable: cekirdek ledger kolonu degistirilemez (id=%)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_movements_immutable ON petstockpro.stock_movements;
CREATE TRIGGER trg_stock_movements_immutable
  BEFORE UPDATE OR DELETE ON petstockpro.stock_movements
  FOR EACH ROW EXECUTE FUNCTION petstockpro.stock_movements_immutable();

-- ── audit_logs: UPDATE + DELETE tamamen yasak (append-only)
CREATE OR REPLACE FUNCTION petstockpro.audit_logs_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs append-only: % yasak (id=%)', TG_OP, OLD.id;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON petstockpro.audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON petstockpro.audit_logs
  FOR EACH ROW EXECUTE FUNCTION petstockpro.audit_logs_immutable();

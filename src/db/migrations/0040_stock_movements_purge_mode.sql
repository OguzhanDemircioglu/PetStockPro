-- 0040_stock_movements_purge_mode — hesap silme (account purge) istisnası
--
-- ⚠ MANUEL APPLY: journal'a EKLENMEZ. node-postgres / execute_sql ile İKİ DB'ye.
--    İdempotent (CREATE OR REPLACE FUNCTION). Trigger'ın kendisi 0033'te tanımlı,
--    burada yalnız fonksiyon gövdesi güncellenir.
--
-- 0033 "değişmez defter" garantisini KORUR ama TEK istisna açar: hesap silme purge'ü.
-- deleteOwnAccount transaction'ı `SET LOCAL app.purge_mode = 'on'` ile o tenant'ın
-- stock_movements satırlarının silinmesine izin verir (operasyonel veri fiziksel purge).
-- SET LOCAL transaction-scoped → tx commit/rollback'te otomatik sıfırlanır; başka hiçbir
-- yol (psql/süperadmin/bug) DELETE yapamaz. audit_logs trigger'ı DEĞİŞMEZ (audit korunur).

CREATE OR REPLACE FUNCTION petstockpro.stock_movements_immutable()
RETURNS trigger AS $$
DECLARE
  allowed text[] := ARRAY['reversed_by_id','credit_paid_at','reason','note','customer_ref','document_no'];
  new_core jsonb;
  old_core jsonb;
  k text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Hesap silme purge'ü: yalnız deleteOwnAccount tx'i bu GUC'u açar.
    IF current_setting('app.purge_mode', true) = 'on' THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'stock_movements append-only: DELETE yasak (id=%)', OLD.id;
  END IF;
  new_core := to_jsonb(NEW);
  old_core := to_jsonb(OLD);
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

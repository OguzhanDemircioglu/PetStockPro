-- 0036_branches_isactive_generated — Faz 5A (docs/PLAN-MIMARI-SAGLAMLASTIRMA-VE-STATE.md §FAZ 5A)
--
-- ⚠ MANUEL APPLY: journal'a EKLENMEZ. node-postgres / execute_sql ile İKİ DB'ye (Supabase + Aiven).
-- ⚠ SIRA: ÖNCE bu commit'in kodunu DEPLOY et (is_active yazmayı bırakan), SONRA migration'ı
--    uygula. Aksi halde eski kod (is_active yazan) generated kolona yazmaya çalışıp 500 verir.
--    (Eski 0032-0034 additive'di, sıra önemsizdi; bu DROP COLUMN olduğu için sıra ZORUNLU.)
--
-- branches.is_active'i `status`'tan TÜRETİLEN generated stored column'a çevirir →
-- TEK KAYNAK status, drift YAPISAL OLARAK imkansız (ayrıca yazılamaz). Okuyucular
-- (liste/filtre/export) değişmeden çalışır.
--
-- Kayıpsız: is_active mevcut veride status ile zaten sync (setBranchStatus). Eski
-- setBranchActive yalnız is_active yazıp status'u bırakarak DRIFT üretebiliyordu —
-- bu migration o sınıf bug'ı kapatır (artık is_active yazılamaz).

-- ÖN-KONTROL (uygulamadan önce — beklenen 0; >0 ise status otorite alınır):
--   SELECT count(*) FROM petstockpro.branches WHERE is_active <> (status <> 'inactive');

ALTER TABLE petstockpro.branches DROP COLUMN is_active;
ALTER TABLE petstockpro.branches
  ADD COLUMN is_active boolean
  GENERATED ALWAYS AS (status <> 'inactive') STORED NOT NULL;

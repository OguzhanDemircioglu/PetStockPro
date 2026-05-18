-- Eski flat 16 default kategorisi olan tenant'ları (veya hiç kategori olmayanları)
-- yeni 49 hiyerarşik default yapısına (6 root + 43 child) geçirir.
--
-- Güvenlik kuralı: sadece şu koşullara uyan tenant'lara dokunur:
--   1. child_count = 0 (hiç parentId varlığı yok — eski flat veya boş)
--   2. Hiç kategorize ürünü yok (products.category_id IS NOT NULL AND deleted_at IS NULL = 0)
--
-- 2. koşulu sağlamayan tenant'lara (ör. ürünleri kategorili olanlar) dokunulmaz —
-- SUPERADMIN /admin/categories üzerinden manuel "Default kategorilere sıfırla"
-- butonuyla bilinçli olarak sıfırlayabilir (ürünler kategorisiz kalır).
--
-- 49 kategori list source-of-truth: src/lib/catalog/default-categories.ts

CREATE OR REPLACE FUNCTION petstockpro._reseed_default_categories(p_company_id UUID)
RETURNS VOID AS $$
DECLARE
  root_kedi UUID;
  root_kopek UUID;
  root_kus UUID;
  root_akvaryum UUID;
  root_kemirgen UUID;
  root_surungenler UUID;
BEGIN
  -- 1. Mevcut kategorileri sil (FK ON DELETE SET NULL → ürün category_id NULL olur,
  --    ama caller bu fonksiyonu sadece kategorize ürünü olmayan tenant'a çağırmalı).
  DELETE FROM petstockpro.categories WHERE company_id = p_company_id;

  -- 2. 6 root insert + RETURNING ile id capture
  INSERT INTO petstockpro.categories (company_id, parent_id, name, slug, emoji, display_order, skt_required)
  VALUES (p_company_id, NULL, 'Kedi', 'kedi', '🐱', 1, false) RETURNING id INTO root_kedi;

  INSERT INTO petstockpro.categories (company_id, parent_id, name, slug, emoji, display_order, skt_required)
  VALUES (p_company_id, NULL, 'Köpek', 'kopek', '🐶', 2, false) RETURNING id INTO root_kopek;

  INSERT INTO petstockpro.categories (company_id, parent_id, name, slug, emoji, display_order, skt_required)
  VALUES (p_company_id, NULL, 'Kuş', 'kus', '🐦', 3, false) RETURNING id INTO root_kus;

  INSERT INTO petstockpro.categories (company_id, parent_id, name, slug, emoji, display_order, skt_required)
  VALUES (p_company_id, NULL, 'Akvaryum', 'akvaryum', '🐟', 4, false) RETURNING id INTO root_akvaryum;

  INSERT INTO petstockpro.categories (company_id, parent_id, name, slug, emoji, display_order, skt_required)
  VALUES (p_company_id, NULL, 'Kemirgen', 'kemirgen', '🐹', 5, false) RETURNING id INTO root_kemirgen;

  INSERT INTO petstockpro.categories (company_id, parent_id, name, slug, emoji, display_order, skt_required)
  VALUES (p_company_id, NULL, 'Sürüngen', 'surungenler', '🦎', 6, false) RETURNING id INTO root_surungenler;

  -- 3. 43 child insert — tek toplu INSERT
  INSERT INTO petstockpro.categories (company_id, parent_id, name, slug, emoji, display_order, skt_required) VALUES
    -- Kedi alt kategorileri (10)
    (p_company_id, root_kedi, 'Kuru Mamalar', 'kedi-kuru-mamalar', '🥩', 1, true),
    (p_company_id, root_kedi, 'Yaş Mamalar', 'kedi-yas-mamalar', '🥫', 2, true),
    (p_company_id, root_kedi, 'Ödüller', 'kedi-oduller', '🍬', 3, true),
    (p_company_id, root_kedi, 'Mama ve Su Kapları', 'kedi-mama-ve-su-kaplari', '🍽️', 4, false),
    (p_company_id, root_kedi, 'Kumlar', 'kedi-kumlar', '🪣', 5, false),
    (p_company_id, root_kedi, 'Oyuncaklar', 'kedi-oyuncaklar', '🎾', 6, false),
    (p_company_id, root_kedi, 'Tasmalar', 'kedi-tasmalar', '📿', 7, false),
    (p_company_id, root_kedi, 'Yatak ve Yuvalar', 'kedi-yatak-ve-yuvalar', '🛏️', 8, false),
    (p_company_id, root_kedi, 'Bakım Ürünleri', 'kedi-bakim-urunleri', '🚿', 9, false),
    (p_company_id, root_kedi, 'Vitamin ve Katkıları', 'kedi-vitamin-ve-katkilari', '💊', 10, true),

    -- Köpek alt kategorileri (11)
    (p_company_id, root_kopek, 'Kuru Mamalar', 'kopek-kuru-mamalar', '🥓', 1, true),
    (p_company_id, root_kopek, 'Yaş Mamalar', 'kopek-yas-mamalar', '🍖', 2, true),
    (p_company_id, root_kopek, 'Ödüller', 'kopek-oduller', '🍪', 3, true),
    (p_company_id, root_kopek, 'Mama ve Su Kapları', 'kopek-mama-ve-su-kaplari', '🥣', 4, false),
    (p_company_id, root_kopek, 'Oyuncaklar', 'kopek-oyuncaklar', '🦴', 5, false),
    (p_company_id, root_kopek, 'Tasmalar', 'kopek-tasmalar', '🦮', 6, false),
    (p_company_id, root_kopek, 'Gezdirme Ürünleri', 'kopek-gezdirme-urunleri', '🚶', 7, false),
    (p_company_id, root_kopek, 'Yataklar', 'kopek-yataklar', '🛌', 8, false),
    (p_company_id, root_kopek, 'Aksesuarlar', 'kopek-aksesuarlar', '🎒', 9, false),
    (p_company_id, root_kopek, 'Vitaminler', 'kopek-vitaminler', '💉', 10, true),
    (p_company_id, root_kopek, 'Bakım Ürünleri', 'kopek-bakim-urunleri', '🧼', 11, false),

    -- Kuş alt kategorileri (6)
    (p_company_id, root_kus, 'Yemler', 'kus-yemler', '🌾', 1, true),
    (p_company_id, root_kus, 'Krakerler', 'kus-krakerler', '🍘', 2, true),
    (p_company_id, root_kus, 'Kumlar', 'kus-kumlar', '🏝️', 3, false),
    (p_company_id, root_kus, 'Kafesler', 'kus-kafesler', '🏠', 4, false),
    (p_company_id, root_kus, 'Oyuncaklar', 'kus-oyuncaklar', '🪀', 5, false),
    (p_company_id, root_kus, 'Aksesuarlar', 'kus-aksesuarlar', '🪶', 6, false),

    -- Akvaryum alt kategorileri (9)
    (p_company_id, root_akvaryum, 'Balık Yemi', 'akvaryum-balik-yemi', '🍱', 1, true),
    (p_company_id, root_akvaryum, 'Balık Vitamin & Mineral', 'akvaryum-balik-vitamin-mineral', '🧴', 2, true),
    (p_company_id, root_akvaryum, 'Akvaryum ve Fanus', 'akvaryum-ve-fanus', '🏺', 3, false),
    (p_company_id, root_akvaryum, 'Su Düzenleyiciler', 'akvaryum-su-duzenleyiciler', '🧪', 4, false),
    (p_company_id, root_akvaryum, 'Bakım & Temizlik', 'akvaryum-bakim-temizlik', '🧹', 5, false),
    (p_company_id, root_akvaryum, 'Aydınlatma', 'akvaryum-aydinlatma', '💡', 6, false),
    (p_company_id, root_akvaryum, 'Ekipman & Aksesuarlar', 'akvaryum-ekipman-aksesuarlar', '⚙️', 7, false),
    (p_company_id, root_akvaryum, 'Filtreler', 'akvaryum-filtreler', '🔄', 8, false),
    (p_company_id, root_akvaryum, 'Isıtma & Soğutma', 'akvaryum-isitma-sogutma', '🌡️', 9, false),

    -- Kemirgen alt kategorileri (4)
    (p_company_id, root_kemirgen, 'Yemler', 'kemirgen-yemler', '🥜', 1, true),
    (p_company_id, root_kemirgen, 'Kafesler', 'kemirgen-kafesler', '🏡', 2, false),
    (p_company_id, root_kemirgen, 'Oyuncaklar', 'kemirgen-oyuncaklar', '🪅', 3, false),
    (p_company_id, root_kemirgen, 'Bakım & Sağlık', 'kemirgen-bakim-saglik', '🧽', 4, false),

    -- Sürüngen alt kategorileri (3)
    (p_company_id, root_surungenler, 'Sürüngen Yemi', 'surungenler-yemi', '🍃', 1, true),
    (p_company_id, root_surungenler, 'Aksesuarlar', 'surungenler-aksesuarlar', '👜', 2, false),
    (p_company_id, root_surungenler, 'Taban Malzemeleri', 'surungenler-taban-malzemeleri', '🪵', 3, false);
END;
$$ LANGUAGE plpgsql;


-- Hedef tenant'lara fonksiyonu çağır
DO $$
DECLARE
  t UUID;
  processed INT := 0;
BEGIN
  FOR t IN
    SELECT c.id
    FROM petstockpro.companies c
    WHERE
      -- child_count = 0 → ya boş ya da eski flat
      NOT EXISTS (
        SELECT 1 FROM petstockpro.categories cat
        WHERE cat.company_id = c.id AND cat.parent_id IS NOT NULL
      )
      -- ve hiç kategorize ürünü yok
      AND NOT EXISTS (
        SELECT 1 FROM petstockpro.products p
        WHERE p.company_id = c.id
          AND p.category_id IS NOT NULL
          AND p.deleted_at IS NULL
      )
  LOOP
    PERFORM petstockpro._reseed_default_categories(t);
    processed := processed + 1;
  END LOOP;
  RAISE NOTICE 'Reseeded % tenant(s) with 49 hierarchical default categories', processed;
END $$;


-- Cleanup — temp helper function migration sonrası kalmasın
DROP FUNCTION petstockpro._reseed_default_categories(UUID);

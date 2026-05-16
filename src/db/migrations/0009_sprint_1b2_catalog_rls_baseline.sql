-- Sprint 1B.2 — Katalog RLS baseline
-- Sprint 1B.1 (migration 0007) katalog tablolarını RLS=DISABLED bıraktı.
-- Pattern: tüm tablolarda RLS ENABLED, server-side postgres user bypass eder,
-- anon REST role default-deny. Public read için policy ileride (Sprint 12 vitrin'de).
ALTER TABLE "petstockpro"."products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "petstockpro"."product_variants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "petstockpro"."product_images" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "petstockpro"."branch_inventory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "petstockpro"."stock_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "petstockpro"."categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "petstockpro"."brands" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "petstockpro"."suppliers" ENABLE ROW LEVEL SECURITY;

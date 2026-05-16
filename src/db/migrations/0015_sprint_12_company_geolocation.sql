-- Sprint 12 ext (2026-05-17): companies.location_lat / location_lng
-- Faz 2'den çekilen yakınlık sorgusu için lat/lng alanları. PostGIS
-- extension YOK — Postgres native math (haversine SQL helper) yeterli
-- (10K tenant + 81 il bbox scope). 10 hane / 7 ondalık ~1cm precision.
-- Pet shop sahibi Google Maps'ten koordinat kopyalayıp ayarlar
-- sayfasından girer (Faz 3'te map picker).

ALTER TABLE "petstockpro"."companies" ADD COLUMN "location_lat" numeric(10, 7);
--> statement-breakpoint
ALTER TABLE "petstockpro"."companies" ADD COLUMN "location_lng" numeric(10, 7);

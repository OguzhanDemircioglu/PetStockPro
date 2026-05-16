/**
 * Yakınlık sorgusu — Faz 2'den çekilen vitrin UX.
 *
 * Pet shop dizininde "yakınımdaki pet shop'ları göster" filtresi.
 * Browser Geolocation API ile müşterinin lat/lng'si alınır → SSR'da
 * listPublicStorefronts'a radius filter geçirilir → Postgres native
 * haversine ile mesafe hesaplanır + ORDER BY mesafe ASC.
 *
 * PostGIS extension YOK (tek geliştirici sade-tut). Haversine math:
 *   d = 2R · asin(√(sin²((φ2-φ1)/2) + cos(φ1)·cos(φ2)·sin²((λ2-λ1)/2)))
 * R = 6371 km (Dünya yarıçapı).
 *
 * Bbox optimization: önce ±radius/111 derece bounding box ile candidate
 * tenants filtrele (index-friendly), sonra haversine ile gerçek mesafe.
 * 10K tenant'a kadar yeterli; Faz 3'te PostGIS ST_DWithin'e geçiş ~5
 * satır SQL.
 *
 * 2 fonksiyon:
 *   - haversineDistanceKm(lat1, lng1, lat2, lng2): saf TS hesabı, test
 *     ve UI tarafı için.
 *   - locationFilter(lat, lng, radiusKm): companies.location_lat/lng
 *     üzerinden SQL bbox + haversine WHERE clause döndürür (drizzle
 *     `sql` template — listPublicStorefronts'a inject).
 */

import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { companies } from '@/db/schema';

const EARTH_RADIUS_KM = 6371;
const KM_PER_DEGREE_LAT = 111; // approx — TR enlemde geçerli

/**
 * Saf TS haversine — UI/test için. lat/lng derece cinsinden.
 * @returns kilometre cinsinden mesafe (>= 0)
 */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lng1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lng2)
  ) {
    return Number.POSITIVE_INFINITY;
  }
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(a)));
  return EARTH_RADIUS_KM * c;
}

/**
 * companies.location_lat/lng üzerinden SQL bbox + haversine WHERE +
 * distance_km expression.
 *
 * Bbox: ±radius/111 derece — Postgres index-friendly range scan.
 * (TR'de enlem 36-42 arası, 1 derece ≈ 111km — bbox makul yaklaşıklık.)
 *
 * @returns `{ where: SQL, distanceKm: SQL }` — caller WHERE clause'a
 *          ekler + SELECT'e distance_km alanı koyar + ORDER BY için
 *          kullanır.
 */
export function buildLocationFilter(
  lat: number,
  lng: number,
  radiusKm: number,
): { where: SQL; distanceKm: SQL<number> } {
  const latDelta = radiusKm / KM_PER_DEGREE_LAT;
  // Boylam derecesi enleme göre değişir — cos(lat) ile düzelt
  const lngDelta = radiusKm / (KM_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180));

  const where = sql`
    ${companies.locationLat} IS NOT NULL
    AND ${companies.locationLng} IS NOT NULL
    AND ${companies.locationLat} BETWEEN ${lat - latDelta} AND ${lat + latDelta}
    AND ${companies.locationLng} BETWEEN ${lng - lngDelta} AND ${lng + lngDelta}
    AND (
      ${EARTH_RADIUS_KM} * 2 * ASIN(LEAST(1, SQRT(
        POWER(SIN(RADIANS(${companies.locationLat}::float - ${lat}) / 2), 2)
        + COS(RADIANS(${lat})) * COS(RADIANS(${companies.locationLat}::float))
          * POWER(SIN(RADIANS(${companies.locationLng}::float - ${lng}) / 2), 2)
      )))
    ) <= ${radiusKm}
  `;

  const distanceKm = sql<number>`
    ${EARTH_RADIUS_KM} * 2 * ASIN(LEAST(1, SQRT(
      POWER(SIN(RADIANS(${companies.locationLat}::float - ${lat}) / 2), 2)
      + COS(RADIANS(${lat})) * COS(RADIANS(${companies.locationLat}::float))
        * POWER(SIN(RADIANS(${companies.locationLng}::float - ${lng}) / 2), 2)
    )))
  `;

  return { where, distanceKm };
}

/**
 * URL query'sinde lat/lng/r param validation. Geçerli koordinat ve
 * makul radius (1-200 km) gelirse parse, aksi halde null.
 *
 * TR sınırları: lat 35.8-42.1, lng 25.7-44.8 (clamp dışında ise reddet).
 */
export interface ParsedLocationQuery {
  lat: number;
  lng: number;
  radiusKm: number;
}

const MIN_RADIUS_KM = 1;
const MAX_RADIUS_KM = 200;
const DEFAULT_RADIUS_KM = 25;
const TR_LAT_MIN = 35.5;
const TR_LAT_MAX = 42.5;
const TR_LNG_MIN = 25.5;
const TR_LNG_MAX = 45.0;

export function parseLocationQuery(
  latRaw: string | null | undefined,
  lngRaw: string | null | undefined,
  rRaw: string | null | undefined,
): ParsedLocationQuery | null {
  if (!latRaw || !lngRaw) return null;
  const lat = Number.parseFloat(latRaw);
  const lng = Number.parseFloat(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < TR_LAT_MIN || lat > TR_LAT_MAX) return null;
  if (lng < TR_LNG_MIN || lng > TR_LNG_MAX) return null;
  let radiusKm = DEFAULT_RADIUS_KM;
  if (rRaw) {
    const parsed = Number.parseFloat(rRaw);
    if (Number.isFinite(parsed)) {
      radiusKm = Math.max(MIN_RADIUS_KM, Math.min(MAX_RADIUS_KM, parsed));
    }
  }
  return { lat, lng, radiusKm };
}

export {
  EARTH_RADIUS_KM,
  MIN_RADIUS_KM,
  MAX_RADIUS_KM,
  DEFAULT_RADIUS_KM,
  TR_LAT_MIN,
  TR_LAT_MAX,
  TR_LNG_MIN,
  TR_LNG_MAX,
};

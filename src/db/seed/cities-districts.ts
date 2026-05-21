/**
 * Cities + Districts seed helper (Sprint 2.6 reuse).
 *
 * 81 il + ~974 ilçe. Bootstrap (FAZ 1) ve `npm run db:seed` ortak çağırır.
 * Idempotent: cities.id PRIMARY KEY çakışırsa onConflictDoNothing; districts
 * count == beklenen ise skip.
 *
 * Veri kaynağı: `./turkey-locations.ts` (Pet/ legacy).
 */
import { sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { cities, districts } from '@/db/schema';
import { makeSlug } from '@/lib/utils/slug';
import { TURKEY_DISTRICTS } from './turkey-locations';

export interface SeedCitiesResult {
  citiesInserted: number;
  districtsInserted: number;
  skipped: boolean;
}

export async function seedCitiesAndDistricts(
  db: DbClient,
  logger: (msg: string) => void = () => {},
): Promise<SeedCitiesResult> {
  const cityRows = Object.keys(TURKEY_DISTRICTS).map((name, i) => ({
    id: i + 1,
    name,
    slug: makeSlug(name),
  }));

  // Idempotent: cities PK çakışırsa skip.
  await db.insert(cities).values(cityRows).onConflictDoNothing();

  const districtRows: { cityId: number; name: string; slug: string }[] = [];
  Object.entries(TURKEY_DISTRICTS).forEach(([, names], cityIndex) => {
    const cityId = cityIndex + 1;
    for (const name of names) {
      districtRows.push({ cityId, name, slug: makeSlug(name) });
    }
  });

  const existing = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(districts);
  const existingCount = existing[0]?.count ?? 0;

  if (existingCount >= districtRows.length) {
    logger(`[seed:cities] ${cityRows.length} il + ${existingCount} ilçe mevcut — skip`);
    return { citiesInserted: 0, districtsInserted: 0, skipped: true };
  }

  if (existingCount > 0) {
    logger(
      `[seed:cities] ⚠ ${existingCount}/${districtRows.length} ilçe mevcut — eksikleri eklemeden skip (manuel temizle)`,
    );
    return { citiesInserted: 0, districtsInserted: 0, skipped: true };
  }

  const CHUNK = 500;
  for (let i = 0; i < districtRows.length; i += CHUNK) {
    await db.insert(districts).values(districtRows.slice(i, i + CHUNK));
  }
  logger(`[seed:cities] ${cityRows.length} il + ${districtRows.length} ilçe insert`);
  return {
    citiesInserted: cityRows.length,
    districtsInserted: districtRows.length,
    skipped: false,
  };
}

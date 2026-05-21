/**
 * PetStockPro Seed Script — Sprint 2.6
 *
 * Usage: npm run db:seed
 *
 * Idempotent: cities.id PRIMARY KEY çakışırsa skip (onConflictDoNothing).
 * Districts ekstra check yok — ilk seed sonrası tekrar çalıştırılmaz.
 *
 * Veri kaynağı: Pet/ legacy projeden taşındı (`./turkey-locations.ts`).
 * Plaka kodu insertion order ile eşleşir (Adana=1, Adıyaman=2, ..., Düzce=81).
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { DbClient } from '@/lib/db/client';
import { seedCitiesAndDistricts } from './cities-districts';

async function main() {
  console.log('PetStockPro seed — Sprint 2.6 (cities + districts)');

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set');
  }

  const client = postgres(process.env.DATABASE_URL, {
    max: 1,
    prepare: false,
    connection: { search_path: 'petstockpro,public' },
  });
  const db = drizzle(client) as unknown as DbClient;

  try {
    const result = await seedCitiesAndDistricts(db, (m) => console.log(m));
    console.log(
      `✅ Seed tamam — cities=${result.citiesInserted}, districts=${result.districtsInserted}, skipped=${result.skipped}`,
    );
    await client.end();
    process.exit(0);
  } catch (err) {
    await client.end();
    throw err;
  }
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});

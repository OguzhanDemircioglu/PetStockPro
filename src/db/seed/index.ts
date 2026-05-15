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
import { sql } from 'drizzle-orm';
import { cities, districts } from '@/db/schema';
import { makeSlug } from '@/lib/utils/slug';
import { TURKEY_DISTRICTS } from './turkey-locations';

async function main() {
  console.log('🐾 PetStockPro seed — Sprint 2.6 (cities + districts)');

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set');
  }

  const client = postgres(process.env.DATABASE_URL, {
    max: 1,
    prepare: false,
    connection: { search_path: 'petstockpro,public' },
  });
  const db = drizzle(client);

  try {
    // Cities — plaka kodu insertion order ile
    const cityRows = Object.keys(TURKEY_DISTRICTS).map((name, i) => ({
      id: i + 1, // Adana=1, ..., Düzce=81
      name,
      slug: makeSlug(name),
    }));

    // Idempotent insert
    await db.insert(cities).values(cityRows).onConflictDoNothing();
    console.log(`✓ ${cityRows.length} il INSERT (veya already-exists skip)`);

    // Districts — flatten + cityId mapping
    const districtRows: { cityId: number; name: string; slug: string }[] = [];
    Object.entries(TURKEY_DISTRICTS).forEach(([, districtNames], cityIndex) => {
      const cityId = cityIndex + 1;
      for (const name of districtNames) {
        districtRows.push({ cityId, name, slug: makeSlug(name) });
      }
    });

    // Districts'da UUID PK var → her seed çalışmasında dup oluşturmasın diye
    // önce mevcut count'u sor.
    const existingCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(districts);
    const existing = existingCount[0]?.count ?? 0;

    if (existing >= districtRows.length) {
      console.log(`✓ ${existing} ilçe zaten mevcut — skip`);
    } else if (existing > 0) {
      console.log(`⚠ ${existing} ilçe mevcut ama ${districtRows.length} bekleniyor — eksikleri eklemeden skip (manuel temizleme gerek)`);
    } else {
      // Bulk insert — chunk by 500 (PG parameter limit ~32K)
      const CHUNK = 500;
      for (let i = 0; i < districtRows.length; i += CHUNK) {
        await db.insert(districts).values(districtRows.slice(i, i + CHUNK));
      }
      console.log(`✓ ${districtRows.length} ilçe INSERT`);
    }

    console.log('✅ Seed tamam');
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

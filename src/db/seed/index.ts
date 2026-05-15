/**
 * PetStockPro Seed Script
 *
 * Usage: npm run db:seed
 *
 * Sprint 0: placeholder — Sprint 1'de gerçek seed:
 * - cities (81 il)
 * - districts (~970 ilçe)
 * - default_categories (KDV %20 ile)
 *
 * Pet/ projesinden client/src/data/turkeyDistricts.ts dönüştürülecek.
 */

import { db } from '@/lib/db/client';

async function main() {
  console.log('🐾 PetStockPro seed script — Sprint 0 placeholder');
  console.log('   Sprint 1\'de gerçek seed eklenecek (81 il + ~970 ilçe + default categories)');

  // TODO Sprint 1:
  // await db.insert(cities).values(turkeyCitiesData);
  // await db.insert(districts).values(turkeyDistrictsData);
  // await db.insert(categories).values(defaultCategoriesData);

  void db; // suppress unused warning until Sprint 1
  console.log('✅ Seed skipped (placeholder)');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});

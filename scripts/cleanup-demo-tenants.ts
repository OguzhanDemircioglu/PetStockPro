import 'dotenv/config';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
dotenvConfig({ path: resolve(process.cwd(), '.env.local'), override: true });
import { db } from '../src/lib/db/client';
import {
  companies,
  users,
  branches,
  storefrontSettings,
  products,
  productVariants,
  branchInventory,
} from '../src/db/schema';
import { inArray } from 'drizzle-orm';

const SLUGS = ['mavi-pet-istanbul', 'patiland-ankara', 'ege-pet-izmir', 'bursa-yavru-pet', 'akdeniz-petci'];

async function m() {
  const rows = await db
    .select({ id: companies.id })
    .from(companies)
    .where(inArray(companies.slug, SLUGS));
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) {
    console.log('No demo tenants found.');
    process.exit(0);
  }
  console.log(`Deleting cascade for ${ids.length} tenants...`);

  // Order: deepest FK deps first
  await db.delete(branchInventory).where(inArray(branchInventory.companyId, ids));
  await db.delete(productVariants).where(inArray(productVariants.companyId, ids));
  await db.delete(products).where(inArray(products.companyId, ids));
  await db.delete(branches).where(inArray(branches.companyId, ids));
  await db.delete(storefrontSettings).where(inArray(storefrontSettings.companyId, ids));
  await db.delete(users).where(inArray(users.companyId, ids));
  await db.delete(companies).where(inArray(companies.id, ids));

  console.log(`✓ Deleted ${ids.length} demo tenant(s) + all related rows.`);
  process.exit(0);
}
m().catch((e) => {
  console.error(e);
  process.exit(1);
});

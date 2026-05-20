/**
 * Catalog metin alanlarını temizle — HTML entity decode + whitespace normalize.
 *
 * 2 hedef:
 *   1. scripts/data/pet-products-catalog.json (re-seed kaynağı)
 *   2. petstockpro.catalog_seed_products (canlı DB)
 *
 * Idempotent: temiz string'e tekrar uygulansa değişmez.
 *
 * Çalıştırma:
 *   npx tsx scripts/cleanup-catalog-text.ts          # dry-run (sadece sayım)
 *   npx tsx scripts/cleanup-catalog-text.ts --apply  # JSON + DB güncelle
 */

import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import postgres from 'postgres';
import {
  cleanProductTextFields,
} from '../src/lib/utils/text-cleanup';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in .env');
}

const CATALOG_PATH = resolve(process.cwd(), 'scripts/data/pet-products-catalog.json');
const APPLY = process.argv.includes('--apply');

interface PetProduct {
  name: string;
  brand: string;
  categorySlug: string;
  animalType: string;
  weight: string;
  imagePath: string | null;
  description?: string;
}

interface CatalogFile {
  products: PetProduct[];
  [k: string]: unknown;
}

async function cleanJson(): Promise<{ changed: number; total: number }> {
  console.log(`[json] ${APPLY ? 'apply' : 'dry-run'} → ${CATALOG_PATH}`);
  const file = JSON.parse(await readFile(CATALOG_PATH, 'utf8')) as CatalogFile;
  let changed = 0;
  for (const p of file.products) {
    const r = cleanProductTextFields({ name: p.name, description: p.description ?? null });
    if (r.changed) {
      changed++;
      p.name = r.name;
      p.description = r.description ?? undefined;
    }
  }
  if (APPLY && changed > 0) {
    await writeFile(CATALOG_PATH, JSON.stringify(file, null, 2) + '\n', 'utf8');
    console.log(`[json] ✓ wrote ${CATALOG_PATH} (${changed} rows changed)`);
  } else {
    console.log(`[json] ${changed} rows would change (no write — pass --apply)`);
  }
  return { changed, total: file.products.length };
}

async function cleanDb(): Promise<{ changed: number; total: number }> {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
  try {
    const rows = await sql<Array<{ id: number; name: string; description: string | null }>>`
      SELECT id, name, description FROM petstockpro.catalog_seed_products
    `;
    console.log(`[db] ${rows.length} rows fetched`);
    let changed = 0;
    const updates: Array<{ id: number; name: string; description: string | null }> = [];
    for (const row of rows) {
      const r = cleanProductTextFields({ name: row.name, description: row.description });
      if (r.changed) {
        changed++;
        updates.push({ id: row.id, name: r.name, description: r.description });
      }
    }
    if (APPLY && updates.length > 0) {
      for (const u of updates) {
        await sql`
          UPDATE petstockpro.catalog_seed_products
          SET name = ${u.name}, description = ${u.description}
          WHERE id = ${u.id}
        `;
      }
      console.log(`[db] ✓ ${updates.length} rows updated`);
    } else {
      console.log(`[db] ${changed} rows would change (no write — pass --apply)`);
    }
    return { changed, total: rows.length };
  } finally {
    await sql.end();
  }
}

async function main(): Promise<void> {
  const json = await cleanJson();
  const db = await cleanDb();
  console.log('');
  console.log('── Summary ──────────────────────────────');
  console.log(`JSON: ${json.changed} / ${json.total} changed`);
  console.log(`DB:   ${db.changed} / ${db.total} changed`);
  console.log(APPLY ? 'mode: APPLY (writes done)' : 'mode: DRY-RUN (no writes)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

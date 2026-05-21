/**
 * Auto-bootstrap (PLAN-BETA-PERFORMANCE.md FAZ 1)
 *
 * Next.js boot'unda (instrumentation.ts → Node.js runtime) tek seferlik:
 *   1. Pending Drizzle migration'ları apply (_journal.json baz alır)
 *   2. cities + districts seed (boşsa 81 il + 974 ilçe insert)
 *   3. catalog_seed_products seed (boşsa 1.240 ürün insert)
 *
 * Idempotent — aynı boot 2 kez çağrılsa state aynı kalır.
 *
 * Devre dışı: process.env.BOOTSTRAP_SKIP === '1' (production CI/CD migration
 * önceden çalıştırırsa).
 *
 * Re-entrancy guard: paralel boot çağrıları aynı promise'i bekler (Next.js dev
 * server HMR sırasında 2+ kez register çağırabilir).
 */
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';
import { resolve } from 'node:path';
import type { DbClient } from '@/lib/db/client';
import { db } from '@/lib/db/client';
import { cities, catalogSeedProducts } from '@/db/schema';
import { seedCitiesAndDistricts } from '@/db/seed/cities-districts';
import { seedCatalogProducts } from '@/db/seed/catalog-products';

export interface BootstrapReport {
  migrationsRan: boolean;
  citiesSeeded: number;
  districtsSeeded: number;
  citiesSkipped: boolean;
  catalogInserted: number;
  catalogSkipped: boolean;
  elapsedMs: number;
}

export interface BootstrapOptions {
  db?: DbClient;
  migrationsFolder?: string;
  logger?: (msg: string) => void;
  skipMigrations?: boolean;
  skipCatalog?: boolean;
}

let activeRun: Promise<BootstrapReport> | null = null;

export async function runBootstrap(opts: BootstrapOptions = {}): Promise<BootstrapReport> {
  if (activeRun) return activeRun;
  activeRun = doRun(opts).finally(() => {
    activeRun = null;
  });
  return activeRun;
}

async function doRun(opts: BootstrapOptions): Promise<BootstrapReport> {
  const t0 = Date.now();
  const client = opts.db ?? db;
  const log = opts.logger ?? ((msg: string) => console.log(msg));
  const migrationsFolder = opts.migrationsFolder ?? resolve(process.cwd(), 'src/db/migrations');

  let migrationsRan = false;
  if (!opts.skipMigrations) {
    log('[bootstrap] Migrations apply ediliyor...');
    await runPendingMigrations(client, migrationsFolder);
    migrationsRan = true;
  }

  const cityResult = await ensureCitiesAndDistricts(client, log);
  const catalogResult = opts.skipCatalog
    ? { inserted: 0, skipped: true, total: 0 }
    : await ensureCatalogSeedProducts(client, log);

  const elapsedMs = Date.now() - t0;
  const report: BootstrapReport = {
    migrationsRan,
    citiesSeeded: cityResult.citiesInserted,
    districtsSeeded: cityResult.districtsInserted,
    citiesSkipped: cityResult.skipped,
    catalogInserted: catalogResult.inserted,
    catalogSkipped: catalogResult.skipped,
    elapsedMs,
  };
  log(
    `[bootstrap] ✓ tamam (${elapsedMs}ms) — migrations=${migrationsRan}, cities=${cityResult.citiesInserted}, districts=${cityResult.districtsInserted}, catalog=${catalogResult.inserted}`,
  );
  return report;
}

/**
 * Drizzle migrator — `drizzle.__drizzle_migrations` (default schema)
 * üzerinden tag bazlı apply. Zaten uygulanmış migration'lar skip edilir
 * (hash check). drizzle-kit ile ortak history tablosu.
 *
 * NOT: `migrationsSchema` parametresi VERİLMEZ — varsayılan `drizzle` schema'da
 * yaratılan tablo, mevcut `npm run db:migrate` çıktısı ile birebir uyumlu.
 */
export async function runPendingMigrations(
  client: DbClient,
  migrationsFolder: string,
): Promise<void> {
  await migrate(client, { migrationsFolder });
}

export async function ensureCitiesAndDistricts(
  client: DbClient,
  logger: (msg: string) => void = () => {},
) {
  const existing = await client
    .select({ count: sql<number>`count(*)::int` })
    .from(cities);
  const count = existing[0]?.count ?? 0;
  if (count > 0) {
    logger(`[bootstrap] cities=${count} mevcut — seed skip`);
    return { citiesInserted: 0, districtsInserted: 0, skipped: true };
  }
  return seedCitiesAndDistricts(client, logger);
}

export async function ensureCatalogSeedProducts(
  client: DbClient,
  logger: (msg: string) => void = () => {},
) {
  const existing = await client
    .select({ count: sql<number>`count(*)::int` })
    .from(catalogSeedProducts);
  const count = existing[0]?.count ?? 0;
  if (count > 0) {
    logger(`[bootstrap] catalog_seed_products=${count} mevcut — seed skip`);
    return { inserted: 0, skipped: true, total: count };
  }
  return seedCatalogProducts(client, logger);
}

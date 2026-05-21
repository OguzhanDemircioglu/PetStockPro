import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DbClient } from '@/lib/db/client';

vi.mock('@/db/seed/cities-districts', () => ({
  seedCitiesAndDistricts: vi.fn(),
}));
vi.mock('@/db/seed/catalog-products', () => ({
  seedCatalogProducts: vi.fn(),
}));
vi.mock('drizzle-orm/postgres-js/migrator', () => ({
  migrate: vi.fn(),
}));
vi.mock('@/lib/db/client', () => ({
  db: {} as DbClient,
}));

import {
  runBootstrap,
  runPendingMigrations,
  ensureCitiesAndDistricts,
  ensureCatalogSeedProducts,
} from './run';
import { seedCitiesAndDistricts } from '@/db/seed/cities-districts';
import { seedCatalogProducts } from '@/db/seed/catalog-products';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const mockedSeedCities = vi.mocked(seedCitiesAndDistricts);
const mockedSeedCatalog = vi.mocked(seedCatalogProducts);
const mockedMigrate = vi.mocked(migrate);

function mockCountClient(count: number): DbClient {
  const fromMock = vi.fn().mockResolvedValue([{ count }]);
  const selectMock = vi.fn().mockImplementation(() => ({ from: fromMock }));
  return { select: selectMock } as unknown as DbClient;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ensureCitiesAndDistricts', () => {
  it('count > 0 → seed çağrılmaz, skipped=true', async () => {
    const client = mockCountClient(81);
    const result = await ensureCitiesAndDistricts(client);
    expect(result).toEqual({ citiesInserted: 0, districtsInserted: 0, skipped: true });
    expect(mockedSeedCities).not.toHaveBeenCalled();
  });

  it('count === 0 → seedCitiesAndDistricts çağrılır', async () => {
    const client = mockCountClient(0);
    mockedSeedCities.mockResolvedValue({
      citiesInserted: 81,
      districtsInserted: 974,
      skipped: false,
    });
    const result = await ensureCitiesAndDistricts(client);
    expect(mockedSeedCities).toHaveBeenCalledTimes(1);
    expect(result.citiesInserted).toBe(81);
    expect(result.districtsInserted).toBe(974);
  });
});

describe('ensureCatalogSeedProducts', () => {
  it('count > 0 → seed çağrılmaz, skipped=true', async () => {
    const client = mockCountClient(1240);
    const result = await ensureCatalogSeedProducts(client);
    expect(result).toEqual({ inserted: 0, skipped: true, total: 1240 });
    expect(mockedSeedCatalog).not.toHaveBeenCalled();
  });

  it('count === 0 → seedCatalogProducts çağrılır', async () => {
    const client = mockCountClient(0);
    mockedSeedCatalog.mockResolvedValue({ inserted: 1240, skipped: false, total: 1240 });
    const result = await ensureCatalogSeedProducts(client);
    expect(mockedSeedCatalog).toHaveBeenCalledTimes(1);
    expect(result.inserted).toBe(1240);
  });
});

describe('runPendingMigrations', () => {
  it('drizzle migrate folder ile çağrılır (default schema = drizzle)', async () => {
    const client = {} as DbClient;
    await runPendingMigrations(client, '/path/to/migrations');
    expect(mockedMigrate).toHaveBeenCalledTimes(1);
    expect(mockedMigrate).toHaveBeenCalledWith(client, {
      migrationsFolder: '/path/to/migrations',
    });
  });
});

describe('runBootstrap', () => {
  it('skipMigrations + skipCatalog → migration ve catalog skip, cities çalışır', async () => {
    const client = mockCountClient(81); // cities mevcut
    const report = await runBootstrap({
      db: client,
      skipMigrations: true,
      skipCatalog: true,
    });
    expect(report.migrationsRan).toBe(false);
    expect(report.citiesSkipped).toBe(true);
    expect(report.catalogSkipped).toBe(true);
    expect(mockedMigrate).not.toHaveBeenCalled();
    expect(mockedSeedCatalog).not.toHaveBeenCalled();
  });

  it('idempotency — 2. boot aynı state üretir (count > 0 → seed skip)', async () => {
    const client = mockCountClient(81);
    const r1 = await runBootstrap({ db: client, skipMigrations: true, skipCatalog: true });
    const r2 = await runBootstrap({ db: client, skipMigrations: true, skipCatalog: true });
    expect(r1.citiesSeeded).toBe(0);
    expect(r2.citiesSeeded).toBe(0);
    expect(r1.citiesSkipped).toBe(true);
    expect(r2.citiesSkipped).toBe(true);
    expect(mockedSeedCities).not.toHaveBeenCalled();
  });

  it('migration fail → throw + activeRun reset (ikinci çağrı tekrar denenir)', async () => {
    const client = mockCountClient(0);
    mockedMigrate.mockRejectedValueOnce(new Error('migration apply failed'));
    await expect(
      runBootstrap({ db: client, migrationsFolder: '/x' }),
    ).rejects.toThrow('migration apply failed');
    // İkinci çağrı (mock reset değil ama activeRun null'a indi)
    mockedMigrate.mockResolvedValueOnce(undefined as never);
    mockedSeedCities.mockResolvedValue({
      citiesInserted: 81,
      districtsInserted: 974,
      skipped: false,
    });
    mockedSeedCatalog.mockResolvedValue({ inserted: 1240, skipped: false, total: 1240 });
    const r2 = await runBootstrap({ db: client, migrationsFolder: '/x' });
    expect(r2.migrationsRan).toBe(true);
  });
});

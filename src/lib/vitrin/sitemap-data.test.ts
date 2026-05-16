import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { collectSitemapEntries, getPublicBaseUrl } from './sitemap-data';
import type { DbClient } from '@/lib/db/client';

const NOW = new Date('2026-05-17T10:00:00Z');

/** Drizzle 4-query chain (cities/districts/tenants/products) → her select bir kez. */
function makeMockDb(opts: {
  cities?: Array<{ id: number; name: string; slug: string }>;
  districts?: Array<{ citySlug: string; districtSlug: string }>;
  tenants?: Array<{ slug: string; lastModified: Date }>;
  products?: Array<{
    companySlug: string;
    productSlug: string;
    lastModified: Date;
  }>;
  categories?: Array<{ slug: string }>;
}) {
  const responses: unknown[][] = [
    opts.cities ?? [],
    opts.districts ?? [],
    opts.tenants ?? [],
    opts.products ?? [],
    opts.categories ?? [],
  ];
  let i = 0;

  const makeNode = (): {
    from: ReturnType<typeof vi.fn>;
    innerJoin: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
    then: (cb: (rows: unknown[]) => unknown) => Promise<unknown>;
  } => {
    const node: ReturnType<typeof makeNode> = {
      from: vi.fn(() => makeNode()),
      innerJoin: vi.fn(() => makeNode()),
      where: vi.fn(() => makeNode()),
      orderBy: vi.fn(() => {
        const data = responses[i++] ?? [];
        return {
          then: (cb: (rows: unknown[]) => unknown) =>
            Promise.resolve(data).then(cb),
        };
      }),
      then: (cb: (rows: unknown[]) => unknown) =>
        Promise.resolve([]).then(cb),
    };
    return node;
  };

  const select = vi.fn().mockImplementation(() => makeNode());
  const selectDistinct = vi.fn().mockImplementation(() => makeNode());

  return { db: { select, selectDistinct } as unknown as DbClient };
}

describe('collectSitemapEntries', () => {
  it('empty DB → sadece static URLs (/, /vitrin)', async () => {
    const { db } = makeMockDb({});
    const result = await collectSitemapEntries('https://petstockpro.com', db);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      loc: 'https://petstockpro.com/',
      changeFrequency: 'weekly',
      priority: 1.0,
    });
    expect(result[1]).toEqual({
      loc: 'https://petstockpro.com/vitrin',
      changeFrequency: 'daily',
      priority: 0.9,
    });
  });

  it('active city → /vitrin/[slug] entry eklenir', async () => {
    const { db } = makeMockDb({
      cities: [{ id: 35, name: 'İzmir', slug: 'izmir' }],
    });
    const result = await collectSitemapEntries('https://petstockpro.com', db);

    expect(result).toHaveLength(3);
    expect(result[2]).toEqual({
      loc: 'https://petstockpro.com/vitrin/izmir',
      changeFrequency: 'weekly',
      priority: 0.8,
    });
  });

  it('active district → /vitrin/[il]/[ilce] entry', async () => {
    const { db } = makeMockDb({
      cities: [{ id: 35, name: 'İzmir', slug: 'izmir' }],
      districts: [{ citySlug: 'izmir', districtSlug: 'aliaga' }],
    });
    const result = await collectSitemapEntries('https://petstockpro.com', db);

    expect(result).toHaveLength(4);
    expect(result[3].loc).toBe('https://petstockpro.com/vitrin/izmir/aliaga');
    expect(result[3].priority).toBe(0.7);
  });

  it('tenant profil → /vitrin/magaza/[slug] lastModified ile', async () => {
    const { db } = makeMockDb({
      tenants: [{ slug: 'sprint3-pet-shop', lastModified: NOW }],
    });
    const result = await collectSitemapEntries('https://petstockpro.com', db);

    const tenantEntry = result.find((e) =>
      e.loc.includes('/vitrin/magaza/sprint3-pet-shop'),
    );
    expect(tenantEntry).toBeDefined();
    expect(tenantEntry?.lastModified).toEqual(NOW);
    expect(tenantEntry?.priority).toBe(0.7);
  });

  it('vitrin ürün → /vitrin/magaza/[slug]/urun/[productSlug]', async () => {
    const { db } = makeMockDb({
      products: [
        {
          companySlug: 'sprint3-pet-shop',
          productSlug: 'catit-pixi-mama-otomati',
          lastModified: NOW,
        },
      ],
    });
    const result = await collectSitemapEntries('https://petstockpro.com', db);

    const productEntry = result.find((e) => e.loc.includes('/urun/'));
    expect(productEntry).toBeDefined();
    expect(productEntry?.loc).toBe(
      'https://petstockpro.com/vitrin/magaza/sprint3-pet-shop/urun/catit-pixi-mama-otomati',
    );
    expect(productEntry?.priority).toBe(0.6);
  });

  it('full tree — static + city + district + tenant + product + category = 7 entry', async () => {
    const { db } = makeMockDb({
      cities: [{ id: 35, name: 'İzmir', slug: 'izmir' }],
      districts: [{ citySlug: 'izmir', districtSlug: 'aliaga' }],
      tenants: [{ slug: 'pet-shop-1', lastModified: NOW }],
      products: [
        {
          companySlug: 'pet-shop-1',
          productSlug: 'urun-1',
          lastModified: NOW,
        },
      ],
      categories: [{ slug: 'kuru-mama' }],
    });
    const result = await collectSitemapEntries('https://petstockpro.com', db);

    expect(result).toHaveLength(7);
    expect(result.map((e) => e.loc)).toEqual([
      'https://petstockpro.com/',
      'https://petstockpro.com/vitrin',
      'https://petstockpro.com/vitrin/izmir',
      'https://petstockpro.com/vitrin/izmir/aliaga',
      'https://petstockpro.com/vitrin/magaza/pet-shop-1',
      'https://petstockpro.com/vitrin/magaza/pet-shop-1/urun/urun-1',
      'https://petstockpro.com/vitrin/kategori/kuru-mama',
    ]);
  });

  it('kategori — priority 0.7 + changeFreq weekly', async () => {
    const { db } = makeMockDb({
      categories: [{ slug: 'oyuncak' }, { slug: 'kedi-kumu' }],
    });
    const result = await collectSitemapEntries('https://petstockpro.com', db);
    const catEntries = result.filter((e) => e.loc.includes('/vitrin/kategori/'));
    expect(catEntries).toHaveLength(2);
    expect(catEntries[0].priority).toBe(0.7);
    expect(catEntries[0].changeFrequency).toBe('weekly');
    expect(catEntries[0].loc).toBe('https://petstockpro.com/vitrin/kategori/oyuncak');
    expect(catEntries[1].loc).toBe('https://petstockpro.com/vitrin/kategori/kedi-kumu');
  });
});

describe('getPublicBaseUrl', () => {
  let originalSite: string | undefined;
  let originalPublic: string | undefined;

  beforeEach(() => {
    originalSite = process.env.SITE_URL;
    originalPublic = process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  afterEach(() => {
    if (originalSite === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = originalSite;
    if (originalPublic === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = originalPublic;
  });

  it('env yoksa → localhost default', () => {
    expect(getPublicBaseUrl()).toBe('http://localhost:3000');
  });

  it('NEXT_PUBLIC_SITE_URL → trailing slash strip', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://petstockpro.com/';
    expect(getPublicBaseUrl()).toBe('https://petstockpro.com');
  });

  it('SITE_URL fallback (NEXT_PUBLIC yoksa)', () => {
    process.env.SITE_URL = 'https://staging.petstockpro.com';
    expect(getPublicBaseUrl()).toBe('https://staging.petstockpro.com');
  });

  it('NEXT_PUBLIC_SITE_URL öncelikli', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://petstockpro.com';
    process.env.SITE_URL = 'https://staging.petstockpro.com';
    expect(getPublicBaseUrl()).toBe('https://petstockpro.com');
  });
});

import { describe, it, expect, vi } from 'vitest';
import {
  getCrossTenantProduct,
  listCrossTenantProductSlugs,
} from './cross-tenant-product';
import type { DbClient } from '@/lib/db/client';

function makeSelectChain(responses: unknown[][]) {
  let i = 0;
  return vi.fn().mockImplementation(() => {
    const data = responses[i++] ?? [];
    const makeNode = (): {
      from: ReturnType<typeof vi.fn>;
      innerJoin: ReturnType<typeof vi.fn>;
      leftJoin: ReturnType<typeof vi.fn>;
      where: ReturnType<typeof vi.fn>;
      orderBy: ReturnType<typeof vi.fn>;
      groupBy: ReturnType<typeof vi.fn>;
      having: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
      then: (cb: (rows: unknown[]) => unknown) => Promise<unknown>;
    } => {
      const node: ReturnType<typeof makeNode> = {
        from: vi.fn(() => makeNode()),
        innerJoin: vi.fn(() => makeNode()),
        leftJoin: vi.fn(() => makeNode()),
        where: vi.fn(() => makeNode()),
        orderBy: vi.fn(() => makeNode()),
        groupBy: vi.fn(() => makeNode()),
        having: vi.fn(() => makeNode()),
        limit: vi.fn(() => makeNode()),
        then: (cb) => Promise.resolve(data).then(cb),
      };
      return node;
    };
    return makeNode();
  });
}

describe('getCrossTenantProduct', () => {
  it('hiç eşleşme yoksa null', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;
    const result = await getCrossTenantProduct('sahte-urun', db);
    expect(result).toBeNull();
  });

  it('happy — meta + offers döner', async () => {
    const select = makeSelectChain([
      [
        {
          productName: 'Royal Canin Adult Kedi',
          description: 'Yetişkin kediler için kuru mama.',
          brandName: 'Royal Canin',
          categoryName: 'Kuru Mama',
          categorySlug: 'kuru-mama',
        },
      ],
      [
        {
          companyId: 'c1',
          companySlug: 'mavi-pet',
          companyName: 'Mavi Pet',
          cityName: 'İzmir',
          districtName: 'Bornova',
          contactWhatsapp: '+905321111111',
          companyWhatsapp: null,
          productSlug: 'royal-canin-adult-kedi',
          minSalePrice: '450.00',
          maxSalePrice: '850.00',
          variantCount: 2,
          inStockTotal: 12,
        },
        {
          companyId: 'c2',
          companySlug: 'sari-pet',
          companyName: 'Sarı Pet',
          cityName: 'İstanbul',
          districtName: 'Kadıköy',
          contactWhatsapp: null,
          companyWhatsapp: '+905332222222',
          productSlug: 'royal-canin-adult-kedi',
          minSalePrice: '475.00',
          maxSalePrice: '895.00',
          variantCount: 2,
          inStockTotal: 5,
        },
      ],
    ]);
    const db = { select } as unknown as DbClient;
    const result = await getCrossTenantProduct('royal-canin-adult-kedi', db);

    expect(result).not.toBeNull();
    expect(result?.meta).toEqual({
      slug: 'royal-canin-adult-kedi',
      productName: 'Royal Canin Adult Kedi',
      description: 'Yetişkin kediler için kuru mama.',
      brandName: 'Royal Canin',
      categoryName: 'Kuru Mama',
      categorySlug: 'kuru-mama',
    });
    expect(result?.offers).toHaveLength(2);
    expect(result?.offers[0].companyName).toBe('Mavi Pet');
    expect(result?.offers[0].minSalePrice).toBe('450.00');
    expect(result?.offers[1].companyName).toBe('Sarı Pet');
  });

  it('meta found ama offers boş — meta + boş offers (race)', async () => {
    const select = makeSelectChain([
      [
        {
          productName: 'X',
          description: null,
          brandName: null,
          categoryName: null,
          categorySlug: null,
        },
      ],
      [],
    ]);
    const db = { select } as unknown as DbClient;
    const result = await getCrossTenantProduct('x', db);
    expect(result).not.toBeNull();
    expect(result?.offers).toEqual([]);
  });
});

describe('listCrossTenantProductSlugs', () => {
  it('boş — boş array', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;
    const result = await listCrossTenantProductSlugs(db);
    expect(result).toEqual([]);
  });

  it('happy — 2+ tenant\'lı slug\'lar döner (DISTINCT)', async () => {
    const select = makeSelectChain([
      [
        { slug: 'royal-canin-adult-kedi', tenantCount: 3 },
        { slug: 'acana-yetiskin-kopek', tenantCount: 2 },
      ],
    ]);
    const db = { select } as unknown as DbClient;
    const result = await listCrossTenantProductSlugs(db);
    expect(result).toEqual(['royal-canin-adult-kedi', 'acana-yetiskin-kopek']);
  });
});

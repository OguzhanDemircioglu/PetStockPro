import { describe, it, expect } from 'vitest';
import {
  scoreSeedProduct,
  searchSeedCatalog,
  getCatalogMeta,
  type SeedProduct,
} from './seed-catalog';

const sampleProduct = (overrides: Partial<SeedProduct> = {}): SeedProduct => ({
  name: 'Royal Canin Persian 30 Kedi Maması 2 kg',
  brand: 'Royal Canin',
  categorySlug: 'kedi-kuru-mamalar',
  animalType: 'cat',
  weight: '2 kg',
  barcode: '3182550702683',
  imageUrl: 'https://example.com/img.jpg',
  imagePath: 'scripts/data/images/abc.jpg',
  description: 'Test desc',
  sourceUrl: 'https://example.com/source',
  ...overrides,
});

describe('scoreSeedProduct', () => {
  it('boş query için 0', () => {
    expect(scoreSeedProduct(sampleProduct(), '')).toBe(0);
    expect(scoreSeedProduct(sampleProduct(), '   ')).toBe(0);
  });

  it('barkod birebir match → 1000', () => {
    expect(scoreSeedProduct(sampleProduct(), '3182550702683')).toBeGreaterThanOrEqual(1000);
  });

  it('barkod prefix (≥6 hane) → 900', () => {
    const score = scoreSeedProduct(sampleProduct(), '318255');
    expect(score).toBeGreaterThanOrEqual(900);
    expect(score).toBeLessThan(1000);
  });

  it('5 haneli barkod prefix sayılmaz (ad ile match olmazsa 0)', () => {
    expect(scoreSeedProduct(sampleProduct({ barcode: '3182550702683' }), '31825')).toBe(0);
  });

  it('marka birebir → 350', () => {
    expect(scoreSeedProduct(sampleProduct(), 'royal canin')).toBeGreaterThanOrEqual(350);
  });

  it('marka prefix → 300', () => {
    const p = sampleProduct({ brand: 'Royal Canin' });
    const score = scoreSeedProduct(p, 'royal');
    expect(score).toBeGreaterThanOrEqual(300);
  });

  it('ad prefix → 400', () => {
    const p = sampleProduct({ name: 'Catit Pixi Smart Mama Otomatı 5L', brand: 'Catit' });
    const score = scoreSeedProduct(p, 'catit pixi');
    // hem ad prefix (400) hem marka prefix (300) = 700
    expect(score).toBeGreaterThanOrEqual(400);
  });

  it('ad contains → 250 (prefix yok)', () => {
    const p = sampleProduct({ name: 'Royal Canin Persian 30 Kedi Maması', brand: 'Royal Canin' });
    const score = scoreSeedProduct(p, 'persian');
    expect(score).toBeGreaterThanOrEqual(250);
  });

  it('hiç eşleşme yoksa 0', () => {
    expect(scoreSeedProduct(sampleProduct(), 'xyzzz-random')).toBe(0);
  });

  it('multi-kelime bonus: tüm kelimeler match → daha yüksek skor', () => {
    // P1: 3 query kelimesinin hepsi geçer
    const p1 = sampleProduct({ name: 'Foo Bar Baz 5 kg', brand: 'OtherBrand' });
    // P2: sadece 1 kelime geçer
    const p2 = sampleProduct({ name: 'Foo Quux Lorem', brand: 'OtherBrand' });
    const s1 = scoreSeedProduct(p1, 'foo bar baz');
    const s2 = scoreSeedProduct(p2, 'foo bar baz');
    expect(s1).toBeGreaterThan(s2);
  });

  it('case-insensitive', () => {
    expect(scoreSeedProduct(sampleProduct(), 'ROYAL CANIN')).toBeGreaterThan(0);
    expect(scoreSeedProduct(sampleProduct(), 'Royal CANIN')).toBeGreaterThan(0);
  });

  it('null barkodlu ürünler için barkod arama 0', () => {
    const p = sampleProduct({ barcode: null });
    expect(scoreSeedProduct(p, '3182550702683')).toBe(0);
  });
});

// JSON dosyası `.gitignore`'da → CI'da yok. Lokalde varsa integration testler
// çalışır, yoksa atlanır. `getCatalogMeta().productCount > 0` ile koşullu.
const HAS_CATALOG = getCatalogMeta().productCount > 0;

describe.runIf(HAS_CATALOG)('searchSeedCatalog (integration with JSON file)', () => {
  it('boş query → []', () => {
    expect(searchSeedCatalog('')).toEqual([]);
    expect(searchSeedCatalog('   ')).toEqual([]);
  });

  it('"royal canin" → en az 1 sonuç, hepsi Royal Canin markası', () => {
    const results = searchSeedCatalog('royal canin', 10);
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.brand.toLowerCase()).toContain('royal canin');
    }
  });

  it('limit default 8', () => {
    const results = searchSeedCatalog('mama');
    expect(results.length).toBeLessThanOrEqual(8);
  });

  it('limit clamp [1, 20]', () => {
    expect(searchSeedCatalog('mama', 0).length).toBeLessThanOrEqual(1);
    expect(searchSeedCatalog('mama', 100).length).toBeLessThanOrEqual(20);
  });

  it('barkod aramada exact match en üstte', () => {
    // Kataloga göre 3182550702683 → Royal Canin Persian
    const results = searchSeedCatalog('3182550702683');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].barcode).toBe('3182550702683');
  });

  it('score DESC + name ASC sort', () => {
    const results = searchSeedCatalog('royal', 20);
    for (let i = 1; i < results.length; i++) {
      const a = results[i - 1];
      const b = results[i];
      if (a.score === b.score) {
        expect(a.name.localeCompare(b.name, 'tr')).toBeLessThanOrEqual(0);
      } else {
        expect(a.score).toBeGreaterThanOrEqual(b.score);
      }
    }
  });

  it('"persian" → Persian içeren ürünler', () => {
    const results = searchSeedCatalog('persian', 5);
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.name.toLowerCase()).toContain('persian');
    }
  });

  it('"xyzzz" → boş', () => {
    expect(searchSeedCatalog('xyzzz-random-nothing-matches')).toEqual([]);
  });

  it('sonuçlar SeedProduct alanlarını içerir', () => {
    const results = searchSeedCatalog('royal canin', 1);
    expect(results.length).toBe(1);
    const r = results[0];
    expect(r).toHaveProperty('name');
    expect(r).toHaveProperty('brand');
    expect(r).toHaveProperty('categorySlug');
    expect(r).toHaveProperty('animalType');
    expect(r).toHaveProperty('weight');
    expect(r).toHaveProperty('barcode');
    expect(r).toHaveProperty('imageUrl');
    // imagePath JSON'daki yarısında var (opsiyonel)
    expect(r).toHaveProperty('description');
    expect(r).toHaveProperty('score');
  });
});

describe('getCatalogMeta', () => {
  it('version + productCount döner (boş katalog 0.0.0-empty)', () => {
    const meta = getCatalogMeta();
    expect(meta.version).toMatch(/^\d+\.\d+\.\d+(-\w+)?$/);
    expect(meta.productCount).toBeGreaterThanOrEqual(0);
  });
});

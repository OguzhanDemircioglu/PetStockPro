import { describe, it, expect, vi } from 'vitest';

// DB client'ı mock'la — seed-catalog.ts eager import ediyor, test env'inde
// DATABASE_URL yok. scoreSeedProduct pure function, DB'siz çalışır.
vi.mock('@/lib/db/client', () => ({
  db: { execute: vi.fn().mockResolvedValue([]) },
}));

import { scoreSeedProduct, type SeedProduct } from './seed-catalog';

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

// `searchSeedCatalog` ve `getCatalogMeta` 2026-05-19 itibarıyla DB-backed
// (petstockpro.catalog_seed_products tablo). Eski JSON-memory integration test'leri
// kaldırıldı — browser E2E ile /admin/products/new combobox üzerinden doğrulanır.
// Pure function `scoreSeedProduct` testleri yukarıda korunur.

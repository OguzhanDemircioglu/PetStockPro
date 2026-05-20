import { describe, it, expect } from 'vitest';
import {
  buildLocalBusinessLd,
  buildProductLd,
  buildBreadcrumbLd,
} from './schema-org';
import type { StorefrontDetail, StorefrontProductDetail } from './public';

const BASE = 'https://petstockpro.com';

function makeStorefront(overrides: Partial<StorefrontDetail> = {}): StorefrontDetail {
  return {
    companyId: 'company-1',
    slug: 'mavi-pet',
    name: 'Mavi Pet Shop',
    cityId: 35,
    cityName: 'İzmir',
    districtId: 'dist-1',
    districtName: 'Bornova',
    storefrontStatus: 'approved',
    aboutContent: 'Mavi Pet Shop, mahallenizin güvenilir pet shop\'u.',
    contactPhone: '+905321234567',
    contactWhatsapp: null,
    contactTelegram: null,
    contactEmail: 'info@mavipet.com',
    socialInstagram: 'mavipet',
    socialFacebook: null,
    socialTwitter: null,
    socialTiktok: null,
    metaDescription: 'Mavi Pet Shop İzmir Bornova — mama, aksesuar, oyuncak.',
    companyWhatsapp: '+905324567890',
    branchSummary: {
      activeCount: 1,
      holidayCount: 0,
      inactiveCount: 0,
      allOnHoliday: false,
      anyOperational: true,
    },
    ...overrides,
  };
}

function makeProduct(
  overrides: Partial<StorefrontProductDetail> = {},
): StorefrontProductDetail {
  return {
    productId: 'prod-1',
    productName: 'Royal Canin Adult Kedi 2kg',
    slug: 'royal-canin-adult-kedi-2kg',
    description: 'Yetişkin kediler için tam tahıllı kuru mama.',
    companyId: 'company-1',
    companySlug: 'mavi-pet',
    companyName: 'Mavi Pet Shop',
    categoryName: 'Kedi Maması',
    brandName: 'Royal Canin',
    variants: [
      {
        variantId: 'v1',
        valueLabel: '2kg',
        sku: 'RC-AD-2KG',
        salePrice: '450.00',
        isDefault: true,
        inStock: true,
      },
      {
        variantId: 'v2',
        valueLabel: '4kg',
        sku: 'RC-AD-4KG',
        salePrice: '850.00',
        isDefault: false,
        inStock: false,
      },
    ],
    ...overrides,
  };
}

describe('buildLocalBusinessLd', () => {
  it('happy path — temel alanlar set', () => {
    const ld = buildLocalBusinessLd(makeStorefront(), BASE);
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('PetStore');
    expect(ld['@id']).toBe('https://petstockpro.com/vitrin/magaza/mavi-pet');
    expect(ld.url).toBe('https://petstockpro.com/vitrin/magaza/mavi-pet');
    expect(ld.name).toBe('Mavi Pet Shop');
    expect(ld.telephone).toBe('+905321234567');
    expect(ld.email).toBe('info@mavipet.com');
  });

  it('adres — il + ilçe + TR', () => {
    const ld = buildLocalBusinessLd(makeStorefront(), BASE);
    expect(ld.address).toEqual({
      '@type': 'PostalAddress',
      addressLocality: 'Bornova',
      addressRegion: 'İzmir',
      addressCountry: 'TR',
    });
  });

  it('description — metaDescription öncelikli', () => {
    const ld = buildLocalBusinessLd(makeStorefront(), BASE);
    expect(ld.description).toMatch(/Mavi Pet Shop İzmir Bornova/);
  });

  it('description — metaDescription yoksa about\'un ilk 250 karakteri', () => {
    const ld = buildLocalBusinessLd(
      makeStorefront({
        metaDescription: null,
        aboutContent: 'a'.repeat(500),
      }),
      BASE,
    );
    expect(ld.description?.length).toBeLessThanOrEqual(250);
  });

  it('sameAs — sosyal handle\'lar full URL\'e dönüşür', () => {
    const ld = buildLocalBusinessLd(
      makeStorefront({
        socialInstagram: 'mavipet',
        socialFacebook: '@MaviPetShop',
        socialTwitter: 'https://twitter.com/mavipet', // tam URL korunur
      }),
      BASE,
    );
    expect(ld.sameAs).toEqual([
      'https://instagram.com/mavipet',
      'https://facebook.com/MaviPetShop',
      'https://twitter.com/mavipet',
    ]);
  });

  it('telefon fallback: contactPhone → contactWhatsapp → companyWhatsapp', () => {
    const ld = buildLocalBusinessLd(
      makeStorefront({
        contactPhone: null,
        contactWhatsapp: '+905330000000',
      }),
      BASE,
    );
    expect(ld.telephone).toBe('+905330000000');

    const ld2 = buildLocalBusinessLd(
      makeStorefront({
        contactPhone: null,
        contactWhatsapp: null,
        companyWhatsapp: '+905339999999',
      }),
      BASE,
    );
    expect(ld2.telephone).toBe('+905339999999');
  });

  it('sameAs yoksa property eklenmez', () => {
    const ld = buildLocalBusinessLd(
      makeStorefront({
        socialInstagram: null,
        socialFacebook: null,
        socialTwitter: null,
        socialTiktok: null,
      }),
      BASE,
    );
    expect(ld.sameAs).toBeUndefined();
  });
});

describe('buildProductLd', () => {
  it('happy path — Product + Brand + AggregateOffer', () => {
    const ld = buildProductLd(makeProduct(), BASE);
    expect(ld['@type']).toBe('Product');
    expect(ld.name).toBe('Royal Canin Adult Kedi 2kg');
    expect(ld.url).toBe(
      'https://petstockpro.com/vitrin/magaza/mavi-pet/urun/royal-canin-adult-kedi-2kg',
    );
    expect(ld.brand).toEqual({ '@type': 'Brand', name: 'Royal Canin' });
    expect(ld.category).toBe('Kedi Maması');
    expect(ld.description).toMatch(/Yetişkin kediler/);
  });

  it('AggregateOffer — fiyat aralığı + offerCount + InStock', () => {
    const ld = buildProductLd(makeProduct(), BASE);
    expect(ld.offers).toEqual({
      '@type': 'AggregateOffer',
      priceCurrency: 'TRY',
      lowPrice: 450,
      highPrice: 850,
      offerCount: 2,
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'PetStore',
        name: 'Mavi Pet Shop',
        '@id': 'https://petstockpro.com/vitrin/magaza/mavi-pet',
      },
    });
  });

  it('tüm variant\'lar stokta yoksa → OutOfStock', () => {
    const ld = buildProductLd(
      makeProduct({
        variants: [
          {
            variantId: 'v1',
            valueLabel: '2kg',
            sku: 'X',
            salePrice: '100.00',
            isDefault: true,
            inStock: false,
          },
        ],
      }),
      BASE,
    );
    expect(ld.offers?.availability).toBe('https://schema.org/OutOfStock');
  });

  it('hiç fiyat yoksa offers yazılmaz', () => {
    const ld = buildProductLd(
      makeProduct({
        variants: [
          {
            variantId: 'v1',
            valueLabel: '2kg',
            sku: 'X',
            salePrice: '0',
            isDefault: true,
            inStock: false,
          },
        ],
      }),
      BASE,
    );
    expect(ld.offers).toBeUndefined();
  });

  it('description 500 karakter ile sınırlanır', () => {
    const ld = buildProductLd(
      makeProduct({ description: 'a'.repeat(1000) }),
      BASE,
    );
    expect(ld.description?.length).toBe(500);
  });

  it('brand/category yoksa property eklenmez', () => {
    const ld = buildProductLd(
      makeProduct({ brandName: null, categoryName: null }),
      BASE,
    );
    expect(ld.brand).toBeUndefined();
    expect(ld.category).toBeUndefined();
  });
});

describe('buildBreadcrumbLd', () => {
  it('3 item — pozisyon 1/2/3 ile sıralı, absolute URL', () => {
    const ld = buildBreadcrumbLd(
      [
        { name: 'Ana sayfa', url: '/' },
        { name: 'Vitrin', url: '/vitrin' },
        { name: 'Kuru Mama', url: '/vitrin/kategori/kuru-mama' },
      ],
      BASE,
    );
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('BreadcrumbList');
    expect(ld.itemListElement).toHaveLength(3);
    expect(ld.itemListElement[0]).toEqual({
      '@type': 'ListItem',
      position: 1,
      name: 'Ana sayfa',
      item: 'https://petstockpro.com/',
    });
    expect(ld.itemListElement[2]).toEqual({
      '@type': 'ListItem',
      position: 3,
      name: 'Kuru Mama',
      item: 'https://petstockpro.com/vitrin/kategori/kuru-mama',
    });
  });

  it('absolute URL — olduğu gibi bırakılır', () => {
    const ld = buildBreadcrumbLd(
      [{ name: 'External', url: 'https://other.com/x' }],
      BASE,
    );
    expect(ld.itemListElement[0].item).toBe('https://other.com/x');
  });

  it('baseUrl sonundaki slash trim edilir', () => {
    const ld = buildBreadcrumbLd(
      [{ name: 'X', url: '/x' }],
      'https://petstockpro.com///',
    );
    expect(ld.itemListElement[0].item).toBe('https://petstockpro.com/x');
  });

  it('boş array → 0 item', () => {
    const ld = buildBreadcrumbLd([], BASE);
    expect(ld.itemListElement).toEqual([]);
  });
});

/**
 * Schema.org structured data (JSON-LD) — Faz 2'den çekilen SEO katmanı.
 *
 * Google + diğer arama motorlarının vitrin profil + ürün detay
 * sayfalarını rich snippet ile göstermesi için JSON-LD inject edilir.
 *
 * 2 entity:
 *   - buildLocalBusinessLd(storefront, baseUrl): Pet shop profili için
 *     PetStore type (LocalBusiness subtype) — name + adres + iletişim +
 *     sosyal medya sameAs.
 *   - buildProductLd(product, storefront, baseUrl): Ürün detayı için
 *     Product type — name + brand + offers AggregateOffer (lowPrice,
 *     highPrice, offerCount, availability, seller).
 *
 * Pure functions — JSON-LD object döndürür, caller `<script type=
 * "application/ld+json">` ile sayfaya yerleştirir.
 *
 * Schema.org referans:
 *   https://schema.org/PetStore  (LocalBusiness subtype)
 *   https://schema.org/Product
 *   https://schema.org/AggregateOffer
 */

import type {
  StorefrontDetail,
  StorefrontProductDetail,
} from './public';

export interface LocalBusinessLd {
  '@context': 'https://schema.org';
  '@type': 'PetStore';
  '@id': string;
  name: string;
  url: string;
  description?: string;
  telephone?: string;
  email?: string;
  address?: {
    '@type': 'PostalAddress';
    addressLocality?: string;
    addressRegion?: string;
    addressCountry: 'TR';
  };
  sameAs?: string[];
}

export function buildLocalBusinessLd(
  storefront: StorefrontDetail,
  baseUrl: string,
): LocalBusinessLd {
  const url = `${baseUrl}/vitrin/magaza/${storefront.slug}`;
  const sameAs: string[] = [];
  if (storefront.socialInstagram) {
    sameAs.push(normalizeSocialUrl('instagram', storefront.socialInstagram));
  }
  if (storefront.socialFacebook) {
    sameAs.push(normalizeSocialUrl('facebook', storefront.socialFacebook));
  }
  if (storefront.socialTwitter) {
    sameAs.push(normalizeSocialUrl('twitter', storefront.socialTwitter));
  }
  if (storefront.socialTiktok) {
    sameAs.push(normalizeSocialUrl('tiktok', storefront.socialTiktok));
  }

  const address: LocalBusinessLd['address'] = {
    '@type': 'PostalAddress',
    addressCountry: 'TR',
  };
  if (storefront.districtName) address.addressLocality = storefront.districtName;
  if (storefront.cityName) address.addressRegion = storefront.cityName;

  const ld: LocalBusinessLd = {
    '@context': 'https://schema.org',
    '@type': 'PetStore',
    '@id': url,
    name: storefront.name,
    url,
    address,
  };

  if (storefront.metaDescription || storefront.aboutContent) {
    ld.description =
      storefront.metaDescription ??
      (storefront.aboutContent ?? undefined)?.slice(0, 250);
  }

  const phone = storefront.contactPhone ?? storefront.contactWhatsapp ?? storefront.companyWhatsapp;
  if (phone) ld.telephone = phone;
  if (storefront.contactEmail) ld.email = storefront.contactEmail;

  if (sameAs.length > 0) ld.sameAs = sameAs;

  return ld;
}

export interface ProductLd {
  '@context': 'https://schema.org';
  '@type': 'Product';
  name: string;
  url: string;
  description?: string;
  category?: string;
  brand?: {
    '@type': 'Brand';
    name: string;
  };
  offers?: {
    '@type': 'AggregateOffer';
    priceCurrency: 'TRY';
    lowPrice: number;
    highPrice: number;
    offerCount: number;
    availability:
      | 'https://schema.org/InStock'
      | 'https://schema.org/OutOfStock';
    seller: {
      '@type': 'PetStore';
      name: string;
      '@id': string;
    };
  };
}

export function buildProductLd(
  product: StorefrontProductDetail,
  baseUrl: string,
): ProductLd {
  const url = `${baseUrl}/vitrin/magaza/${product.companySlug}/urun/${product.slug}`;
  const sellerId = `${baseUrl}/vitrin/magaza/${product.companySlug}`;

  const priceValues = product.variants
    .map((v) => Number(v.salePrice))
    .filter((p) => Number.isFinite(p) && p > 0);

  const inStockCount = product.variants.filter((v) => v.inStock).length;

  const ld: ProductLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.productName,
    url,
  };

  if (product.description) {
    ld.description = product.description.slice(0, 500);
  }
  if (product.categoryName) ld.category = product.categoryName;
  if (product.brandName) {
    ld.brand = { '@type': 'Brand', name: product.brandName };
  }

  if (priceValues.length > 0) {
    const lowPrice = Math.min(...priceValues);
    const highPrice = Math.max(...priceValues);
    ld.offers = {
      '@type': 'AggregateOffer',
      priceCurrency: 'TRY',
      lowPrice,
      highPrice,
      offerCount: product.variants.length,
      availability:
        inStockCount > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'PetStore',
        name: product.companyName,
        '@id': sellerId,
      },
    };
  }

  return ld;
}

function normalizeSocialUrl(
  platform: 'instagram' | 'facebook' | 'twitter' | 'tiktok',
  handle: string,
): string {
  // Tam URL geldiyse dokunma
  if (/^https?:\/\//i.test(handle)) return handle;
  const clean = handle.replace(/^@/, '').trim();
  switch (platform) {
    case 'instagram':
      return `https://instagram.com/${clean}`;
    case 'facebook':
      return `https://facebook.com/${clean}`;
    case 'twitter':
      return `https://twitter.com/${clean}`;
    case 'tiktok':
      return `https://tiktok.com/@${clean}`;
  }
}

// ─────────────────────────────────────────────────────────────────
// BreadcrumbList — Google SERP'de breadcrumb yolu görünür hale getirir
// https://schema.org/BreadcrumbList
// ─────────────────────────────────────────────────────────────────

export interface BreadcrumbItem {
  name: string;
  /** Relative path (e.g. '/vitrin/kategori/kuru-mama') veya absolute URL. */
  url: string;
}

export interface BreadcrumbLd {
  '@context': 'https://schema.org';
  '@type': 'BreadcrumbList';
  itemListElement: Array<{
    '@type': 'ListItem';
    position: number;
    name: string;
    item: string;
  }>;
}

/**
 * Breadcrumb JSON-LD üretir. Items sırası: [home, kategori, alt-sayfa, ...].
 * Her item için absolute URL gerekli (baseUrl ile prepend yapılır eğer
 * item.url '/' ile başlıyorsa).
 *
 * @example
 * buildBreadcrumbLd([
 *   { name: 'Ana sayfa', url: '/' },
 *   { name: 'Vitrin', url: '/vitrin' },
 *   { name: 'Kuru Mama', url: '/vitrin/kategori/kuru-mama' },
 * ], 'https://petstockpro.com')
 */
export function buildBreadcrumbLd(
  items: BreadcrumbItem[],
  baseUrl: string,
): BreadcrumbLd {
  const trimmedBase = baseUrl.replace(/\/+$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: item.url.startsWith('/') ? `${trimmedBase}${item.url}` : item.url,
    })),
  };
}

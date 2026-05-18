/**
 * Vitrin sayfa metadata builder — Next.js Metadata API için merkezi yardımcı.
 *
 * Her vitrin route'unda kullanılır: title + description + canonical URL +
 * OpenGraph (Facebook/LinkedIn/WhatsApp preview) + Twitter Cards.
 *
 * Canonical URL: filter param'larından bağımsız "kanonik" adresi belirler.
 * Duplicate content engellemesi — Google ?lat=...&page=2 gibi varyasyonların
 * hepsini aynı temel URL'e indekslemeli.
 *
 * OpenGraph + Twitter Cards: WhatsApp/Facebook/Twitter/LinkedIn paylaşıldığında
 * link preview kartında zengin görünüm (görsel + başlık + açıklama).
 */

import type { Metadata } from 'next';
import { getPublicBaseUrl } from './sitemap-data';

export interface VitrinPageMetadataInput {
  /** Sayfa başlığı — Google SERP + tarayıcı sekme + sosyal preview */
  title: string;
  /** Açıklama — Google SERP snippet (150-160 karakter ideal) + sosyal preview */
  description: string;
  /**
   * Canonical relative path — `/vitrin/kategori/kuru-mama` gibi (leading `/`).
   * Query string filter'ları (lat, page, sort) çıkarılmış kanonik adres.
   */
  path: string;
  /**
   * Sosyal paylaşım görseli (OpenGraph + Twitter Cards) için absolute URL.
   * Yoksa default brand logosu kullanılır.
   */
  imageUrl?: string;
  /**
   * OpenGraph type — Next.js Metadata API'sinin desteklediği union.
   * Not: 'product' OG spec'inde var ama Next.js TS tanımı kabul etmiyor;
   * Schema.org Product LD zaten ürün tipini belirtiyor, OG için 'website' yeterli.
   */
  ogType?: 'website' | 'article' | 'profile';
  /**
   * Tarayıcı bot'a index/follow yönergesi. Default: true (indexlenebilir).
   * Filter sonuçları boş veya çok narrow olan sayfalar için false.
   */
  index?: boolean;
}

/**
 * Sosyal paylaşım için optimize edilmiş 1200×630 PNG (PetStockPro brand
 * mark, cream arka plan). `next/og-image-generator` ile manuel üretildi.
 * Logo.webp 256×258 sosyal preview için küçük — OG image standartı 1.91:1.
 */
const DEFAULT_OG_IMAGE_PATH = '/og-image.png';
const DEFAULT_OG_IMAGE_WIDTH = 1200;
const DEFAULT_OG_IMAGE_HEIGHT = 630;

/**
 * Vitrin sayfaları için Metadata objesi üretir.
 *
 * @example
 * export async function generateMetadata({ params }): Promise<Metadata> {
 *   const { slug } = await params;
 *   return buildVitrinPageMetadata({
 *     title: `${cat.name} — PetStockPro`,
 *     description: `${cat.name} kategorisinde 12 ürün...`,
 *     path: `/vitrin/kategori/${slug}`,
 *   });
 * }
 */
export function buildVitrinPageMetadata(
  input: VitrinPageMetadataInput,
): Metadata {
  const baseUrl = getPublicBaseUrl();
  const canonicalUrl = `${baseUrl}${input.path}`;
  const imageUrl =
    input.imageUrl ?? `${baseUrl}${DEFAULT_OG_IMAGE_PATH}`;
  const ogType = input.ogType ?? 'website';
  const shouldIndex = input.index !== false;

  return {
    title: input.title,
    description: input.description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: ogType,
      url: canonicalUrl,
      siteName: 'PetStockPro',
      title: input.title,
      description: input.description,
      locale: 'tr_TR',
      images: [
        {
          url: imageUrl,
          width: DEFAULT_OG_IMAGE_WIDTH,
          height: DEFAULT_OG_IMAGE_HEIGHT,
          alt: 'PetStockPro',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: input.title,
      description: input.description,
      images: [imageUrl],
    },
    robots: shouldIndex
      ? { index: true, follow: true }
      : { index: false, follow: true },
  };
}

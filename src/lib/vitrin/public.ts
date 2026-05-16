/**
 * Merkezi Vitrin Dizini — public API (Sprint 12 MVP).
 *
 * `/vitrin` ana sayfası ve `/vitrin/magaza/[slug]` profil sayfası için
 * tenant-agnostic helper. Public erişim — auth yok.
 *
 * Filtreler:
 *   - city / district (lokasyona göre)
 *   - q (name LIKE)
 *
 * Görünürlük kuralı (MVP):
 *   - storefront_settings.is_enabled = true
 *   - companies.storefront_status IN ('approved')  — auto_suspended dahil değil
 *
 * Detay tasarım: EKRAN-PUBLIC-VITRIN.md (Sahibinden modeli, eşit görünüm).
 */

import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import {
  branches,
  cities,
  companies,
  districts,
  productVariants,
  products,
  storefrontSettings,
} from '@/db/schema';

export interface StorefrontListItem {
  companyId: string;
  slug: string;
  name: string;
  cityId: number | null;
  cityName: string | null;
  districtId: string | null;
  districtName: string | null;
  whatsappPhone: string | null;
  aboutShort: string | null;
  productCount: number;
  branchCount: number;
}

export interface ListStorefrontsFilters {
  cityId?: number;
  districtId?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface StorefrontDetail {
  companyId: string;
  slug: string;
  name: string;
  cityId: number | null;
  cityName: string | null;
  districtId: string | null;
  districtName: string | null;
  storefrontStatus: string;
  // Settings
  aboutContent: string | null;
  contactPhone: string | null;
  contactWhatsapp: string | null;
  contactTelegram: string | null;
  contactEmail: string | null;
  socialInstagram: string | null;
  socialFacebook: string | null;
  socialTwitter: string | null;
  socialTiktok: string | null;
  metaDescription: string | null;
  // Companies tablosu fallback whatsapp
  companyWhatsapp: string | null;
}

export interface StorefrontProduct {
  productId: string;
  productName: string;
  slug: string;
  defaultSalePrice: string | null;
  defaultVariantLabel: string | null;
}

const MAX_LIMIT = 60;
const DEFAULT_LIMIT = 24;
const ABOUT_PREVIEW_CHARS = 180;

/**
 * Public dizine giren tenant'ları listele.
 *
 * Sıralama: storefront_settings.updated_at DESC (son aktif olanlar üstte).
 * Faz 2'de PostGIS ST_DWithin ile mesafe sıralaması eklenebilir.
 */
export async function listPublicStorefronts(
  db: DbClient,
  filters: ListStorefrontsFilters = {},
): Promise<StorefrontListItem[]> {
  const conditions = [
    eq(storefrontSettings.isEnabled, true),
    eq(companies.storefrontStatus, 'approved'),
  ];
  if (filters.cityId) {
    conditions.push(eq(companies.cityId, filters.cityId));
  }
  if (filters.districtId) {
    conditions.push(eq(companies.districtId, filters.districtId));
  }
  if (filters.q && filters.q.trim().length > 0) {
    const pattern = `%${filters.q.trim()}%`;
    // Ad ve about_content alanlarında ILIKE arama
    conditions.push(
      or(
        ilike(companies.name, pattern),
        ilike(storefrontSettings.aboutContent, pattern),
      )!,
    );
  }

  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Math.max(0, filters.offset ?? 0);

  const rows = await db
    .select({
      companyId: companies.id,
      slug: companies.slug,
      name: companies.name,
      cityId: companies.cityId,
      cityName: cities.name,
      districtId: companies.districtId,
      districtName: districts.name,
      whatsappPhone: companies.whatsappPhone,
      aboutContent: storefrontSettings.aboutContent,
      productCount: sql<number>`
        COALESCE((
          SELECT COUNT(*)::int FROM ${products}
          WHERE ${products.companyId} = ${companies.id}
            AND ${products.vitrinPublished} = true
            AND ${products.deletedAt} IS NULL
        ), 0)
      `,
      branchCount: sql<number>`
        COALESCE((
          SELECT COUNT(*)::int FROM ${branches}
          WHERE ${branches.companyId} = ${companies.id}
            AND ${branches.isActive} = true
        ), 0)
      `,
    })
    .from(storefrontSettings)
    .innerJoin(companies, eq(companies.id, storefrontSettings.companyId))
    .leftJoin(cities, eq(cities.id, companies.cityId))
    .leftJoin(districts, eq(districts.id, companies.districtId))
    .where(and(...conditions))
    .orderBy(asc(companies.name))
    .limit(limit)
    .offset(offset);

  return rows.map((r) => ({
    companyId: r.companyId,
    slug: r.slug,
    name: r.name,
    cityId: r.cityId,
    cityName: r.cityName,
    districtId: r.districtId,
    districtName: r.districtName,
    whatsappPhone: r.whatsappPhone,
    aboutShort: r.aboutContent
      ? r.aboutContent.length > ABOUT_PREVIEW_CHARS
        ? `${r.aboutContent.slice(0, ABOUT_PREVIEW_CHARS).trim()}…`
        : r.aboutContent
      : null,
    productCount: r.productCount,
    branchCount: r.branchCount,
  }));
}

/**
 * Slug ile tenant detay — public profil sayfası.
 *
 * @returns Detay objesi veya null (yoksa / kapalıysa / approved değilse).
 */
export async function getStorefrontBySlug(
  slug: string,
  db: DbClient,
): Promise<StorefrontDetail | null> {
  const rows = await db
    .select({
      companyId: companies.id,
      slug: companies.slug,
      name: companies.name,
      cityId: companies.cityId,
      cityName: cities.name,
      districtId: companies.districtId,
      districtName: districts.name,
      storefrontStatus: companies.storefrontStatus,
      companyWhatsapp: companies.whatsappPhone,
      isEnabled: storefrontSettings.isEnabled,
      aboutContent: storefrontSettings.aboutContent,
      contactPhone: storefrontSettings.contactPhone,
      contactWhatsapp: storefrontSettings.contactWhatsapp,
      contactTelegram: storefrontSettings.contactTelegram,
      contactEmail: storefrontSettings.contactEmail,
      socialInstagram: storefrontSettings.socialInstagram,
      socialFacebook: storefrontSettings.socialFacebook,
      socialTwitter: storefrontSettings.socialTwitter,
      socialTiktok: storefrontSettings.socialTiktok,
      metaDescription: storefrontSettings.metaDescription,
    })
    .from(companies)
    .innerJoin(storefrontSettings, eq(storefrontSettings.companyId, companies.id))
    .leftJoin(cities, eq(cities.id, companies.cityId))
    .leftJoin(districts, eq(districts.id, companies.districtId))
    .where(eq(companies.slug, slug))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (!row.isEnabled) return null;
  if (row.storefrontStatus !== 'approved') return null;

  return {
    companyId: row.companyId,
    slug: row.slug,
    name: row.name,
    cityId: row.cityId,
    cityName: row.cityName,
    districtId: row.districtId,
    districtName: row.districtName,
    storefrontStatus: row.storefrontStatus,
    aboutContent: row.aboutContent,
    contactPhone: row.contactPhone,
    contactWhatsapp: row.contactWhatsapp,
    contactTelegram: row.contactTelegram,
    contactEmail: row.contactEmail,
    socialInstagram: row.socialInstagram,
    socialFacebook: row.socialFacebook,
    socialTwitter: row.socialTwitter,
    socialTiktok: row.socialTiktok,
    metaDescription: row.metaDescription,
    companyWhatsapp: row.companyWhatsapp,
  };
}

/**
 * Tenant'ın vitrin'e açık ürünleri.
 *
 * Default variant fiyatı + valueLabel join'i ile tek satır per product.
 */
export async function listStorefrontProducts(
  companyId: string,
  db: DbClient,
  limit: number = 48,
): Promise<StorefrontProduct[]> {
  // Default variant LEFT JOIN — is_default=true + is_active=true. Eğer
  // default işaretli variant yoksa NULL (UI fallback).
  const rows = await db
    .select({
      productId: products.id,
      productName: products.name,
      slug: products.slug,
      defaultSalePrice: productVariants.salePrice,
      defaultVariantLabel: productVariants.valueLabel,
    })
    .from(products)
    .leftJoin(
      productVariants,
      and(
        eq(productVariants.productId, products.id),
        eq(productVariants.isDefault, true),
        eq(productVariants.isActive, true),
      ),
    )
    .where(
      and(
        eq(products.companyId, companyId),
        eq(products.vitrinPublished, true),
        sql`${products.deletedAt} IS NULL`,
      ),
    )
    .orderBy(asc(products.name))
    .limit(Math.min(limit, 120));

  return rows;
}

/**
 * WhatsApp deep link URL'i üret.
 *
 * Türk numara normalize: 0 prefix kaldır, +90 ekle, 5xx başlıyorsa zaten OK.
 * "Karaköy Pet, vitrin'de gördüm — ... ürünü hala var mı?" gibi prefill metin.
 *
 * @returns wa.me URL veya null (numara yoksa).
 */
export function buildWhatsappLink(
  phone: string | null | undefined,
  message?: string,
): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned) return null;
  let normalized = cleaned;
  if (normalized.startsWith('+')) {
    normalized = normalized.slice(1);
  }
  if (normalized.startsWith('0')) {
    normalized = '90' + normalized.slice(1);
  }
  if (!normalized.startsWith('90') && normalized.length === 10) {
    normalized = '90' + normalized;
  }
  if (normalized.length < 10) return null;
  const url = `https://wa.me/${normalized}`;
  if (message) {
    return `${url}?text=${encodeURIComponent(message)}`;
  }
  return url;
}

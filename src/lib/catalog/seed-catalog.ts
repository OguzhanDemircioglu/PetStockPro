/**
 * Seed Catalog — Curated TR pet ürünleri katalog araması (DB-backed).
 *
 * **2026-05-19 itibarıyla DB-backed** — eski JSON-memory yöntemi `.gitignore`'da
 * kalan büyük JSON dosyasına bağımlıydı; Cloudflare Workers bundle size + production
 * deploy sorunları nedeniyle artık `petstockpro.catalog_seed_products` tablosundan
 * sorgulanıyor. 1.240 ürün, GIN trgm index ile <2ms search latency.
 *
 * Strateji:
 * - DB'den candidate çek (LIKE + GIN trgm fast scan, max 100 candidate)
 * - In-memory scoreSeedProduct ile rank (eski JSON döneminin pure scoring fn'i korunur)
 * - LIMIT 20 slice ile dropdown'a düşür
 *
 * Pure scoring function (`scoreSeedProduct`) test edilebilir kalır — DB layer'ından
 * bağımsız, unit test'lerde mock gerekmez.
 */

import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';

export type SeedAnimalType =
  | 'cat'
  | 'dog'
  | 'bird'
  | 'fish'
  | 'rabbit'
  | 'hamster'
  | 'reptile';

export interface SeedProduct {
  name: string;
  brand: string;
  categorySlug: string;
  animalType: SeedAnimalType;
  weight: string;
  /** Geriye uyumluluk için tutulur — DB modelinde yok, hep null. */
  barcode: string | null;
  /** Geriye uyumluluk için tutulur — DB modelinde yok, hep null. */
  imageUrl: string | null;
  /** R2 object key: "seed/{hash}.webp". Frontend base URL env'den prepend eder. */
  imagePath: string | null;
  /** Geriye uyumluluk için tutulur — DB modelinde yok, hep ''. */
  description: string;
  /** Geriye uyumluluk için tutulur — DB modelinde yok, hep null. */
  sourceUrl: string | null;
}

export interface SearchResult extends SeedProduct {
  score: number;
}

const MAX_LIMIT = 20;
const CANDIDATE_LIMIT = 100; // DB'den çekilecek ham aday seti

/**
 * Score-based ranking (yüksek = daha iyi eşleşme). Pure function — DB'siz test edilir.
 *
 * - 1000: barkod birebir eşleşir (uzun query)
 * - 900: barkod prefix eşleşir (≥6 hane)
 * - 500: ürün adı birebir
 * - 400: ürün adı prefix
 * - 250: ürün adı içerir
 * - 300: marka adı prefix
 * - 200: marka adı içerir
 * - 50+: kelime bazlı bonus (her query kelimesi adda geçerse +20)
 *
 * Hiç eşleşme yoksa 0 → atılır.
 */
export function scoreSeedProduct(product: SeedProduct, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const nameLower = product.name.toLowerCase();
  const brandLower = product.brand.toLowerCase();
  const barcode = product.barcode ?? '';

  let score = 0;

  // Barkod arama: tam sayısal q ≥6 hane (DB modelinde barcode YOK, hep '')
  if (/^\d{6,}$/.test(q) && barcode) {
    if (barcode === q) {
      score += 1000;
    } else if (barcode.startsWith(q)) {
      score += 900;
    }
  }

  // İsim eşleşmesi
  if (nameLower === q) {
    score += 500;
  } else if (nameLower.startsWith(q)) {
    score += 400;
  } else if (nameLower.includes(q)) {
    score += 250;
  }

  // Marka eşleşmesi
  if (brandLower === q) {
    score += 350;
  } else if (brandLower.startsWith(q)) {
    score += 300;
  } else if (brandLower.includes(q)) {
    score += 200;
  }

  // Kelime bazlı bonus (her query kelimesi adda geçerse +20)
  const queryWords = q.split(/\s+/).filter((w) => w.length >= 2);
  if (queryWords.length > 1) {
    let wordHits = 0;
    for (const w of queryWords) {
      if (nameLower.includes(w) || brandLower.includes(w)) {
        wordHits += 1;
      }
    }
    if (wordHits === queryWords.length) {
      score += 50 + wordHits * 10;
    }
  }

  return score;
}

/**
 * Curated seed katalogunda DB-backed arama.
 *
 * - Boş query → `[]`
 * - `limit` clamp [1, 20] (default 8)
 * - DB'den 100 candidate çek (GIN trgm bitmap scan, <1ms)
 * - In-memory scoreSeedProduct ile rank
 * - Sort: score DESC, name ASC (deterministik)
 * - Score 0 olanlar atılır
 */
export async function searchSeedCatalog(query: string, limit = 8): Promise<SearchResult[]> {
  const q = query?.trim();
  if (!q) return [];

  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), MAX_LIMIT);
  const lowerQ = q.toLowerCase();

  // DB'den candidate çek (GIN trgm hızlı tarama)
  const rows = await db.execute<{
    id: number;
    name: string;
    brand: string;
    weight: string;
    animal_type: string;
    category_slug: string;
    image_path: string;
    description: string | null;
  }>(sql`
    SELECT id, name, brand, weight, animal_type, category_slug, image_path, description
    FROM petstockpro.catalog_seed_products
    WHERE lower(name) LIKE '%' || ${lowerQ} || '%'
       OR lower(brand) LIKE '%' || ${lowerQ} || '%'
    LIMIT ${CANDIDATE_LIMIT}
  `);

  // In-memory scoring
  const scored: SearchResult[] = [];
  for (const r of rows) {
    const product: SeedProduct = {
      name: r.name,
      brand: r.brand,
      weight: r.weight,
      animalType: r.animal_type as SeedAnimalType,
      categorySlug: r.category_slug,
      imagePath: r.image_path,
      // Geriye uyumluluk (DB modelinde yok)
      barcode: null,
      imageUrl: null,
      description: r.description ?? '',
      sourceUrl: null,
    };
    const score = scoreSeedProduct(product, q);
    if (score > 0) {
      scored.push({ ...product, score });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.name.localeCompare(b.name, 'tr');
  });

  return scored.slice(0, safeLimit);
}

/**
 * DB'den catalog meta — autocomplete component'i veya admin paneli için.
 * Static "version" kaldırıldı (DB-backed artık), DB row count + last modified.
 */
export async function getCatalogMeta(): Promise<{ productCount: number; backedBy: 'database' }> {
  const result = await db.execute<{ c: number }>(sql`
    SELECT count(*)::int AS c FROM petstockpro.catalog_seed_products
  `);
  return {
    productCount: result[0]?.c ?? 0,
    backedBy: 'database',
  };
}

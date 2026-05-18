/**
 * Seed Catalog — Curated TR pet ürünleri katalog araması.
 *
 * **2026-05-18 itibarıyla pasif** — `scripts/data/pet-products-catalog.json`
 * `.gitignore`'da, repo dışı tutuluyor. Yeni session'da Firecrawl MCP ile
 * Türkiye'deki tüm pet shop ürünleri (resimler dahil) yeniden toplanacak,
 * sonra burada aktif hale getirilecek. Şu anda boş katalog dönüyor — UI
 * autocomplete'i "Eşleşen yok" empty state gösterir, akış sade çalışır.
 *
 * Kullanım (aktif olduğunda): `/admin/products/new` formu autocomplete'i.
 *
 * Strateji:
 * - Dynamic require JSON yoksa graceful fallback (boş products array)
 * - Pure `searchSeedCatalog(q, limit)` fn — score-based ranking, ad/marka/barkod arama
 * - Edge runtime'da çalışır (JSON varsa bundle dahil, yoksa hiç yok)
 */

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
  barcode: string | null;
  imageUrl: string | null;
  /** Lokal yol — JSON'daki tüm ürünlerde yok (yaklaşık yarısında). */
  imagePath?: string | null;
  description: string;
  sourceUrl: string | null;
}

interface CatalogFile {
  version: string;
  generatedAt: string;
  products: SeedProduct[];
}

/**
 * Catalog yükle — JSON dosyası yoksa boş katalog (graceful fallback).
 * `scripts/data/pet-products-catalog.json` `.gitignore`'da olduğu için
 * production/CI build'lerinde yok. Lokalde varsa otomatik yüklenir.
 */
function loadCatalog(): CatalogFile {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const raw = require('../../../scripts/data/pet-products-catalog.json');
    return raw as CatalogFile;
  } catch {
    return {
      version: '0.0.0-empty',
      generatedAt: new Date().toISOString(),
      products: [],
    };
  }
}

const CATALOG: CatalogFile = loadCatalog();

export interface SearchResult extends SeedProduct {
  score: number;
}

const MAX_LIMIT = 20;

/**
 * Score-based ranking (yüksek = daha iyi eşleşme):
 *
 * - 1000: barkod birebir eşleşir (uzun query)
 * - 900: barkod prefix eşleşir (≥6 hane)
 * - 500: ürün adı birebir
 * - 400: ürün adı prefix
 * - 250: ürün adı içerir
 * - 300: marka adı prefix
 * - 200: marka adı içerir
 * - 50: kelime bazlı bonus (her query kelimesi adda geçerse +20)
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

  // Barkod arama: tam sayısal q ≥6 hane
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
 * Curated seed katalogunda arama yap.
 *
 * - Boş query → `[]`
 * - `limit` clamp [1, 20] (default 8)
 * - Sort: score DESC, name ASC (deterministik)
 * - Score 0 olanlar atılır
 */
export function searchSeedCatalog(query: string, limit = 8): SearchResult[] {
  const q = query?.trim();
  if (!q) return [];

  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), MAX_LIMIT);

  const scored: SearchResult[] = [];
  for (const product of CATALOG.products) {
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

/** Diagnostic / hızlı test için katalog meta bilgileri. */
export function getCatalogMeta() {
  return {
    version: CATALOG.version,
    generatedAt: CATALOG.generatedAt,
    productCount: CATALOG.products.length,
  };
}

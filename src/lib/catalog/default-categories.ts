/**
 * Default Categories — Yeni tenant register'ında otomatik seed (Sprint 1B.1)
 *
 * Pet shop'ların büyük çoğunluğunun aynı temel kategorileri olduğu için
 * register sırasında bu liste otomatik insert edilir. Tenant sonradan
 * düzenleyebilir/silebilir.
 *
 * KDV oranları (TR 2024 sonrası — `lib/constants/vat-rates.ts` ile uyum):
 *   - Pet mama: %10 (gıda kategorisinde — TR Maliye Bakanlığı tebliği)
 *   - Aksesuar/oyuncak/diğer: %20 (genel oran)
 *
 * SKT (son kullanma tarihi) gerekli: mama + ilaç + sağlık (stok hareketlerinde
 * expiryDate zorunlu — Sprint 4 trigger).
 */

export interface DefaultCategorySeed {
  name: string;
  slug: string;
  emoji: string;
  vatRate: string; // decimal string ("10.00" / "20.00")
  sktRequired: boolean;
  displayOrder: number;
}

export const DEFAULT_CATEGORIES: DefaultCategorySeed[] = [
  // Mama (en sık satılan kategori, en üstte)
  { name: 'Kuru Mama',     slug: 'kuru-mama',     emoji: '🥘', vatRate: '10.00', sktRequired: true,  displayOrder: 1 },
  { name: 'Yaş Mama',      slug: 'yas-mama',      emoji: '🥫', vatRate: '10.00', sktRequired: true,  displayOrder: 2 },
  { name: 'Ödül / Snack',  slug: 'odul-snack',    emoji: '🍪', vatRate: '10.00', sktRequired: true,  displayOrder: 3 },

  // Sağlık & Bakım
  { name: 'Vitamin / İlaç', slug: 'vitamin-ilac',  emoji: '💊', vatRate: '20.00', sktRequired: true,  displayOrder: 4 },
  { name: 'Şampuan / Parfüm', slug: 'sampuan-parfum', emoji: '🧴', vatRate: '20.00', sktRequired: true, displayOrder: 5 },
  { name: 'Veteriner Bakım', slug: 'veteriner-bakim', emoji: '🩺', vatRate: '20.00', sktRequired: false, displayOrder: 6 },

  // Tuvalet & Hijyen
  { name: 'Kedi Kumu',     slug: 'kedi-kumu',     emoji: '🪨', vatRate: '20.00', sktRequired: false, displayOrder: 7 },
  { name: 'Tuvalet Eğitimi', slug: 'tuvalet-egitimi', emoji: '🪣', vatRate: '20.00', sktRequired: false, displayOrder: 8 },

  // Aksesuar
  { name: 'Tasma / Kayış', slug: 'tasma-kayis',   emoji: '🦮', vatRate: '20.00', sktRequired: false, displayOrder: 9 },
  { name: 'Mama Kabı',     slug: 'mama-kabi',     emoji: '🥣', vatRate: '20.00', sktRequired: false, displayOrder: 10 },
  { name: 'Yatak / Yuva',  slug: 'yatak-yuva',    emoji: '🛏', vatRate: '20.00', sktRequired: false, displayOrder: 11 },

  // Oyuncak & Eğlence
  { name: 'Oyuncak',       slug: 'oyuncak',       emoji: '🎾', vatRate: '20.00', sktRequired: false, displayOrder: 12 },
  { name: 'Tırmalama',     slug: 'tirmalama',     emoji: '🪵', vatRate: '20.00', sktRequired: false, displayOrder: 13 },

  // Taşıma & Seyahat
  { name: 'Taşıma Çantası', slug: 'tasima-cantasi', emoji: '🎒', vatRate: '20.00', sktRequired: false, displayOrder: 14 },
  { name: 'Kafes / Akvaryum', slug: 'kafes-akvaryum', emoji: '🐠', vatRate: '20.00', sktRequired: false, displayOrder: 15 },

  // Diğer (catch-all)
  { name: 'Diğer',         slug: 'diger',         emoji: '📦', vatRate: '20.00', sktRequired: false, displayOrder: 99 },
];

import type { DbClient } from '@/lib/db/client';
import { categories } from '@/db/schema';

/**
 * Yeni tenant için default 16 kategoriyi seed eder.
 *
 * Idempotent değil — duplicate slug çakışırsa hata. Caller tek seferlik
 * (register sırasında veya manuel seed komutuyla) çağırmalı.
 */
export async function seedDefaultCategoriesForCompany(
  companyId: string,
  db: DbClient,
): Promise<{ inserted: number }> {
  const rows = DEFAULT_CATEGORIES.map((c) => ({
    companyId,
    name: c.name,
    slug: c.slug,
    emoji: c.emoji,
    vatRate: c.vatRate,
    sktRequired: c.sktRequired,
    displayOrder: c.displayOrder,
  }));

  await db.insert(categories).values(rows);
  return { inserted: rows.length };
}

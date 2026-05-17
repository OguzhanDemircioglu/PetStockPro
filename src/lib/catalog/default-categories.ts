/**
 * Default Categories — Yeni tenant register'ında otomatik seed (Sprint 1B.1)
 *
 * Pet shop'ların büyük çoğunluğunun aynı temel kategorileri olduğu için
 * register sırasında bu liste otomatik insert edilir. Tenant sonradan
 * düzenleyebilir/silebilir.
 *
 * **2-seviyeli hiyerarşi (2026-05-17 revize):**
 *   - Üst kategoriler (6 root): Kedi, Köpek, Kuş, Akvaryum, Kemirgen, Sürüngen.
 *   - Alt kategoriler (43): her üst kategoriye bağlı, `parentSlug` ile referans.
 *
 * KDV oranları (TR 2024 sonrası — `lib/constants/vat-rates.ts` ile uyum):
 *   - Pet mama / gıda: %10 (TR Maliye Bakanlığı tebliği)
 *   - Aksesuar / oyuncak / kafes / vitamin: %20 (genel oran)
 *
 * SKT (son kullanma tarihi) zorunlu: mama + yem + vitamin + ilaç.
 */

export interface DefaultCategorySeed {
  name: string;
  slug: string;
  emoji: string;
  vatRate: string; // decimal string ("10.00" / "20.00")
  sktRequired: boolean;
  displayOrder: number;
  /** undefined → root kategori. Var ise: parent kategorinin slug'ı. */
  parentSlug?: string;
}

export const DEFAULT_CATEGORIES: DefaultCategorySeed[] = [
  // ====== Üst kategoriler (root) ======
  { name: 'Kedi',     slug: 'kedi',         emoji: '🐱', vatRate: '20.00', sktRequired: false, displayOrder: 1 },
  { name: 'Köpek',    slug: 'kopek',        emoji: '🐶', vatRate: '20.00', sktRequired: false, displayOrder: 2 },
  { name: 'Kuş',      slug: 'kus',          emoji: '🐦', vatRate: '20.00', sktRequired: false, displayOrder: 3 },
  { name: 'Akvaryum', slug: 'akvaryum',     emoji: '🐟', vatRate: '20.00', sktRequired: false, displayOrder: 4 },
  { name: 'Kemirgen', slug: 'kemirgen',     emoji: '🐹', vatRate: '20.00', sktRequired: false, displayOrder: 5 },
  { name: 'Sürüngen', slug: 'surungenler',  emoji: '🦎', vatRate: '20.00', sktRequired: false, displayOrder: 6 },

  // ====== Kedi alt kategorileri ======
  { name: 'Kuru Mamalar',         slug: 'kedi-kuru-mamalar',         emoji: '🥩', vatRate: '10.00', sktRequired: true,  displayOrder: 1,  parentSlug: 'kedi' },
  { name: 'Yaş Mamalar',          slug: 'kedi-yas-mamalar',          emoji: '🥫', vatRate: '10.00', sktRequired: true,  displayOrder: 2,  parentSlug: 'kedi' },
  { name: 'Ödüller',              slug: 'kedi-oduller',              emoji: '🍬', vatRate: '10.00', sktRequired: true,  displayOrder: 3,  parentSlug: 'kedi' },
  { name: 'Mama ve Su Kapları',   slug: 'kedi-mama-ve-su-kaplari',   emoji: '🍽️', vatRate: '20.00', sktRequired: false, displayOrder: 4,  parentSlug: 'kedi' },
  { name: 'Kumlar',               slug: 'kedi-kumlar',               emoji: '🪣', vatRate: '20.00', sktRequired: false, displayOrder: 5,  parentSlug: 'kedi' },
  { name: 'Oyuncaklar',           slug: 'kedi-oyuncaklar',           emoji: '🎾', vatRate: '20.00', sktRequired: false, displayOrder: 6,  parentSlug: 'kedi' },
  { name: 'Tasmalar',             slug: 'kedi-tasmalar',             emoji: '📿', vatRate: '20.00', sktRequired: false, displayOrder: 7,  parentSlug: 'kedi' },
  { name: 'Yatak ve Yuvalar',     slug: 'kedi-yatak-ve-yuvalar',     emoji: '🛏️', vatRate: '20.00', sktRequired: false, displayOrder: 8,  parentSlug: 'kedi' },
  { name: 'Bakım Ürünleri',       slug: 'kedi-bakim-urunleri',       emoji: '🚿', vatRate: '20.00', sktRequired: false, displayOrder: 9,  parentSlug: 'kedi' },
  { name: 'Vitamin ve Katkıları', slug: 'kedi-vitamin-ve-katkilari', emoji: '💊', vatRate: '20.00', sktRequired: true,  displayOrder: 10, parentSlug: 'kedi' },

  // ====== Köpek alt kategorileri ======
  { name: 'Kuru Mamalar',       slug: 'kopek-kuru-mamalar',       emoji: '🥩', vatRate: '10.00', sktRequired: true,  displayOrder: 1,  parentSlug: 'kopek' },
  { name: 'Yaş Mamalar',        slug: 'kopek-yas-mamalar',        emoji: '🥫', vatRate: '10.00', sktRequired: true,  displayOrder: 2,  parentSlug: 'kopek' },
  { name: 'Ödüller',            slug: 'kopek-oduller',            emoji: '🍬', vatRate: '10.00', sktRequired: true,  displayOrder: 3,  parentSlug: 'kopek' },
  { name: 'Mama ve Su Kapları', slug: 'kopek-mama-ve-su-kaplari', emoji: '🍽️', vatRate: '20.00', sktRequired: false, displayOrder: 4,  parentSlug: 'kopek' },
  { name: 'Oyuncaklar',         slug: 'kopek-oyuncaklar',         emoji: '🎾', vatRate: '20.00', sktRequired: false, displayOrder: 5,  parentSlug: 'kopek' },
  { name: 'Tasmalar',           slug: 'kopek-tasmalar',           emoji: '📿', vatRate: '20.00', sktRequired: false, displayOrder: 6,  parentSlug: 'kopek' },
  { name: 'Gezdirme Ürünleri',  slug: 'kopek-gezdirme-urunleri',  emoji: '🚶', vatRate: '20.00', sktRequired: false, displayOrder: 7,  parentSlug: 'kopek' },
  { name: 'Yataklar',           slug: 'kopek-yataklar',           emoji: '🛏️', vatRate: '20.00', sktRequired: false, displayOrder: 8,  parentSlug: 'kopek' },
  { name: 'Aksesuarlar',        slug: 'kopek-aksesuarlar',        emoji: '🎒', vatRate: '20.00', sktRequired: false, displayOrder: 9,  parentSlug: 'kopek' },
  { name: 'Vitaminler',         slug: 'kopek-vitaminler',         emoji: '💊', vatRate: '20.00', sktRequired: true,  displayOrder: 10, parentSlug: 'kopek' },
  { name: 'Bakım Ürünleri',     slug: 'kopek-bakim-urunleri',     emoji: '🚿', vatRate: '20.00', sktRequired: false, displayOrder: 11, parentSlug: 'kopek' },

  // ====== Kuş alt kategorileri ======
  { name: 'Yemler',     slug: 'kus-yemler',     emoji: '🌾', vatRate: '10.00', sktRequired: true,  displayOrder: 1, parentSlug: 'kus' },
  { name: 'Krakerler',  slug: 'kus-krakerler',  emoji: '🍘', vatRate: '10.00', sktRequired: true,  displayOrder: 2, parentSlug: 'kus' },
  { name: 'Kumlar',     slug: 'kus-kumlar',     emoji: '🪣', vatRate: '20.00', sktRequired: false, displayOrder: 3, parentSlug: 'kus' },
  { name: 'Kafesler',   slug: 'kus-kafesler',   emoji: '🏠', vatRate: '20.00', sktRequired: false, displayOrder: 4, parentSlug: 'kus' },
  { name: 'Oyuncaklar', slug: 'kus-oyuncaklar', emoji: '🎾', vatRate: '20.00', sktRequired: false, displayOrder: 5, parentSlug: 'kus' },
  { name: 'Aksesuarlar',slug: 'kus-aksesuarlar',emoji: '🎒', vatRate: '20.00', sktRequired: false, displayOrder: 6, parentSlug: 'kus' },

  // ====== Akvaryum alt kategorileri ======
  { name: 'Balık Yemi',              slug: 'akvaryum-balik-yemi',            emoji: '🍱', vatRate: '10.00', sktRequired: true,  displayOrder: 1, parentSlug: 'akvaryum' },
  { name: 'Balık Vitamin & Mineral', slug: 'akvaryum-balik-vitamin-mineral', emoji: '💊', vatRate: '20.00', sktRequired: true,  displayOrder: 2, parentSlug: 'akvaryum' },
  { name: 'Akvaryum ve Fanus',       slug: 'akvaryum-ve-fanus',              emoji: '🏺', vatRate: '20.00', sktRequired: false, displayOrder: 3, parentSlug: 'akvaryum' },
  { name: 'Su Düzenleyiciler',       slug: 'akvaryum-su-duzenleyiciler',     emoji: '🧪', vatRate: '20.00', sktRequired: false, displayOrder: 4, parentSlug: 'akvaryum' },
  { name: 'Bakım & Temizlik',        slug: 'akvaryum-bakim-temizlik',        emoji: '🧹', vatRate: '20.00', sktRequired: false, displayOrder: 5, parentSlug: 'akvaryum' },
  { name: 'Aydınlatma',              slug: 'akvaryum-aydinlatma',            emoji: '💡', vatRate: '20.00', sktRequired: false, displayOrder: 6, parentSlug: 'akvaryum' },
  { name: 'Ekipman & Aksesuarlar',   slug: 'akvaryum-ekipman-aksesuarlar',   emoji: '⚙️', vatRate: '20.00', sktRequired: false, displayOrder: 7, parentSlug: 'akvaryum' },
  { name: 'Filtreler',               slug: 'akvaryum-filtreler',             emoji: '🔄', vatRate: '20.00', sktRequired: false, displayOrder: 8, parentSlug: 'akvaryum' },
  { name: 'Isıtma & Soğutma',        slug: 'akvaryum-isitma-sogutma',        emoji: '🌡️', vatRate: '20.00', sktRequired: false, displayOrder: 9, parentSlug: 'akvaryum' },

  // ====== Kemirgen alt kategorileri ======
  { name: 'Yemler',         slug: 'kemirgen-yemler',       emoji: '🌾', vatRate: '10.00', sktRequired: true,  displayOrder: 1, parentSlug: 'kemirgen' },
  { name: 'Kafesler',       slug: 'kemirgen-kafesler',     emoji: '🏠', vatRate: '20.00', sktRequired: false, displayOrder: 2, parentSlug: 'kemirgen' },
  { name: 'Oyuncaklar',     slug: 'kemirgen-oyuncaklar',   emoji: '🎾', vatRate: '20.00', sktRequired: false, displayOrder: 3, parentSlug: 'kemirgen' },
  { name: 'Bakım & Sağlık', slug: 'kemirgen-bakim-saglik', emoji: '🚿', vatRate: '20.00', sktRequired: false, displayOrder: 4, parentSlug: 'kemirgen' },

  // ====== Sürüngen alt kategorileri ======
  { name: 'Sürüngen Yemi',     slug: 'surungenler-yemi',              emoji: '🍃', vatRate: '10.00', sktRequired: true,  displayOrder: 1, parentSlug: 'surungenler' },
  { name: 'Aksesuarlar',       slug: 'surungenler-aksesuarlar',       emoji: '🎒', vatRate: '20.00', sktRequired: false, displayOrder: 2, parentSlug: 'surungenler' },
  { name: 'Taban Malzemeleri', slug: 'surungenler-taban-malzemeleri', emoji: '🪵', vatRate: '20.00', sktRequired: false, displayOrder: 3, parentSlug: 'surungenler' },
];

import type { DbClient } from '@/lib/db/client';
import { categories } from '@/db/schema';

/**
 * Yeni tenant için default 49 kategoriyi seed eder (6 üst + 43 alt).
 *
 * 2-fazlı insert: önce root kategoriler (parent_id=null), slug→id map tutulur;
 * sonra alt kategoriler parent_id ile insert edilir.
 *
 * Idempotent değil — duplicate slug çakışırsa hata. Caller tek seferlik
 * (register sırasında veya manuel seed komutuyla) çağırmalı.
 */
export async function seedDefaultCategoriesForCompany(
  companyId: string,
  db: DbClient,
): Promise<{ inserted: number }> {
  const roots = DEFAULT_CATEGORIES.filter((c) => !c.parentSlug);
  const children = DEFAULT_CATEGORIES.filter((c) => c.parentSlug);

  // Faz 1: root insert — UUID otomatik üretilir, slug → id map için RETURNING
  const rootRows = roots.map((c) => ({
    companyId,
    parentId: null,
    name: c.name,
    slug: c.slug,
    emoji: c.emoji,
    vatRate: c.vatRate,
    sktRequired: c.sktRequired,
    displayOrder: c.displayOrder,
  }));
  const insertedRoots = await db
    .insert(categories)
    .values(rootRows)
    .returning({ id: categories.id, slug: categories.slug });

  const slugToId = new Map<string, string>();
  for (const r of insertedRoots) slugToId.set(r.slug, r.id);

  // Faz 2: children insert — parent UUID resolve
  const childRows = children.map((c) => {
    const parentId = slugToId.get(c.parentSlug!);
    if (!parentId) {
      throw new Error(
        `seedDefaultCategoriesForCompany: parent slug not found for child ${c.slug} (parent=${c.parentSlug})`,
      );
    }
    return {
      companyId,
      parentId,
      name: c.name,
      slug: c.slug,
      emoji: c.emoji,
      vatRate: c.vatRate,
      sktRequired: c.sktRequired,
      displayOrder: c.displayOrder,
    };
  });
  if (childRows.length > 0) {
    await db.insert(categories).values(childRows);
  }

  return { inserted: rootRows.length + childRows.length };
}

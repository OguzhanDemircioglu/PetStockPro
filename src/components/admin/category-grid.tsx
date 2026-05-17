import Link from 'next/link';
import { db } from '@/lib/db/client';
import { listCategories } from '@/lib/categories/manage';

interface Tile {
  slug: string;
  name: string;
  emoji: string;
  className: string;
  fallbackCount: string;
}

/**
 * 6 üst kategori için renkli grid kart tasarımı. Slug'lar
 * DEFAULT_CATEGORIES root'larıyla eşleşmeli.
 */
const TILES: Tile[] = [
  { slug: 'kedi',         name: 'Kedi',     emoji: '🐱', className: 'pt-cat-c1', fallbackCount: '500+ ürün' },
  { slug: 'kopek',        name: 'Köpek',    emoji: '🐶', className: 'pt-cat-c2', fallbackCount: '450+ ürün' },
  { slug: 'kus',          name: 'Kuş',      emoji: '🦜', className: 'pt-cat-c3', fallbackCount: '120+ ürün' },
  { slug: 'akvaryum',     name: 'Akvaryum', emoji: '🐠', className: 'pt-cat-c4', fallbackCount: '180+ ürün' },
  { slug: 'kemirgen',     name: 'Kemirgen', emoji: '🐹', className: 'pt-cat-c5', fallbackCount: '90+ ürün' },
  { slug: 'surungenler',  name: 'Sürüngen', emoji: '🦎', className: 'pt-cat-c6', fallbackCount: '40+ ürün' },
];

interface Props {
  /** Tenant company id — root tile'a tıklayınca o kategorinin edit sayfasına gider. */
  companyId: string;
}

/**
 * AdminCategoryGrid — 6 root kategori için renkli kart grid.
 *
 * Her kart kategorinin alt kategori sayısını gösterir (real-time DB sayım).
 * Tıklanırsa /admin/categories/[id]/edit'e gider — root düzenleme sayfası
 * (yoksa /admin/categories/new'a oluşturma sayfası ile parent=root pre-fill).
 *
 * Tenant'ta o root slug'ı yoksa fallbackCount gösterilir (sade rakam, görsel
 * tutarlılık için).
 */
export async function AdminCategoryGrid({ companyId }: Props) {
  const all = await listCategories(companyId, db);

  // Slug → category id + child count map
  const bySlug = new Map(all.map((c) => [c.slug, c]));
  const childCountBy = new Map<string, number>();
  for (const c of all) {
    if (!c.parentId) continue;
    const parent = all.find((p) => p.id === c.parentId);
    if (!parent) continue;
    childCountBy.set(parent.slug, (childCountBy.get(parent.slug) ?? 0) + 1);
  }

  return (
    <section className="pt-section">
      <div className="pt-section-head">
        <h2 className="pt-section-title">Popüler Kategoriler</h2>
        <Link href={'/admin/categories?view=list' as never} className="pt-section-link">
          Tümünü Gör →
        </Link>
      </div>
      <div className="pt-cat-grid" data-testid="admin-category-grid">
        {TILES.map((tile) => {
          const cat = bySlug.get(tile.slug);
          const childCount = childCountBy.get(tile.slug) ?? 0;
          const href = cat
            ? `/admin/categories/${cat.id}/edit`
            : `/admin/categories/new`;
          const countLabel = cat
            ? childCount > 0
              ? `${childCount} alt kategori`
              : 'Henüz alt yok'
            : tile.fallbackCount;
          return (
            <Link
              key={tile.slug}
              href={href as never}
              className={`pt-cat-card ${tile.className}`}
              data-cat-tile={tile.slug}
              aria-label={`${tile.name} kategorisi`}
            >
              <span className="pt-cat-emoji" aria-hidden="true">
                {tile.emoji}
              </span>
              <span className="pt-cat-name">{tile.name}</span>
              <span className="pt-cat-count">{countLabel}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

import Link from 'next/link';
import type { CategoryListItem } from '@/lib/categories/manage';

interface Props {
  /** Mevcut tenant kategorileri (listCategories sonucu). */
  categories: CategoryListItem[];
  /** Aktif kategori slug'ı (varsa highlight için). */
  activeSlug?: string;
}

/**
 * AdminCategoryBar — Pet projesi CategoryBar yapısının admin versiyonu.
 *
 * Yatay nav + hover/focus-within dropdown. Pet'in public CategoryBar'ıyla
 * aynı CSS sınıfları kullanılır (.pt-cat-bar / .pt-cat-nav-btn / .pt-cat-dropdown).
 * Link target: admin edit sayfası — root tıklanırsa root'u düzenle,
 * dropdown'daki child tıklanırsa child'ı düzenle.
 */
export function AdminCategoryBar({ categories, activeSlug }: Props) {
  const roots = categories.filter((c) => !c.parentId);
  const childrenOf = (parentId: string) =>
    categories.filter((c) => c.parentId === parentId);

  if (roots.length === 0) return null;

  return (
    <nav className="pt-cat-bar" aria-label="Kategoriler">
      <div className="pt-cat-bar-inner">
        <div className="pt-cat-nav">
          {roots.map((root) => {
            const children = childrenOf(root.id);
            const isActive =
              activeSlug === root.slug ||
              children.some((c) => c.slug === activeSlug);
            return (
              <div
                key={root.id}
                className="pt-cat-nav-item"
                data-active={isActive ? 'true' : 'false'}
                data-cat-root={root.slug}
              >
                <Link
                  href={`/admin/categories/${root.id}/edit` as never}
                  className="pt-cat-nav-btn"
                  aria-haspopup={children.length > 0 ? 'menu' : undefined}
                >
                  {root.emoji && <span aria-hidden="true">{root.emoji}</span>}
                  {root.name}
                  {children.length > 0 && (
                    <span className="pt-cat-arrow" aria-hidden="true">
                      ▼
                    </span>
                  )}
                </Link>
                {children.length > 0 && (
                  <div className="pt-cat-dropdown" role="menu">
                    {children.map((child) => (
                      <Link
                        key={child.id}
                        href={`/admin/categories/${child.id}/edit` as never}
                        className="pt-drop-item"
                        role="menuitem"
                        data-cat-child={child.slug}
                      >
                        {child.emoji && (
                          <span aria-hidden="true">{child.emoji}</span>
                        )}
                        <span>{child.name}</span>
                        {child.productCount > 0 && (
                          <span className="pt-drop-item-count">
                            {child.productCount}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

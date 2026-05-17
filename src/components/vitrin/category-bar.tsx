import Link from 'next/link';
import { db } from '@/lib/db/client';
import { listCategoryNavTree } from '@/lib/vitrin/category-listings';

interface Props {
  /** Mevcut sayfanın aktif slug'ı (root ya da child) — highlight için. */
  activeSlug?: string;
}

/**
 * Vitrin yatay kategori nav — hover dropdown ile 2-seviyeli yapı.
 *
 * Server component: listCategoryNavTree ile DB'den 6 root + her root altındaki
 * alt kategoriler + ürün sayısı. CSS sınıfları `pt-cat-*` globals.css'te
 * tanımlı (hover/focus-within ile dropdown açılır).
 *
 * Accessibility: nav[aria-label], menu role, menuitem role + aria-haspopup.
 */
export async function VitrinCategoryBar({ activeSlug }: Props) {
  const roots = await listCategoryNavTree(db);
  if (roots.length === 0) return null;

  return (
    <nav className="pt-cat-bar" aria-label="Kategoriler">
      <div className="pt-cat-bar-inner">
        <div className="pt-cat-nav">
          {roots.map((root) => {
            const hasChildren = root.children.length > 0;
            const isActive =
              activeSlug === root.slug ||
              root.children.some((c) => c.slug === activeSlug);
            return (
              <div
                key={root.slug}
                className="pt-cat-nav-item"
                data-active={isActive ? 'true' : 'false'}
                data-cat-root={root.slug}
              >
                <Link
                  href={`/vitrin/kategori/${root.slug}` as never}
                  className="pt-cat-nav-btn"
                  aria-haspopup={hasChildren ? 'menu' : undefined}
                >
                  {root.emoji && <span aria-hidden="true">{root.emoji}</span>}
                  {root.name}
                  {hasChildren && (
                    <span className="pt-cat-arrow" aria-hidden="true">
                      ▼
                    </span>
                  )}
                </Link>
                {hasChildren && (
                  <div className="pt-cat-dropdown" role="menu">
                    {root.children.map((child) => (
                      <Link
                        key={child.slug}
                        href={`/vitrin/kategori/${child.slug}` as never}
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

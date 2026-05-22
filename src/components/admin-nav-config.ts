/**
 * Paylaşılan admin navigation config.
 *
 * AdminSidebar (desktop), AdminMobileDrawer (mobile slide-in), AdminBottomTabs
 * (mobile sticky bottom) bu config'den okuyor — tek kaynak.
 *
 * BottomTab "Daha" sekmesi drawer'ı açar; drawer'da tüm group'lar mevcut.
 */

export interface SidebarLink {
  label: string;
  icon?: string;
  href: string;
  badge?: number;
  badgeTone?: 'cat' | 'danger' | 'arrow';
  /** Aktif eşleşme için prefix (mevcut href değişirse override edebilir). */
  match?: string;
}

export interface SidebarGroup {
  label?: string;
  links: SidebarLink[];
}

export interface BottomTabSpec {
  label: string;
  icon: string;
  href?: string;
  match?: string;
  /** Drawer açan özel sekme (genelde "Daha"). */
  isMore?: boolean;
  /** Badge sayısını runtime'da inject etmek için key. */
  badgeKey?: 'lowStock' | 'notifications';
}

interface BuildOptions {
  lowStockCount: number;
  unreadNotifications?: number;
  isSuperadmin: boolean;
}

export function buildSidebarGroups({
  lowStockCount,
  unreadNotifications,
  isSuperadmin,
}: BuildOptions): SidebarGroup[] {
  const groups: SidebarGroup[] = [
    {
      links: [
        { icon: '📊', label: 'Pano', href: '/admin', match: '/admin' },
        { icon: '🤖', label: "AI'ya Sor", href: '/admin/ai' },
      ],
    },
    {
      label: 'Envanter',
      links: [
        { icon: '🛍', label: 'Ürünler', href: '/admin/products' },
        { icon: '📦', label: 'Hareketler', href: '/admin/stock-movements' },
        {
          icon: '⚠',
          label: 'Düşük Stok',
          href: '/admin/low-stock',
          badge: lowStockCount > 0 ? lowStockCount : undefined,
          badgeTone: 'danger',
        },
        { icon: '📋', label: 'Sayım', href: '/admin/stocktake' },
      ],
    },
    {
      label: 'Kaynaklar',
      links: [
        { icon: '🏢', label: 'Tedarikçiler', href: '/admin/suppliers' },
        { icon: '🏪', label: 'Şubeler', href: '/admin/branches' },
        { icon: '🏷', label: 'Markalar', href: '/admin/brands' },
        { icon: '📂', label: 'Kategoriler', href: '/admin/categories' },
      ],
    },
    {
      label: 'Analiz',
      links: [
        { icon: '📈', label: 'Raporlar', href: '/admin/reports' },
        { icon: '📜', label: 'Audit Log', href: '/admin/audit-log' },
        {
          icon: '🔔',
          label: 'Bildirimler',
          href: '/admin/notifications',
          badge: unreadNotifications && unreadNotifications > 0 ? unreadNotifications : undefined,
          badgeTone: 'cat',
        },
      ],
    },
    {
      label: 'Hesap',
      links: [
        { icon: '⚙', label: 'Ayarlar', href: '/admin/settings' },
        { icon: '🌐', label: 'Vitrin Profili', href: '/admin/settings/storefront' },
        { icon: '👤', label: 'Hesabım', href: '/admin/account' },
        { icon: '🛡', label: 'Güvenlik', href: '/admin/security' },
      ],
    },
  ];

  if (isSuperadmin) {
    groups.push({
      label: '🛡 Süperadmin',
      links: [
        { icon: '🏬', label: "Tenant'lar", href: '/admin/superadmin' },
        { icon: '🔍', label: 'Vitrin Moderasyon', href: '/admin/superadmin/vitrin-moderation' },
        { icon: '🗄', label: 'DB Inspector', href: '/admin/superadmin/db-inspector' },
        { icon: '🔧', label: 'Sistem Ayarları', href: '/admin/superadmin/system-settings' },
      ],
    });
  }

  return groups;
}

/** Mobile bottom tab bar — 5 kritik shortcut + "Daha" (drawer aç). */
export const BOTTOM_TABS: BottomTabSpec[] = [
  { icon: '📊', label: 'Pano', href: '/admin', match: '/admin' },
  { icon: '🛍', label: 'Ürünler', href: '/admin/products' },
  { icon: '📦', label: 'Hareket', href: '/admin/stock-movements' },
  { icon: '🔔', label: 'Bildirim', href: '/admin/notifications', badgeKey: 'notifications' },
  { icon: '☰', label: 'Daha', isMore: true },
];

/** Bir link aktif mi? Pano (/admin) tam eşleşme, diğerleri prefix. */
export function isLinkActive(pathname: string, link: { href?: string; match?: string }): boolean {
  if (!link.href && !link.match) return false;
  const match = link.match ?? link.href!;
  if (match === '/admin') {
    return pathname === '/admin';
  }
  return pathname === match || pathname.startsWith(`${match}/`);
}

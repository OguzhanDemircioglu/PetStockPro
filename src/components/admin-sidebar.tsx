'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

interface SidebarLink {
  label: string;
  href: string;
  badge?: number;
  badgeTone?: 'cat' | 'danger' | 'arrow';
  /** Aktif eşleşme için prefix (mevcut href değişirse override edebilir). */
  match?: string;
}

interface SidebarGroup {
  label?: string;
  links: SidebarLink[];
}

interface Props {
  tenantName: string;
  plan: 'FREE' | 'PRO' | 'PRO_PLUS';
  productCount: number;
  productLimit: number;
  lowStockCount: number;
  isSuperadmin: boolean;
}

export function AdminSidebar({
  tenantName,
  plan,
  productCount,
  productLimit,
  lowStockCount,
  isSuperadmin,
}: Props) {
  const pathname = usePathname();

  const planLabel: Record<typeof plan, string> = {
    FREE: 'FREE',
    PRO: 'PRO',
    PRO_PLUS: 'PRO+',
  };
  const planLimitLabel = productLimit === 0 ? '∞' : String(productLimit);
  const usagePct =
    productLimit > 0 ? Math.min(100, (productCount / productLimit) * 100) : 0;
  const isNearLimit = productLimit > 0 && usagePct >= 80;

  const groups: SidebarGroup[] = [
    {
      links: [{ label: '📊 Pano', href: '/admin', match: '/admin' }],
    },
    {
      label: 'Envanter',
      links: [
        { label: '🐾 Ürünler', href: '/admin/products' },
        { label: '📦 Hareketler', href: '/admin/stock-movements' },
        {
          label: '⚠ Düşük stok',
          href: '/admin/low-stock',
          badge: lowStockCount > 0 ? lowStockCount : undefined,
          badgeTone: 'danger',
        },
        { label: '📋 Sayım', href: '/admin/stocktake' },
      ],
    },
    {
      label: 'Kaynaklar',
      links: [
        { label: '🏢 Tedarikçiler', href: '/admin/suppliers' },
        { label: '🏪 Şubeler', href: '/admin/branches' },
        { label: '🏷 Markalar', href: '/admin/brands' },
        { label: '📂 Kategoriler', href: '/admin/categories' },
      ],
    },
    {
      label: 'Analiz',
      links: [
        { label: '📈 Raporlar', href: '/admin/reports' },
        { label: '📜 Audit log', href: '/admin/audit-log' },
        { label: '🔔 Bildirimler', href: '/admin/notifications' },
      ],
    },
    {
      label: '🏪 Vitrin',
      links: [
        { label: '🌐 Vitrin profili', href: '/admin/settings/storefront' },
      ],
    },
    {
      label: 'Hesap',
      links: [
        { label: '⚙ Ayarlar', href: '/admin/settings' },
        { label: '👤 Hesabım', href: '/admin/account' },
        { label: '🛡 Güvenlik', href: '/admin/security' },
      ],
    },
  ];

  if (isSuperadmin) {
    groups.push({
      label: '🛡 Süperadmin',
      links: [
        { label: 'Tenant\'lar', href: '/admin/superadmin' },
        { label: 'Vitrin moderasyon', href: '/admin/superadmin/vitrin-moderation' },
        { label: 'DB Inspector', href: '/admin/superadmin/db-inspector' },
        { label: 'Sistem ayarları', href: '/admin/superadmin/system-settings' },
      ],
    });
  }

  return (
    <aside
      data-testid="admin-sidebar"
      className="sticky top-0 hidden h-screen w-[220px] shrink-0 flex-col overflow-y-auto border-r border-line bg-white/95 px-3 py-5 backdrop-blur md:flex"
    >
      {/* Brand */}
      <Link
        href={'/admin' as never}
        className="mb-5 flex items-center gap-3 rounded-xl px-1 py-1 hover:bg-line-soft"
        data-testid="sidebar-brand"
      >
        <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-cat-soft">
          <Image
            src="/logo.png"
            alt="PetStockPro"
            width={36}
            height={36}
            className="object-contain"
          />
        </span>
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-cart">
            PetStockPro
          </div>
          <div className="truncate text-[10.5px] text-ink-3">{tenantName}</div>
        </div>
      </Link>

      {/* Nav groups */}
      <nav className="flex flex-col gap-4 text-[12px]" data-testid="sidebar-nav">
        {groups.map((g, gi) => (
          <div key={gi} className="flex flex-col gap-0.5">
            {g.label && (
              <div className="mb-1 px-2 text-[9.5px] font-bold uppercase tracking-[0.08em] text-ink-4">
                {g.label}
              </div>
            )}
            {g.links.map((link) => {
              const match = link.match ?? link.href;
              const active =
                match === '/admin'
                  ? pathname === '/admin'
                  : pathname === match || pathname.startsWith(`${match}/`);
              const badgeToneCls: Record<string, string> = {
                cat: 'bg-cat text-white',
                danger: 'bg-danger text-white',
                arrow: 'bg-arrow text-white',
              };
              return (
                <Link
                  key={link.href}
                  href={link.href as never}
                  data-sidebar-link={link.href}
                  data-active={active ? '1' : '0'}
                  className={
                    active
                      ? 'flex items-center gap-2 rounded-lg bg-gradient-to-r from-cat to-cat-2 px-2.5 py-2 font-bold text-white shadow-[0_4px_12px_rgba(212,74,20,.25)]'
                      : 'flex items-center gap-2 rounded-lg px-2.5 py-2 font-bold text-ink-2 hover:bg-line-soft hover:text-cart'
                  }
                >
                  <span className="flex-1 truncate">{link.label}</span>
                  {link.badge !== undefined && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-bold ${badgeToneCls[link.badgeTone ?? 'cat']}`}
                    >
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Plan card */}
      <div
        data-testid="sidebar-plan-card"
        className={`mt-5 rounded-2xl border p-3 ${
          isNearLimit
            ? 'border-cat/40 bg-cat-soft/40'
            : 'border-line bg-line-soft/30'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-3">
            Plan
          </span>
          <span className="rounded-full bg-cat px-2 py-0.5 text-[10px] font-bold text-white">
            {planLabel[plan]}
          </span>
        </div>
        <div className="mt-2 flex items-baseline justify-between text-[11px]">
          <span className="text-ink-3">Ürün limiti</span>
          <span className="font-mono font-bold text-cart">
            {productCount} / {planLimitLabel}
          </span>
        </div>
        {productLimit > 0 && (
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line-soft">
            <div
              className={isNearLimit ? 'h-full bg-cat' : 'h-full bg-arrow'}
              style={{ width: `${usagePct}%` }}
            />
          </div>
        )}
        {plan === 'FREE' && (
          <Link
            href={'/admin/settings' as never}
            className="mt-2 block rounded-lg bg-cart px-2 py-1.5 text-center text-[10.5px] font-bold text-white hover:bg-cart-2"
          >
            PRO&apos;ya geç →
          </Link>
        )}
      </div>

      {/* Footer mini */}
      <p className="mt-4 text-center text-[9px] text-ink-4">
        © 2026 PetStockPro
      </p>
    </aside>
  );
}

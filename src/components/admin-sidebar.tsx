'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { AnimatedShinyText } from './magicui/animated-shiny-text';
import { buildSidebarGroups, isLinkActive } from './admin-nav-config';

interface Props {
  tenantName: string;
  plan: 'FREE' | 'PRO' | 'PRO_PLUS';
  productCount: number;
  productLimit: number;
  lowStockCount: number;
  unreadNotifications?: number;
  isSuperadmin: boolean;
  isImpersonating?: boolean;
}

export function AdminSidebar({
  tenantName,
  plan,
  productCount,
  productLimit,
  lowStockCount,
  unreadNotifications = 0,
  isSuperadmin,
  isImpersonating = false,
}: Props) {
  const pathname = usePathname();

  // Tenant adından "Pet Shop"/"Petshop" suffix'i her zaman strip edilir (case insensitive,
  // boşluklu/boşluksuz). Alt satırda "Pet Shop" sabit etiket — kullanıcı ister yazmış
  // ister yazmamış olsun her tenant'ta görünür.
  const petShopMatch = tenantName.match(/^(.+?)\s*(pet\s*shop|petshop)\s*$/i);
  const displayName = petShopMatch ? petShopMatch[1].trim() : tenantName;

  const planLabel: Record<typeof plan, string> = {
    FREE: 'FREE',
    PRO: 'PRO',
    PRO_PLUS: 'PRO+',
  };
  const planLimitLabel = productLimit === 0 ? '∞' : String(productLimit);
  const usagePct =
    productLimit > 0 ? Math.min(100, (productCount / productLimit) * 100) : 0;
  const isNearLimit = productLimit > 0 && usagePct >= 80;
  // SUPERADMIN kendi bağlamında (impersonation OFF) bir tenant değil — kendine ait
  // plan/abonelik kartı gösterilmez. Impersonation aktifse o tenant'ın planı görünür.
  const showPlanCard = !isSuperadmin || isImpersonating;

  const groups = buildSidebarGroups({
    lowStockCount,
    unreadNotifications,
    isSuperadmin,
    isImpersonating,
  });

  return (
    <aside
      data-testid="admin-sidebar"
      className="sticky top-0 hidden h-screen w-[220px] shrink-0 flex-col border-r border-line bg-paper/75 px-3 pb-5 backdrop-blur-xl md:flex"
    >
      {/* Brand — Pano başlığı hizasında shiny header + altında icon + tenant adı */}
      <Link
        href={'/admin' as never}
        className="-mx-3 mb-4 block shrink-0"
        data-testid="sidebar-brand"
      >
        {/* Üst: PetStockPro shiny — 66px header içinde dikey ortada */}
        <div className="flex h-[66px] items-center justify-center border-b border-line px-3 transition-colors hover:bg-line-soft/50">
          <div
            data-testid="sidebar-brand-title"
            className="text-[22px] font-bold leading-none tracking-tight text-cart"
          >
            <AnimatedShinyText>PetStockPro</AnimatedShinyText>
          </div>
        </div>
        {/* Alt: icon + tenant adı dikey istif */}
        <div className="flex flex-col items-center gap-3 px-2 py-4 text-center transition-colors hover:bg-line-soft/50">
          <Image
            src="/logo.webp"
            alt="PetStockPro"
            width={180}
            height={180}
            className="h-44 w-44 object-contain"
            priority
          />
          <div
            data-testid="sidebar-tenant-name"
            className="flex w-full flex-col items-center gap-0.5"
            title={tenantName}
          >
            <div className="w-full break-words text-[18px] font-bold leading-tight tracking-tight text-cart">
              <AnimatedShinyText>{displayName}</AnimatedShinyText>
            </div>
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3">
              <AnimatedShinyText>Pet Shop</AnimatedShinyText>
            </div>
          </div>
        </div>
      </Link>

      {/* Nav groups — kaydırılabilir orta alan (plan kartı + footer dipte sabit kalsın) */}
      <nav
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto text-[13.5px]"
        data-testid="sidebar-nav"
      >
        {groups.map((g, gi) => (
          <div key={gi} className="flex flex-col gap-0.5">
            {g.label && (
              <div className="mb-1 px-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-4">
                {g.label}
              </div>
            )}
            {g.links.map((link) => {
              const active = isLinkActive(pathname, link);
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
                  <span
                    aria-hidden
                    className="inline-flex w-5 shrink-0 items-center justify-center text-center leading-none"
                  >
                    {link.icon ?? ''}
                  </span>
                  <span className="flex-1 truncate">{link.label}</span>
                  {link.badge !== undefined && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${badgeToneCls[link.badgeTone ?? 'cat']}`}
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

      {/* Plan card — gradient cart bg, dark-safe (white text fixed).
          Tüm kart tıklanabilir → /admin/settings/billing (abonelik planları).
          shrink-0 + nav flex-1 sayesinde her zaman dipte ve görünür kalır.
          SUPERADMIN kendi bağlamında (impersonation OFF) tenant değil → gizli. */}
      {showPlanCard && (
      // Tam sayfa geçişi kasıtlı: /admin/settings/billing PayTR iframe için gevşek CSP
      // header'ı taşır (bkz. next.config.ts). Next.js <Link> client-side navigasyon
      // yaptığı için tarayıcı bu sayfaya geçerken header'ı yeniden çekmez ve sıkı CSP'yi
      // korumaya devam eder → PayTR iframe ERR_BLOCKED_BY_CSP ile bloklanır.
      <a
        href="/admin/settings/billing"
        data-testid="sidebar-plan-card"
        className="group relative mt-3 block shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-cart to-cart-7 p-3.5 text-white shadow-[0_8px_24px_rgba(26,85,136,.32)] transition-transform hover:-translate-y-0.5"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-5 -bottom-5 h-24 w-24 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(212,74,20,.4), transparent 60%)',
          }}
        />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="text-[11.5px] font-bold uppercase tracking-wider opacity-75">
              PLAN
            </div>
            <div className="mt-0.5 text-base font-bold tracking-tight">
              {planLabel[plan]}
            </div>
          </div>
          {isNearLimit && (
            <span className="rounded-full bg-cat px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider shadow-sm">
              limit
            </span>
          )}
        </div>
        <div className="relative mt-2.5">
          <div className="mb-1 flex justify-between text-[12.5px] font-bold opacity-90">
            <span>Ürün limiti</span>
            <span className="font-mono tabular-nums">
              {productCount} / {planLimitLabel}
            </span>
          </div>
          {productLimit > 0 ? (
            <div className="h-1.5 overflow-hidden rounded-full bg-white/16">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cat-2 to-cat"
                style={{ width: `${usagePct}%` }}
              />
            </div>
          ) : (
            <div className="h-1.5 rounded-full bg-gradient-to-r from-arrow to-arrow-2" />
          )}
        </div>
        {/* CTA — her planda görünür "buton" */}
        <span className="relative mt-3 block rounded-[9px] bg-white/18 px-2.5 py-2 text-center text-[13px] font-bold text-white transition-colors group-hover:bg-white/30">
          {plan === 'FREE' ? "PRO'ya geç →" : 'Aboneliği yönet →'}
        </span>
      </a>
      )}

      {/* Footer mini */}
      <p className="mt-3 shrink-0 text-center text-[10.5px] text-ink-4">
        © 2026 PetStockPro
      </p>
    </aside>
  );
}

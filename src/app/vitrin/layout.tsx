import Link from 'next/link';
import Image from 'next/image';
import { VitrinAdminReturnLink } from './admin-return-link';
import { VitrinCategoryBar } from '@/components/vitrin/category-bar';
import { CookieBanner } from './cookie-banner';

/**
 * /vitrin/* public layout — auth yok, üst bar + footer.
 *
 * Pet shop merkezi dizini. Sahibinden / Yelp modeli.
 *
 * VitrinAdminReturnLink: sadece login admin/staff/superadmin'e görünür
 * (server-side `auth()` check, anonim ziyaretçi için null render — auth state
 * sızıntısı yok). Detay: admin-return-link.tsx içindeki güvenlik notları.
 */
export default function VitrinLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-paper to-cat-soft/10">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur supports-[backdrop-filter]:bg-paper/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {/* Sadece login admin/staff/süperadmin: ← Admin paneli */}
            <VitrinAdminReturnLink />
            <Link
              href={'/vitrin' as never}
              className="flex min-w-0 items-center gap-2.5 text-cart sm:gap-3"
              data-testid="vitrin-logo"
            >
              <Image
                src="/logo.webp"
                alt="PetStockPro"
                width={48}
                height={48}
                className="h-10 w-10 shrink-0 object-contain sm:h-12 sm:w-12"
                priority
              />
              <span className="hidden truncate text-[18px] font-bold leading-tight sm:inline sm:text-[21px]">
                PetStockPro <span className="text-cat">Vitrin</span>
              </span>
            </Link>
          </div>
          <nav className="flex shrink-0 items-center gap-2 text-[15px] sm:gap-2.5 sm:text-[16px]">
            <Link
              href={'/vitrin/harita' as never}
              title="Tüm pet shop'lar — harita"
              className="rounded-xl border border-line bg-paper px-3 py-2 font-bold text-cart hover:bg-cat-soft sm:px-3.5"
            >
              <span aria-hidden>📍</span>
              <span className="ml-1.5 hidden sm:inline">Tüm pet shop&apos;lar</span>
            </Link>
            <Link
              href={(process.env.NEXT_PUBLIC_STAGING_MODE === 'true' ? '/yapim-asamasinda' : '/login') as never}
              title="Pet shop sahibi girişi"
              className="rounded-xl bg-cat px-3 py-2 font-bold text-white hover:bg-cat-2 sm:px-3.5"
            >
              <span aria-hidden>🏪</span>
              <span className="ml-1.5 hidden sm:inline">Pet shop sahibiyim</span>
              <span className="ml-1.5 inline sm:hidden">Giriş</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* Yatay kategori bar (server component, hover dropdown ile 2-seviyeli) */}
      <VitrinCategoryBar />

      {children}

      <footer
        data-testid="vitrin-footer"
        className="mt-16 border-t border-line bg-paper"
      >
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          {/* Brand kolonu */}
          <div>
            <div className="flex items-center gap-2">
              <Image
                src="/logo.webp"
                alt="PetStockPro"
                width={36}
                height={36}
                className="h-9 w-9 object-contain"
              />
              <div>
                <div className="text-[15px] font-bold leading-tight text-cart">
                  PetStockPro
                </div>
                <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-3">
                  Vitrin
                </div>
              </div>
            </div>
            <p className="mt-3 max-w-xs text-[13px] leading-snug text-ink-3">
              Türkiye&apos;nin pet shop&apos;larını tek vitrin&apos;de
              buluşturuyoruz. Yakınındakini bul, WhatsApp&apos;tan yaz, gel al.
            </p>
            <p className="mt-3 text-[11.5px] text-ink-4">
              🔒 IP&apos;ler anonim hash&apos;lenir · KVKK uyumlu
            </p>
          </div>

          {/* Vitrin kolonu */}
          <div>
            <h4 className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.12em] text-cart">
              Vitrin
            </h4>
            <ul className="flex flex-col gap-1.5 text-[13px] text-ink-2">
              <li>
                <Link href={'/vitrin' as never} className="hover:text-cat">
                  Tüm Pet Shop&apos;lar
                </Link>
              </li>
              <li>
                <Link
                  href={'/vitrin#vitrin-category-chips' as never}
                  className="hover:text-cat"
                >
                  Kategoriler
                </Link>
              </li>
              <li>
                <Link
                  href={'/vitrin#vitrin-city-grid' as never}
                  className="hover:text-cat"
                >
                  Şehirler
                </Link>
              </li>
              <li>
                <Link
                  href={'/vitrin#vitrin-popular-products' as never}
                  className="hover:text-cat"
                >
                  Popüler Ürünler
                </Link>
              </li>
            </ul>
          </div>

          {/* Pet shop'lar için kolonu */}
          <div>
            <h4 className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.12em] text-cart">
              Pet Shop&apos;lar İçin
            </h4>
            <ul className="flex flex-col gap-1.5 text-[13px] text-ink-2">
              <li>
                <Link href={'/register' as never} className="hover:text-cat">
                  Ücretsiz Başla
                </Link>
              </li>
              <li>
                <Link href={'/login' as never} className="hover:text-cat">
                  Giriş Yap
                </Link>
              </li>
              <li>
                <span className="text-ink-4">Vitrin Rehberi (yakında)</span>
              </li>
              <li>
                <span className="text-ink-4">Yardım Merkezi (yakında)</span>
              </li>
            </ul>
          </div>

          {/* Hakkımızda kolonu */}
          <div>
            <h4 className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.12em] text-cart">
              Hakkımızda
            </h4>
            <ul className="flex flex-col gap-1.5 text-[13px] text-ink-2">
              <li>
                <span className="text-ink-4">Biz Kimiz (yakında)</span>
              </li>
              <li>
                <Link href="/contact" className="hover:text-cat">
                  İletişim
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="hover:text-cat">
                  KVKK
                </Link>
              </li>
              <li>
                <Link href="/terms-of-service" className="hover:text-cat">
                  Kullanım Koşulları
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer bottom */}
        <div className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-[12px] text-ink-3">
            <span>
              © {new Date().getFullYear()} PetStockPro · Tüm hakları saklıdır
            </span>
            <nav className="flex gap-3">
              <Link href="/privacy-policy" className="hover:text-cart">
                KVKK
              </Link>
              <span aria-hidden className="text-ink-4">
                ·
              </span>
              <Link href="/cookie-policy" className="hover:text-cart">
                Çerezler
              </Link>
              <span aria-hidden className="text-ink-4">
                ·
              </span>
              <Link href="/privacy-policy" className="hover:text-cart">
                Gizlilik
              </Link>
            </nav>
          </div>
        </div>
      </footer>

      <CookieBanner />
    </div>
  );
}

import Link from 'next/link';
import Image from 'next/image';

/**
 * MarketingHeader — public sayfaların üst menüsü.
 *
 * Login linki sağda CTA gibi. Mobile'da hamburger değil link-only (sade).
 */
export function MarketingHeader() {
  return (
    <header
      className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur"
      data-testid="marketing-header"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo.webp"
            width={28}
            height={28}
            alt="PetStockPro"
            className="rounded-lg"
          />
          <span className="text-[15.5px] font-bold tracking-tight text-cart">
            PetStockPro
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-[13.5px] font-bold text-ink-2 sm:gap-4">
          <Link
            href="/fiyatlar"
            className="hidden rounded-lg px-2 py-1.5 hover:bg-line-soft hover:text-cart sm:inline-block"
          >
            Fiyatlar
          </Link>
          <Link
            href="/contact"
            className="hidden rounded-lg px-2 py-1.5 hover:bg-line-soft hover:text-cart sm:inline-block"
          >
            İletişim
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-line bg-paper px-3 py-1.5 hover:border-cat hover:text-cart"
          >
            Giriş
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-gradient-to-br from-cat to-cat-2 px-3 py-1.5 text-white shadow-sm hover:-translate-y-px transition-transform"
          >
            Ücretsiz başla
          </Link>
        </nav>
      </div>
    </header>
  );
}

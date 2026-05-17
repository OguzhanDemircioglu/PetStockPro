import Link from 'next/link';

/**
 * /vitrin/* public layout — auth yok, üst bar + footer.
 *
 * Pet shop merkezi dizini. Sahibinden / Yelp modeli.
 */
export default function VitrinLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-paper to-cat-soft/10">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur supports-[backdrop-filter]:bg-paper/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link
            href={'/vitrin' as never}
            className="flex items-center gap-2 text-cart"
            data-testid="vitrin-logo"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-cat text-lg text-white shadow-sm">
              🐾
            </span>
            <span className="text-base font-bold leading-tight">
              PetStockPro <span className="text-cat">Vitrin</span>
            </span>
          </Link>
          <nav className="flex flex-wrap items-center gap-2 text-[12.5px]">
            <Link
              href={'/vitrin' as never}
              className="rounded-xl border border-line bg-paper px-3 py-1.5 font-bold text-cart hover:bg-cat-soft"
            >
              📍 Tüm pet shop&apos;lar
            </Link>
            <Link
              href={'/login' as never}
              className="rounded-xl bg-cat px-3 py-1.5 font-bold text-white hover:bg-cat-2"
            >
              🏪 Pet shop sahibiyim
            </Link>
          </nav>
        </div>
      </header>

      {children}

      <footer className="border-t border-line bg-paper py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 text-[11.5px] text-ink-3">
          <span>
            © {new Date().getFullYear()} PetStockPro — Pet shop merkezi vitrin
            dizini.
          </span>
          <nav className="flex gap-3">
            <Link href={'/login' as never} className="hover:text-cart">
              Pet shop ekle
            </Link>
            <span aria-hidden>·</span>
            <span className="text-ink-4">
              KVKK uyumlu — IP&apos;ler anonim hash&apos;lenir
            </span>
          </nav>
        </div>
      </footer>
    </div>
  );
}

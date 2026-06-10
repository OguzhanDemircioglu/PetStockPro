import Link from 'next/link';

/**
 * MarketingFooter — public sayfaların alt menüsü.
 *
 * PayTR üye işyeri başvuru gereği: yasal sayfa linkleri + firma bilgileri
 * tüm public sayfalarda erişilebilir olmalı.
 *
 * NOT: Firma bilgileri (VKN, MERSİS, adres) şirket kuruluş sonrası
 * `legal.ts` env'lerinden veya CMS'den dolacak. Şu an placeholder.
 */
export function MarketingFooter() {
  return (
    <footer
      className="border-t border-line bg-line-soft/40"
      data-testid="marketing-footer"
    >
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 text-cart">
            <span className="text-lg font-bold">🐾 PetStockPro</span>
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-3">
            Pet shop&apos;lar için stok + satış + vitrin yönetim platformu.
            Tek panelden 50-1500 ürün arası kolay yönetim.
          </p>
        </div>

        <div>
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-cat">
            Platform
          </h3>
          <ul className="mt-3 flex flex-col gap-2 text-[13px] text-ink-2">
            <li>
              <Link href="/fiyatlar" className="hover:text-cart">
                Fiyatlar
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-cart">
                Giriş yap
              </Link>
            </li>
            <li>
              <Link href="/register" className="hover:text-cart">
                Pet shop&apos;unu ekle
              </Link>
            </li>
            <li>
              <Link href="/vitrin" className="hover:text-cart">
                🏪 Vitrin
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-cat">
            Yasal
          </h3>
          <ul className="mt-3 flex flex-col gap-2 text-[13px] text-ink-2">
            <li>
              <Link href="/kvkk" className="hover:text-cart">
                KVKK Aydınlatma Metni
              </Link>
            </li>
            <li>
              <Link href="/cerez-politikasi" className="hover:text-cart">
                Çerez Politikası
              </Link>
            </li>
            <li>
              <Link href="/uyelik-sozlesmesi" className="hover:text-cart">
                Üyelik Sözleşmesi
              </Link>
            </li>
            <li>
              <Link href="/mesafeli-satis-sozlesmesi" className="hover:text-cart">
                Mesafeli Satış Sözleşmesi
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-cat">
            İletişim
          </h3>
          <ul className="mt-3 flex flex-col gap-2 text-[13px] text-ink-2">
            <li>
              <Link href="/iletisim" className="hover:text-cart">
                İletişim formu
              </Link>
            </li>
            <li>
              <a
                href="mailto:destek@petstockpro.com"
                className="hover:text-cart"
              >
                destek@petstockpro.com
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line bg-paper">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-4 text-[11.5px] text-ink-4">
          <span>
            © {new Date().getFullYear()} PetStockPro. Tüm hakları saklıdır.
          </span>
          <span className="flex items-center gap-3">
            <span>⚡ Cloudflare Workers</span>
            <span>🔒 KVKK uyumlu</span>
          </span>
        </div>
      </div>
    </footer>
  );
}

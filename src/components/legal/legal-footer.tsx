import Link from 'next/link';
import { getLegalCompanyInfo } from '@/lib/company/legal-info';

/**
 * LegalFooter — sade yasal footer.
 *
 * İki yerde kullanılır:
 *   1. Bayi admin panelinin en altı (AdminShell) — aşağı inince görünür.
 *   2. Public yasal belge sayfaları (KVKK, mesafeli satış, iade vb.).
 *
 * Marketing footer'ının (marketing/footer.tsx) "landing" görünümlü şişkin
 * hali değil; sadece yasal belge linkleri + iletişim + telif. Marketing
 * sitesi olmadığı için (2026-06-12 landing kaldırıldı) panelin altında bu
 * sade footer durur.
 */
export function LegalFooter() {
  const company = getLegalCompanyInfo();
  const year = new Date().getFullYear();

  return (
    <footer
      className="mt-8 border-t border-line bg-line-soft/30 px-4 py-6 sm:px-6"
      data-testid="legal-footer"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-ink-3">
          <Link href="/privacy-policy" className="hover:text-cat">
            KVKK
          </Link>
          <Link href="/cookie-policy" className="hover:text-cat">
            Çerez Politikası
          </Link>
          <Link href="/terms-of-service" className="hover:text-cat">
            Üyelik Sözleşmesi
          </Link>
          <Link href="/distance-sales-agreement" className="hover:text-cat">
            Mesafeli Satış
          </Link>
          <Link href="/return-policy" className="hover:text-cat">
            İade Politikası
          </Link>
          <Link href="/delivery-terms" className="hover:text-cat">
            Teslimat Koşulları
          </Link>
          <Link href="/contact" className="hover:text-cat">
            İletişim
          </Link>
        </nav>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-4">
          <a href={`mailto:${company.supportEmail}`} className="hover:text-cat">
            {company.supportEmail}
          </a>
          <span aria-hidden>·</span>
          <span>© {year} PetStockPro</span>
        </div>
      </div>
    </footer>
  );
}

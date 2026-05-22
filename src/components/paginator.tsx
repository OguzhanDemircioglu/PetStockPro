import Link from 'next/link';
import { buildPageUrl, type PageMeta } from '@/lib/utils/pagination';

interface PaginatorProps {
  basePath: string;
  searchParams: URLSearchParams;
  meta: PageMeta;
  /** Tablo aliasını cümlede göster ("ürün", "satır", "kayıt"). Default "kayıt". */
  noun?: string;
}

/**
 * Tablo alt-paginator — TR formatlı sayım + prev/next link'leri.
 * Server component (Link kullanır), hiç JS yüklenmez.
 */
export function Paginator({ basePath, searchParams, meta, noun = 'kayıt' }: PaginatorProps) {
  if (meta.totalRows === 0) return null;

  const prevUrl = meta.hasPrev ? buildPageUrl(basePath, searchParams, meta.page - 1) : null;
  const nextUrl = meta.hasNext ? buildPageUrl(basePath, searchParams, meta.page + 1) : null;

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line/40 bg-paper px-4 py-3 text-[12.5px]"
      aria-label="Sayfa navigasyonu"
      data-testid="paginator"
    >
      <span className="text-ink-3">
        <span className="font-mono font-bold text-ink">{meta.fromRow}-{meta.toRow}</span>
        <span> / </span>
        <span className="font-mono font-bold text-ink">{meta.totalRows}</span>
        <span> {noun} · sayfa </span>
        <span className="font-mono font-bold text-ink">{meta.page}/{meta.totalPages}</span>
      </span>
      <div className="flex items-center gap-2">
        {prevUrl ? (
          <Link
            href={prevUrl as never}
            className="rounded-lg border border-line/40 bg-white px-3 py-1.5 font-bold text-cart transition hover:bg-cat-soft"
            data-testid="paginator-prev"
          >
            ← Önceki
          </Link>
        ) : (
          <span className="rounded-lg border border-line/40 bg-line-soft px-3 py-1.5 text-ink-4">
            ← Önceki
          </span>
        )}
        {nextUrl ? (
          <Link
            href={nextUrl as never}
            className="rounded-lg border border-line/40 bg-white px-3 py-1.5 font-bold text-cart transition hover:bg-cat-soft"
            data-testid="paginator-next"
          >
            Sonraki →
          </Link>
        ) : (
          <span className="rounded-lg border border-line/40 bg-line-soft px-3 py-1.5 text-ink-4">
            Sonraki →
          </span>
        )}
      </div>
    </nav>
  );
}

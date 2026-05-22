/**
 * Pagination yardımcıları — search params'tan page+pageSize parse, SQL limit/offset hesap.
 *
 * URL pattern: ?page=1&pageSize=50 (default sayfa 1, sayfa boyutu 50).
 * Sayfa boyutu allowlist'le sınırlı (50/100/200) — DoS guard.
 */

export const DEFAULT_PAGE_SIZE = 50;
export const PAGE_SIZE_OPTIONS = [50, 100, 200] as const;
export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

export interface PaginationParams {
  page: number;        // 1-indexed (UI dostu)
  pageSize: number;
  limit: number;
  offset: number;
}

/**
 * URL searchParams'tan page+pageSize parse + sanitize.
 * Geçersiz değerler default'a düşer (hata yok — UX dostu).
 */
export function parsePagination(
  raw: { page?: string | string[]; pageSize?: string | string[] } | undefined,
): PaginationParams {
  const pageRaw = Array.isArray(raw?.page) ? raw?.page[0] : raw?.page;
  const sizeRaw = Array.isArray(raw?.pageSize) ? raw?.pageSize[0] : raw?.pageSize;

  let page = Number(pageRaw);
  if (!Number.isFinite(page) || page < 1) page = 1;
  page = Math.floor(page);

  let pageSize = Number(sizeRaw);
  if (!Number.isFinite(pageSize) || !PAGE_SIZE_OPTIONS.includes(pageSize as PageSizeOption)) {
    pageSize = DEFAULT_PAGE_SIZE;
  }

  return {
    page,
    pageSize,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };
}

export interface PageMeta {
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
  /** İlk satır indeksi (1-indexed, kullanıcıya gösterilir). */
  fromRow: number;
  /** Son satır indeksi. */
  toRow: number;
}

export function buildPageMeta(params: PaginationParams, totalRows: number): PageMeta {
  const totalPages = Math.max(1, Math.ceil(totalRows / params.pageSize));
  const fromRow = totalRows === 0 ? 0 : params.offset + 1;
  const toRow = Math.min(totalRows, params.offset + params.pageSize);
  return {
    page: params.page,
    pageSize: params.pageSize,
    totalRows,
    totalPages,
    hasPrev: params.page > 1,
    hasNext: params.page < totalPages,
    fromRow,
    toRow,
  };
}

/**
 * Page number'a göre URL'i kuran helper (UI Link'leri için).
 * Mevcut search params'ı korur, sadece page'i değiştirir.
 */
export function buildPageUrl(
  basePath: string,
  currentParams: URLSearchParams,
  targetPage: number,
): string {
  const params = new URLSearchParams(currentParams);
  if (targetPage === 1) {
    params.delete('page');
  } else {
    params.set('page', String(targetPage));
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

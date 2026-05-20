/**
 * Excel (xlsx) export utility — KVKK Madde 11 veri taşıma + muhasebe raporları için.
 *
 * 2026-05-20: CSV → Excel geçişi (kullanıcı kararı). Türkiye'de pet shop sahipleri
 * Excel kullanıyor, CSV çift-tıklamada bozuk açılıyor. Bu helper:
 *
 *  - Tek-sheet zengin format: marka başlık + meta satırı + Türkçe header + auto-filter
 *  - Freeze header (scroll'da sabit)
 *  - Sütun format'ı (tarih TR / para ₺ / integer / boolean)
 *  - Tema (cat-soft header bg + kalın font + ortalı)
 *  - Otomatik sütun genişlik (auto-fit veya manual)
 *
 * Streaming yok — Cloudflare Workers route'unda Buffer return ediyoruz
 * (tipik export <10K satır = <5 MB).
 */

import ExcelJS from 'exceljs';

/** Sütun format tipleri — değere göre Excel cell formatı uygulanır. */
export type CellFormat =
  | 'text'
  | 'integer'
  | 'currency_try' // 1.250,00 ₺
  | 'date_tr' // 20.05.2026
  | 'datetime_tr' // 20.05.2026 14:32
  | 'boolean' // ✓ / ✕
  | 'percent'; // 75,00 %

export interface XlsxColumn<T> {
  /** Field key veya getter — row üzerinde lookup edilir. */
  key: keyof T | ((row: T) => unknown);
  /** Türkçe başlık (Excel'de görünür). */
  header: string;
  /** Sütun genişliği (Excel units, ~karakter). Default 18. */
  width?: number;
  /** Format tipi (null/undefined için boş döner). Default 'text'. */
  format?: CellFormat;
  /** Sağ-hizalı sayı/para için. Default format'a göre otomatik. */
  align?: 'left' | 'center' | 'right';
}

export interface XlsxBuildOptions<T> {
  /** Sheet adı (max 31 karakter, Excel limit). */
  sheetName: string;
  /** Üst satırda görünen büyük başlık (merge edilir). */
  title: string;
  /** Opsiyonel alt-başlık (örn. "Stok hareketleri raporu · 2026-05-01 → 2026-05-20"). */
  subtitle?: string;
  /** Sütun tanımları (sıra önemli). */
  columns: XlsxColumn<T>[];
  /** Veri satırları. */
  rows: T[];
  /** Üst sağda görünen meta (tenant adı, tarih, filter özeti). */
  metadata?: {
    tenantName?: string;
    generatedAt?: Date;
    filterSummary?: string;
  };
}

const FORMAT_MAP: Record<CellFormat, string> = {
  text: '@',
  integer: '#,##0',
  currency_try: '#,##0.00 [$₺-tr-TR]',
  // [$-tr-TR] locale prefix Excel'in date sütununu "Türk Lirası" locale'da yorumlamasını sağlar
  // Aksi halde locale-default'a düşer ve raw serial number gözükebilir (46158.21539...).
  date_tr: '[$-tr-TR]dd/mm/yyyy',
  datetime_tr: '[$-tr-TR]dd/mm/yyyy hh:mm',
  boolean: '@', // ✓ / ✕ string
  percent: '0.00%',
};

const ALIGN_DEFAULTS: Record<CellFormat, 'left' | 'right' | 'center'> = {
  text: 'left',
  integer: 'right',
  currency_try: 'right',
  date_tr: 'center',
  datetime_tr: 'center',
  boolean: 'center',
  percent: 'right',
};

/**
 * Bir row + sütun tanımından hücre değeri çek + format'a göre cast.
 */
function extractValue<T>(
  row: T,
  col: XlsxColumn<T>,
): string | number | Date | boolean | null {
  const raw =
    typeof col.key === 'function'
      ? (col.key as (r: T) => unknown)(row)
      : (row[col.key as keyof T] as unknown);

  if (raw === null || raw === undefined || raw === '') return null;

  const fmt = col.format ?? 'text';
  switch (fmt) {
    case 'integer': {
      const n = typeof raw === 'number' ? raw : Number(raw);
      return Number.isFinite(n) ? Math.round(n) : null;
    }
    case 'currency_try':
    case 'percent': {
      const n = typeof raw === 'number' ? raw : Number(raw);
      return Number.isFinite(n) ? n : null;
    }
    case 'date_tr':
    case 'datetime_tr': {
      if (raw instanceof Date) return raw;
      const d = new Date(raw as string);
      return isNaN(d.getTime()) ? null : d;
    }
    case 'boolean': {
      return raw === true || raw === 't' || raw === 1 || raw === '1' ? '✓' : '✕';
    }
    default:
      return String(raw);
  }
}

/**
 * Workbook → ArrayBuffer (xlsx blob).
 *
 * Cloudflare Workers + Node uyumlu (exceljs pure-JS, fs gerekmez).
 */
export async function buildXlsxBuffer<T>(opts: XlsxBuildOptions<T>): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PetStockPro';
  wb.lastModifiedBy = 'PetStockPro';
  wb.created = new Date();
  wb.modified = new Date();

  const ws = wb.addWorksheet(opts.sheetName.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: opts.subtitle ? 4 : 3 }],
  });

  // 1. ROW — büyük marka başlığı (merged tüm sütunlarda)
  const colCount = opts.columns.length;
  ws.mergeCells(1, 1, 1, colCount);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = opts.title;
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF1A5588' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFEF0E5' }, // cat-soft tone
  };
  ws.getRow(1).height = 26;

  // 2. ROW — meta satırı (sağ kolonlarda)
  if (opts.metadata) {
    const parts: string[] = [];
    if (opts.metadata.tenantName) parts.push(`📍 ${opts.metadata.tenantName}`);
    if (opts.metadata.generatedAt) {
      parts.push(
        `🕒 ${opts.metadata.generatedAt.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}`,
      );
    }
    if (opts.metadata.filterSummary) parts.push(`🔍 ${opts.metadata.filterSummary}`);
    if (parts.length > 0) {
      ws.mergeCells(2, 1, 2, colCount);
      const metaCell = ws.getCell(2, 1);
      metaCell.value = parts.join('   ·   ');
      metaCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF6B7280' } };
      metaCell.alignment = { vertical: 'middle', horizontal: 'left' };
    }
  }

  // 3. ROW — opsiyonel subtitle
  let headerRowIdx = 3;
  if (opts.subtitle) {
    ws.mergeCells(3, 1, 3, colCount);
    const sub = ws.getCell(3, 1);
    sub.value = opts.subtitle;
    sub.font = { name: 'Calibri', size: 11, bold: false, color: { argb: 'FF4B5563' } };
    sub.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(3).height = 18;
    headerRowIdx = 4;
  }

  // HEADER ROW — Türkçe sütun başlıkları
  const headerRow = ws.getRow(headerRowIdx);
  opts.columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD44A14' }, // cat (orange-brown)
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };
  });
  headerRow.height = 24;

  // DATA ROWS
  opts.rows.forEach((row, rIdx) => {
    const xlRow = ws.getRow(headerRowIdx + 1 + rIdx);
    opts.columns.forEach((c, cIdx) => {
      const cell = xlRow.getCell(cIdx + 1);
      const value = extractValue(row, c);
      if (value !== null) {
        cell.value = value as ExcelJS.CellValue;
      }
      const fmt = c.format ?? 'text';
      if (fmt !== 'text') {
        cell.numFmt = FORMAT_MAP[fmt];
      }
      cell.alignment = {
        vertical: 'middle',
        horizontal: c.align ?? ALIGN_DEFAULTS[fmt],
      };
      // Zebra striping
      if (rIdx % 2 === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFAFAFA' },
        };
      }
    });
  });

  // Sütun genişlikleri
  opts.columns.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.width ?? 18;
  });

  // Auto-filter (header row)
  ws.autoFilter = {
    from: { row: headerRowIdx, column: 1 },
    to: { row: headerRowIdx, column: colCount },
  };

  // Print options
  ws.pageSetup.orientation = 'landscape';
  ws.pageSetup.fitToPage = true;
  ws.pageSetup.fitToWidth = 1;
  ws.pageSetup.fitToHeight = 0;

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

/**
 * Next.js Route Handler için Response döner — Content-Type + Content-Disposition set.
 */
export async function xlsxResponse<T>(
  filename: string,
  opts: XlsxBuildOptions<T>,
): Promise<Response> {
  const buffer = await buildXlsxBuffer(opts);
  const cleanName = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
  // Uint8Array → Blob ile sarmalan (Response BodyInit için ArrayBuffer'a fallback değil,
  // bazı TS lib sürümlerinde Uint8Array doğrudan kabul edilmiyor — Blob güvenli).
  const blob = new Blob([buffer as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  return new Response(blob, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${cleanName}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}

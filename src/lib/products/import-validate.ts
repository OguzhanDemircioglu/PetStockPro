/**
 * Excel ürün import — client-side validation.
 *
 * Pure functions. Frontend xlsx parse'tan sonra çağırılır. Server-side defense-in-depth
 * için POST /api/products/import içinde de tekrar çağrılır.
 *
 * Output: { fileErrors, rows: ImportRowResult[] }
 *   - fileErrors: F1-F8 üst-tier hatalar
 *   - rows: her satır için { rowNumber, errors, warnings, info, normalized? }
 *     normalized sadece errors.length === 0 ise dolar.
 *
 * Hata mesajları sade (kullanıcı talebi 2026-05-20):
 *   `Satır {N} · {Alan} — {kısa açıklama}`
 */

import { IMPORT_TEMPLATE_HEADERS, HEADER_TO_FIELD } from './import-template';

// ────────────────────────────────────────────────────────────
// TIPLER
// ────────────────────────────────────────────────────────────

export interface ImportFileError {
  code: 'extension' | 'size' | 'sheet' | 'header_missing' | 'header_extra' | 'columns_missing' | 'empty' | 'plan_limit';
  message: string;
}

export interface ImportRowMessage {
  field: string;
  message: string;
  /** Excel'deki diğer satırlar — duplicate veya cross-reference için */
  refRows?: number[];
}

export interface ImportRowResult {
  rowNumber: number; // Excel'deki gerçek satır numarası (2-indexed çünkü header row=2)
  errors: ImportRowMessage[];
  warnings: ImportRowMessage[];
  info: ImportRowMessage[];
  normalized?: NormalizedRow;
  /** Server'a ham değer gönderilir (defense için yeniden validate edilir) */
  raw: Record<string, string | number | null>;
}

export interface NormalizedRow {
  name: string;
  sku: string;
  categoryName: string | null;
  brandName: string | null;
  variantLabel: string;
  costPrice: number | null;
  salePrice: number;
  threshold: number;
  barcode: string | null;
  expiryDate: Date | null;
  initialStock: number;
}

export interface ValidationContext {
  /** Tenant'ın mevcut kategorileri (case-insensitive match için) */
  existingCategoryNames: string[];
  /** SKT zorunlu kategoriler (slug değil isim — Excel'de bunlar görünür) */
  sktRequiredCategoryNames: string[];
  /** Tenant'ın mevcut markaları */
  existingBrandNames: string[];
  /** DB'de mevcut ürün adları (case-insensitive lower-case) */
  existingProductNamesLower: Set<string>;
  /** DB'de mevcut SKU'lar */
  existingSkus: Set<string>;
  /** DB'de mevcut barkodlar */
  existingBarcodes: Set<string>;
  /** Plan limiti (FREE=50, PRO=500, PRO+=Infinity) */
  planProductLimit: number;
  /** Tenant'ın mevcut ürün sayısı (limit hesabı için) */
  currentProductCount: number;
}

export interface ValidationResult {
  fileErrors: ImportFileError[];
  rows: ImportRowResult[];
  summary: {
    total: number;
    valid: number;
    error: number;
    warningOnly: number;
  };
}

// ────────────────────────────────────────────────────────────
// CONSTRAINTS
// ────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const NAME_MIN = 2;
const NAME_MAX = 200;
const SKU_REGEX = /^[A-Za-z0-9-]{3,30}$/;
const PRICE_MIN = 1;
const PRICE_MAX = 50000;
const THRESHOLD_MAX = 9999;
const VARIANT_MAX = 100;
const STOCK_MAX = 100000;
const BARCODE_REGEX = /^\d{13}$/;
const FIVE_YEARS_MS = 5 * 365 * 24 * 60 * 60 * 1000;

// ────────────────────────────────────────────────────────────
// DOSYA SEVİYESİ VALIDATIONS
// ────────────────────────────────────────────────────────────

export function validateFileMetadata(opts: {
  fileName: string;
  fileSize: number;
}): ImportFileError[] {
  const errs: ImportFileError[] = [];
  const ext = opts.fileName.match(/\.([^.]+)$/)?.[1]?.toLowerCase() ?? '';
  if (ext !== 'xlsx') {
    errs.push({ code: 'extension', message: `❌ Dosya .xlsx olmalı (mevcut: .${ext})` });
  }
  if (opts.fileSize > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (opts.fileSize / 1024 / 1024).toFixed(1);
    errs.push({ code: 'size', message: `❌ Dosya çok büyük: ${sizeMb} MB (max 5 MB)` });
  }
  return errs;
}

export function validateHeaders(opts: {
  sheetName: string;
  headers: string[];
  dataRowCount: number;
}): ImportFileError[] {
  const errs: ImportFileError[] = [];
  if (opts.sheetName !== 'Ürünler') {
    errs.push({
      code: 'sheet',
      message: `❌ İlk sayfa "Ürünler" olmalı (bulunan: "${opts.sheetName}")`,
    });
  }
  if (opts.headers.length === 0) {
    errs.push({ code: 'header_missing', message: '❌ Başlık satırı eksik' });
    return errs; // header yoksa diğer kontroller anlamsız
  }
  // Header normalize: " *" suffix'ini at, trim
  const normalize = (h: string) => h.replace(/\s*\*\s*$/, '').trim();
  const normalizedHeaders = opts.headers.map(normalize);
  const expectedSet = new Set<string>(IMPORT_TEMPLATE_HEADERS as readonly string[]);
  const missing: string[] = [];
  for (const h of IMPORT_TEMPLATE_HEADERS) {
    if (!normalizedHeaders.includes(h)) missing.push(h);
  }
  if (missing.length > 0) {
    errs.push({
      code: 'columns_missing',
      message: `❌ Eksik sütun: ${missing.join(', ')}`,
    });
  }
  const extra = normalizedHeaders.filter((h) => h && !expectedSet.has(h));
  if (extra.length > 0) {
    errs.push({
      code: 'header_extra',
      message: `⚠ Tanınmayan sütun atlandı: ${extra.join(', ')}`,
    });
  }
  if (opts.dataRowCount === 0) {
    errs.push({ code: 'empty', message: '❌ Boş Excel — en az 1 ürün ekle' });
  }
  return errs;
}

export function validatePlanLimit(opts: {
  rowCount: number;
  current: number;
  limit: number;
}): ImportFileError[] {
  if (opts.limit === Infinity) return [];
  const remaining = opts.limit - opts.current;
  if (opts.rowCount > remaining) {
    const over = opts.rowCount - remaining;
    return [
      {
        code: 'plan_limit',
        message: `❌ ${opts.rowCount} ürün var, plan limiti ${opts.limit} (${over} fazla)`,
      },
    ];
  }
  return [];
}

// ────────────────────────────────────────────────────────────
// SATIR SEVİYESİ — yardımcılar
// ────────────────────────────────────────────────────────────

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  // Türkçe locale: "1.250,50" → 1250.50
  const s = String(value).trim().replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseInt0(value: unknown): number | null {
  const n = parseNumber(value);
  if (n === null) return null;
  return Number.isInteger(n) ? n : null;
}

function parseDate(value: unknown): { date: Date | null; ok: boolean } {
  if (value === null || value === undefined || value === '') return { date: null, ok: true };
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? { date: value, ok: true } : { date: null, ok: false };
  }
  const s = String(value).trim();
  // GG/AA/YYYY veya GG.AA.YYYY veya GG-AA-YYYY
  const m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (!m) return { date: null, ok: false };
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  let year = parseInt(m[3], 10);
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return { date: null, ok: false };
  const d = new Date(year, month - 1, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return { date: null, ok: false };
  }
  return { date: d, ok: true };
}

function normalizeName(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

function lower(s: string): string {
  return s.toLocaleLowerCase('tr-TR');
}

// ────────────────────────────────────────────────────────────
// SATIR VALIDATION
// ────────────────────────────────────────────────────────────

/**
 * Tek satır validate eder. ctx ile DB cross-reference yapar.
 * Excel-içi duplicate'leri çağıran taraf işler (validateAllRows).
 */
export function validateRow(
  raw: Record<string, unknown>,
  rowNumber: number,
  ctx: ValidationContext,
): ImportRowResult {
  const errors: ImportRowMessage[] = [];
  const warnings: ImportRowMessage[] = [];
  const info: ImportRowMessage[] = [];

  // — Ürün Adı —
  const nameRaw = raw.name;
  const nameStr = nameRaw === null || nameRaw === undefined ? '' : String(nameRaw).trim();
  let nameOk = false;
  if (!nameStr) {
    errors.push({ field: 'name', message: `Satır ${rowNumber} · Ürün Adı boş` });
  } else if (nameStr.length < NAME_MIN || nameStr.length > NAME_MAX) {
    errors.push({
      field: 'name',
      message: `Satır ${rowNumber} · Ürün Adı uzun/kısa (${nameStr.length} karakter, ${NAME_MIN}-${NAME_MAX} olmalı)`,
    });
  } else if (ctx.existingProductNamesLower.has(lower(nameStr))) {
    errors.push({
      field: 'name',
      message: `Satır ${rowNumber} · "${nameStr}" zaten kayıtlı`,
    });
  } else {
    nameOk = true;
  }
  const name = nameOk ? normalizeName(nameStr) : '';

  // — SKU —
  const skuStr = raw.sku ? String(raw.sku).trim() : '';
  let skuOk = false;
  if (!skuStr) {
    errors.push({ field: 'sku', message: `Satır ${rowNumber} · SKU boş` });
  } else if (!SKU_REGEX.test(skuStr)) {
    errors.push({
      field: 'sku',
      message: `Satır ${rowNumber} · SKU geçersiz (harf/rakam/tire, 3-30 karakter)`,
    });
  } else if (ctx.existingSkus.has(skuStr)) {
    errors.push({ field: 'sku', message: `Satır ${rowNumber} · SKU "${skuStr}" kullanımda` });
  } else {
    skuOk = true;
  }

  // — Satış Fiyatı —
  const saleRaw = raw.salePrice;
  const sale = parseNumber(saleRaw);
  let saleOk = false;
  if (saleRaw === null || saleRaw === undefined || saleRaw === '') {
    errors.push({ field: 'salePrice', message: `Satır ${rowNumber} · Satış Fiyatı boş` });
  } else if (sale === null) {
    errors.push({
      field: 'salePrice',
      message: `Satır ${rowNumber} · Satış Fiyatı sayı değil ("${String(saleRaw)}")`,
    });
  } else if (sale < PRICE_MIN || sale > PRICE_MAX) {
    errors.push({
      field: 'salePrice',
      message: `Satır ${rowNumber} · Satış Fiyatı aralık dışı (${sale} ₺ · ${PRICE_MIN}-${PRICE_MAX})`,
    });
  } else {
    saleOk = true;
  }

  // — Alış Fiyatı (opsiyonel) —
  const costRaw = raw.costPrice;
  let cost: number | null = null;
  if (costRaw !== null && costRaw !== undefined && costRaw !== '') {
    cost = parseNumber(costRaw);
    if (cost === null) {
      errors.push({
        field: 'costPrice',
        message: `Satır ${rowNumber} · Alış Fiyatı sayı değil ("${String(costRaw)}")`,
      });
    } else if (cost < 0) {
      errors.push({
        field: 'costPrice',
        message: `Satır ${rowNumber} · Alış Fiyatı negatif (${cost} ₺)`,
      });
      cost = null;
    } else if (cost > PRICE_MAX) {
      errors.push({
        field: 'costPrice',
        message: `Satır ${rowNumber} · Alış Fiyatı çok yüksek (${cost} ₺)`,
      });
      cost = null;
    } else if (saleOk && sale !== null && cost > sale) {
      warnings.push({
        field: 'costPrice',
        message: `⚠ Satır ${rowNumber} · Alış > Satış (kâr negatif)`,
      });
    }
  }

  // — Kategori (opsiyonel) —
  const catRaw = raw.categoryName;
  const catStr = catRaw ? String(catRaw).trim() : '';
  let catName: string | null = null;
  let catSktRequired = false;
  if (catStr) {
    const match = ctx.existingCategoryNames.find((c) => lower(c) === lower(catStr));
    if (!match) {
      errors.push({
        field: 'categoryName',
        message: `Satır ${rowNumber} · Kategori "${catStr}" tanınmadı`,
      });
    } else {
      catName = match;
      catSktRequired = ctx.sktRequiredCategoryNames.some((c) => lower(c) === lower(match));
    }
  }

  // — Marka (opsiyonel) —
  const brandRaw = raw.brandName;
  const brandStr = brandRaw ? String(brandRaw).trim() : '';
  let brandName: string | null = null;
  if (brandStr) {
    const match = ctx.existingBrandNames.find((b) => lower(b) === lower(brandStr));
    if (match) {
      brandName = match;
    } else {
      brandName = brandStr;
      info.push({
        field: 'brandName',
        message: `ℹ Satır ${rowNumber} · Marka "${brandStr}" otomatik oluşturulacak`,
      });
    }
  }

  // — Variant Boyut (opsiyonel) —
  const variantRaw = raw.variantLabel;
  const variantStr = variantRaw ? String(variantRaw).trim() : '';
  let variantLabel = 'Standart';
  if (!variantStr) {
    info.push({
      field: 'variantLabel',
      message: `ℹ Satır ${rowNumber} · Variant: "Standart" set edilecek`,
    });
  } else if (variantStr.length > VARIANT_MAX) {
    errors.push({
      field: 'variantLabel',
      message: `Satır ${rowNumber} · Variant Boyut uzun (${variantStr.length} karakter, max ${VARIANT_MAX})`,
    });
  } else {
    variantLabel = variantStr;
  }

  // — Stok Eşiği (opsiyonel) —
  const thRaw = raw.threshold;
  let threshold = 5;
  if (thRaw !== null && thRaw !== undefined && thRaw !== '') {
    const th = parseInt0(thRaw);
    if (th === null || th < 0 || th > THRESHOLD_MAX) {
      errors.push({
        field: 'threshold',
        message: `Satır ${rowNumber} · Stok Eşiği geçersiz (0-${THRESHOLD_MAX} tam sayı)`,
      });
    } else {
      threshold = th;
    }
  }

  // — Barkod (opsiyonel ama varsa katı) —
  const barcodeRaw = raw.barcode;
  const barcodeStr = barcodeRaw ? String(barcodeRaw).trim() : '';
  let barcode: string | null = null;
  if (barcodeStr) {
    if (!/^\d+$/.test(barcodeStr)) {
      errors.push({
        field: 'barcode',
        message: `Satır ${rowNumber} · Barkod yalnızca rakam`,
      });
    } else if (!BARCODE_REGEX.test(barcodeStr)) {
      errors.push({
        field: 'barcode',
        message: `Satır ${rowNumber} · Barkod 13 hane olmalı (${barcodeStr.length})`,
      });
    } else if (ctx.existingBarcodes.has(barcodeStr)) {
      errors.push({
        field: 'barcode',
        message: `Satır ${rowNumber} · Barkod "${barcodeStr}" kullanımda`,
      });
    } else {
      barcode = barcodeStr;
    }
  }

  // — SKT Tarihi (kategori SKT istiyorsa zorunlu) —
  const sktRaw = raw.expiryDate;
  const sktParsed = parseDate(sktRaw);
  let expiryDate: Date | null = null;
  if (catSktRequired && !sktParsed.date) {
    errors.push({
      field: 'expiryDate',
      message: `Satır ${rowNumber} · SKT zorunlu ("${catName}" kategorisi)`,
    });
  } else if (sktRaw && !sktParsed.ok) {
    errors.push({
      field: 'expiryDate',
      message: `Satır ${rowNumber} · SKT geçersiz tarih ("${String(sktRaw)}", örn: 31/12/2026)`,
    });
  } else if (sktParsed.date) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (sktParsed.date.getTime() < now.getTime()) {
      errors.push({
        field: 'expiryDate',
        message: `Satır ${rowNumber} · SKT geçmiş (${formatDateTR(sktParsed.date)})`,
      });
    } else if (sktParsed.date.getTime() - now.getTime() > FIVE_YEARS_MS) {
      warnings.push({
        field: 'expiryDate',
        message: `⚠ Satır ${rowNumber} · SKT çok ileride (${formatDateTR(sktParsed.date)})`,
      });
      expiryDate = sktParsed.date;
    } else {
      expiryDate = sktParsed.date;
    }
  }

  // — İlk Stok Adedi (opsiyonel) —
  const stockRaw = raw.initialStock;
  let initialStock = 0;
  if (stockRaw !== null && stockRaw !== undefined && stockRaw !== '') {
    const st = parseInt0(stockRaw);
    if (st === null) {
      errors.push({
        field: 'initialStock',
        message: `Satır ${rowNumber} · İlk Stok sayı değil ("${String(stockRaw)}")`,
      });
    } else if (st < 0) {
      errors.push({
        field: 'initialStock',
        message: `Satır ${rowNumber} · İlk Stok negatif (${st})`,
      });
    } else if (st > STOCK_MAX) {
      errors.push({
        field: 'initialStock',
        message: `Satır ${rowNumber} · İlk Stok çok yüksek (${st})`,
      });
    } else {
      initialStock = st;
    }
  }

  const normalized: NormalizedRow | undefined =
    errors.length === 0 && nameOk && skuOk && saleOk && sale !== null
      ? {
          name,
          sku: skuStr,
          categoryName: catName,
          brandName,
          variantLabel,
          costPrice: cost,
          salePrice: sale,
          threshold,
          barcode,
          expiryDate,
          initialStock,
        }
      : undefined;

  return {
    rowNumber,
    errors,
    warnings,
    info,
    normalized,
    raw: Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [
        k,
        v === undefined ? null : typeof v === 'object' && v instanceof Date ? v.toISOString() : (v as string | number | null),
      ]),
    ),
  };
}

// ────────────────────────────────────────────────────────────
// EXCEL-İÇİ DUPLICATE TESPİT
// ────────────────────────────────────────────────────────────

export function detectExcelDuplicates(rows: ImportRowResult[]): void {
  // Ürün adı duplicate
  const byName = new Map<string, number[]>();
  // SKU duplicate
  const bySku = new Map<string, number[]>();
  // Barkod duplicate
  const byBarcode = new Map<string, number[]>();

  for (const r of rows) {
    const name = r.raw.name ? lower(String(r.raw.name).trim()) : '';
    const sku = r.raw.sku ? String(r.raw.sku).trim() : '';
    const barcode = r.raw.barcode ? String(r.raw.barcode).trim() : '';
    if (name) {
      const arr = byName.get(name) ?? [];
      arr.push(r.rowNumber);
      byName.set(name, arr);
    }
    if (sku) {
      const arr = bySku.get(sku) ?? [];
      arr.push(r.rowNumber);
      bySku.set(sku, arr);
    }
    if (barcode) {
      const arr = byBarcode.get(barcode) ?? [];
      arr.push(r.rowNumber);
      byBarcode.set(barcode, arr);
    }
  }

  for (const r of rows) {
    const name = r.raw.name ? lower(String(r.raw.name).trim()) : '';
    const nameRows = byName.get(name);
    if (name && nameRows && nameRows.length > 1) {
      const others = nameRows.filter((n) => n !== r.rowNumber);
      // Sadece daha önce eklenmiş "DB'de var" hatasını override etme — ek bilgi olarak göster
      if (!r.errors.find((e) => e.field === 'name' && e.message.includes('zaten kayıtlı'))) {
        r.errors.push({
          field: 'name',
          message: `Satır ${r.rowNumber} · Ürün adı tekrarlı (satırlar: ${others.join(', ')})`,
          refRows: others,
        });
      }
    }
    const sku = r.raw.sku ? String(r.raw.sku).trim() : '';
    const skuRows = bySku.get(sku);
    if (sku && skuRows && skuRows.length > 1) {
      const others = skuRows.filter((n) => n !== r.rowNumber);
      if (!r.errors.find((e) => e.field === 'sku' && e.message.includes('kullanımda'))) {
        r.errors.push({
          field: 'sku',
          message: `Satır ${r.rowNumber} · SKU tekrarlı (satırlar: ${others.join(', ')})`,
          refRows: others,
        });
      }
    }
    const barcode = r.raw.barcode ? String(r.raw.barcode).trim() : '';
    const barcodeRows = byBarcode.get(barcode);
    if (barcode && barcodeRows && barcodeRows.length > 1) {
      const others = barcodeRows.filter((n) => n !== r.rowNumber);
      if (!r.errors.find((e) => e.field === 'barcode' && e.message.includes('kullanımda'))) {
        r.errors.push({
          field: 'barcode',
          message: `Satır ${r.rowNumber} · Barkod tekrarlı (satırlar: ${others.join(', ')})`,
          refRows: others,
        });
      }
    }
    // duplicate eklenince normalized'i invalidate et
    if (r.errors.length > 0 && r.normalized) {
      r.normalized = undefined;
    }
  }
}

// ────────────────────────────────────────────────────────────
// ANA VALIDATE FONKSIYONU
// ────────────────────────────────────────────────────────────

/**
 * Üst seviye orchestrator — dosya + satır + duplicate tüm validasyonu çalıştırır.
 */
export function validateImport(opts: {
  fileName: string;
  fileSize: number;
  sheetName: string;
  headers: string[];
  rawRows: Array<Record<string, unknown>>;
  ctx: ValidationContext;
}): ValidationResult {
  const fileErrors: ImportFileError[] = [];
  fileErrors.push(...validateFileMetadata({ fileName: opts.fileName, fileSize: opts.fileSize }));
  fileErrors.push(
    ...validateHeaders({
      sheetName: opts.sheetName,
      headers: opts.headers,
      dataRowCount: opts.rawRows.length,
    }),
  );
  fileErrors.push(
    ...validatePlanLimit({
      rowCount: opts.rawRows.length,
      current: opts.ctx.currentProductCount,
      limit: opts.ctx.planProductLimit,
    }),
  );

  // Header-extension hataları sadece warning seviyesinde (header_extra), bloker değil
  const hasBlocker = fileErrors.some((e) => e.code !== 'header_extra');

  let rows: ImportRowResult[] = [];
  if (!hasBlocker) {
    rows = opts.rawRows.map((raw, idx) => validateRow(raw, idx + 3, opts.ctx)); // header row=2, data row=3+
    detectExcelDuplicates(rows);
  }

  const valid = rows.filter((r) => r.errors.length === 0).length;
  const error = rows.filter((r) => r.errors.length > 0).length;
  const warningOnly = rows.filter((r) => r.errors.length === 0 && r.warnings.length > 0).length;

  return {
    fileErrors,
    rows,
    summary: {
      total: rows.length,
      valid,
      error,
      warningOnly,
    },
  };
}

// ────────────────────────────────────────────────────────────
// HELPER — UI display
// ────────────────────────────────────────────────────────────

export function formatDateTR(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Ham Excel raw'undan field key'lerine map'ler (header → field name). */
export function mapRawRow(rawByHeader: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [header, value] of Object.entries(rawByHeader)) {
    const norm = header.replace(/\s*\*\s*$/, '').trim();
    const field = HEADER_TO_FIELD[norm];
    if (field) out[field] = value;
  }
  return out;
}

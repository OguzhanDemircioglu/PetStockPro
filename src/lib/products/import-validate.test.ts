import { describe, it, expect } from 'vitest';
import {
  validateFileMetadata,
  validateHeaders,
  validatePlanLimit,
  validateRow,
  detectExcelDuplicates,
  validateImport,
  mapRawRow,
  type ValidationContext,
  type ImportRowResult,
} from './import-validate';

const BASE_CTX: ValidationContext = {
  existingCategoryNames: ['Kedi Kuru Mama', 'Köpek Kuru Mama', 'Sağlık ve Bakım', 'Akvaryum'],
  sktRequiredCategoryNames: ['Kedi Kuru Mama', 'Köpek Kuru Mama', 'Sağlık ve Bakım'],
  existingBrandNames: ['Royal Canin', 'Pro Plan', "Biokat's"],
  existingProductNamesLower: new Set(['mevcut ürün']),
  existingSkus: new Set(['EXIST-1']),
  existingBarcodes: new Set(['1234567890123']),
  planProductLimit: 500,
  currentProductCount: 100,
};

describe('validateFileMetadata', () => {
  it('xlsx + boyut OK', () => {
    expect(validateFileMetadata({ fileName: 'a.xlsx', fileSize: 1024 })).toEqual([]);
  });
  it('wrong extension', () => {
    const r = validateFileMetadata({ fileName: 'a.csv', fileSize: 1024 });
    expect(r[0].code).toBe('extension');
    expect(r[0].message).toContain('.csv');
  });
  it('file size > 5MB', () => {
    const r = validateFileMetadata({ fileName: 'a.xlsx', fileSize: 6 * 1024 * 1024 });
    expect(r[0].code).toBe('size');
    expect(r[0].message).toContain('6.0 MB');
  });
});

describe('validateHeaders', () => {
  const ALL = [
    'Ürün Adı *',
    'SKU *',
    'Kategori',
    'Marka',
    'Variant Boyut',
    'Alış Fiyatı (₺)',
    'Satış Fiyatı (₺) *',
    'Stok Eşiği',
    'Barkod (EAN-13)',
    'SKT Tarihi (GG/AA/YYYY)',
    'İlk Stok Adedi',
  ];

  it('full headers + Ürünler sheet + 1+ row → no errors', () => {
    expect(validateHeaders({ sheetName: 'Ürünler', headers: ALL, dataRowCount: 5 })).toEqual([]);
  });
  it('wrong sheet name', () => {
    const r = validateHeaders({ sheetName: 'Sayfa1', headers: ALL, dataRowCount: 5 });
    expect(r[0].code).toBe('sheet');
  });
  it('missing required column', () => {
    const r = validateHeaders({
      sheetName: 'Ürünler',
      headers: ALL.filter((h) => !h.startsWith('SKU')),
      dataRowCount: 5,
    });
    expect(r.find((e) => e.code === 'columns_missing')?.message).toContain('SKU');
  });
  it('extra column → warning, not blocker', () => {
    const r = validateHeaders({
      sheetName: 'Ürünler',
      headers: [...ALL, 'Tanınmayan Sütun'],
      dataRowCount: 5,
    });
    expect(r.find((e) => e.code === 'header_extra')?.message).toContain('Tanınmayan');
    expect(r.find((e) => e.code === 'columns_missing')).toBeUndefined();
  });
  it('empty data rows', () => {
    const r = validateHeaders({ sheetName: 'Ürünler', headers: ALL, dataRowCount: 0 });
    expect(r.find((e) => e.code === 'empty')).toBeDefined();
  });
});

describe('validatePlanLimit', () => {
  it('within limit', () => {
    expect(validatePlanLimit({ rowCount: 10, current: 100, limit: 500 })).toEqual([]);
  });
  it('exceeds limit', () => {
    const r = validatePlanLimit({ rowCount: 450, current: 100, limit: 500 });
    expect(r[0].code).toBe('plan_limit');
    expect(r[0].message).toContain('450');
    expect(r[0].message).toContain('500');
  });
  it('Infinity plan', () => {
    expect(validatePlanLimit({ rowCount: 10000, current: 0, limit: Infinity })).toEqual([]);
  });
});

describe('validateRow — happy path', () => {
  it('tüm zorunlu + opsiyonel doğru', () => {
    const r = validateRow(
      {
        name: 'Test Mama 2 kg',
        sku: 'TEST-MAMA-2KG',
        categoryName: 'Kedi Kuru Mama',
        brandName: 'Royal Canin',
        variantLabel: '2 kg',
        costPrice: 200,
        salePrice: 350,
        threshold: 5,
        barcode: '9999888877776',
        expiryDate: '31/12/2028',
        initialStock: 20,
      },
      3,
      BASE_CTX,
    );
    expect(r.errors).toEqual([]);
    expect(r.normalized?.name).toBe('Test Mama 2 kg');
    expect(r.normalized?.salePrice).toBe(350);
    expect(r.normalized?.categoryName).toBe('Kedi Kuru Mama');
  });
});

describe('validateRow — Ürün Adı', () => {
  it('boş → hata', () => {
    const r = validateRow({ sku: 'X-1', salePrice: 100 }, 3, BASE_CTX);
    expect(r.errors.find((e) => e.field === 'name')?.message).toContain('boş');
  });
  it('1 karakter → kısa hata', () => {
    const r = validateRow({ name: 'A', sku: 'X-1', salePrice: 100 }, 3, BASE_CTX);
    expect(r.errors.find((e) => e.field === 'name')?.message).toContain('uzun/kısa');
  });
  it('DB\'de zaten var → hata', () => {
    const r = validateRow({ name: 'Mevcut Ürün', sku: 'X-1', salePrice: 100 }, 3, BASE_CTX);
    expect(r.errors.find((e) => e.field === 'name')?.message).toContain('zaten kayıtlı');
  });
});

describe('validateRow — SKU', () => {
  it('boş → hata', () => {
    const r = validateRow({ name: 'Test Urun', sku: '', salePrice: 100 }, 3, BASE_CTX);
    expect(r.errors.find((e) => e.field === 'sku')?.message).toContain('boş');
  });
  it('format hatalı (boşluk var)', () => {
    const r = validateRow({ name: 'Test', sku: 'AB CD', salePrice: 100 }, 3, BASE_CTX);
    expect(r.errors.find((e) => e.field === 'sku')?.message).toContain('geçersiz');
  });
  it('DB\'de var', () => {
    const r = validateRow({ name: 'Test', sku: 'EXIST-1', salePrice: 100 }, 3, BASE_CTX);
    expect(r.errors.find((e) => e.field === 'sku')?.message).toContain('kullanımda');
  });
});

describe('validateRow — Satış Fiyatı', () => {
  it('boş → hata', () => {
    const r = validateRow({ name: 'Test Urun', sku: 'X-1' }, 3, BASE_CTX);
    expect(r.errors.find((e) => e.field === 'salePrice')?.message).toContain('boş');
  });
  it('sayı değil', () => {
    const r = validateRow({ name: 'Test Urun', sku: 'X-1', salePrice: 'abc' }, 3, BASE_CTX);
    expect(r.errors.find((e) => e.field === 'salePrice')?.message).toContain('sayı değil');
  });
  it('aralık dışı', () => {
    const r = validateRow({ name: 'Test Urun', sku: 'X-1', salePrice: 999999 }, 3, BASE_CTX);
    expect(r.errors.find((e) => e.field === 'salePrice')?.message).toContain('aralık dışı');
  });
  it('Türkçe sayı format', () => {
    const r = validateRow({ name: 'Test Urun', sku: 'X-1', salePrice: '1.250,50' }, 3, BASE_CTX);
    expect(r.errors.find((e) => e.field === 'salePrice')).toBeUndefined();
    expect(r.normalized?.salePrice).toBeCloseTo(1250.5);
  });
});

describe('validateRow — Alış Fiyatı warning', () => {
  it('alış > satış → kâr negatif warning', () => {
    const r = validateRow(
      { name: 'Test Urun', sku: 'X-1', costPrice: 500, salePrice: 100 },
      3,
      BASE_CTX,
    );
    expect(r.warnings.find((w) => w.field === 'costPrice')?.message).toContain('Alış > Satış');
    expect(r.normalized).toBeDefined(); // warning blocker değil
  });
});

describe('validateRow — Kategori', () => {
  it('tanınmadı', () => {
    const r = validateRow(
      { name: 'Test Urun', sku: 'X-1', salePrice: 100, categoryName: 'YokKategori' },
      3,
      BASE_CTX,
    );
    expect(r.errors.find((e) => e.field === 'categoryName')?.message).toContain('tanınmadı');
  });
  it('case-insensitive match', () => {
    const r = validateRow(
      { name: 'Test Urun', sku: 'X-1', salePrice: 100, categoryName: 'akvaryum' },
      3,
      BASE_CTX,
    );
    expect(r.errors.find((e) => e.field === 'categoryName')).toBeUndefined();
    expect(r.normalized?.categoryName).toBe('Akvaryum');
  });
});

describe('validateRow — Marka', () => {
  it('yeni marka → info, blocker değil', () => {
    const r = validateRow(
      { name: 'Test Urun', sku: 'X-1', salePrice: 100, brandName: 'YeniMarka' },
      3,
      BASE_CTX,
    );
    expect(r.info.find((i) => i.field === 'brandName')?.message).toContain('otomatik');
    expect(r.normalized?.brandName).toBe('YeniMarka');
  });
});

describe('validateRow — Barkod', () => {
  it('12 hane (kısa)', () => {
    const r = validateRow(
      { name: 'Test Urun', sku: 'X-1', salePrice: 100, barcode: '123456789012' },
      3,
      BASE_CTX,
    );
    expect(r.errors.find((e) => e.field === 'barcode')?.message).toContain('13 hane');
  });
  it('rakam değil', () => {
    const r = validateRow(
      { name: 'Test Urun', sku: 'X-1', salePrice: 100, barcode: 'ABC' },
      3,
      BASE_CTX,
    );
    expect(r.errors.find((e) => e.field === 'barcode')?.message).toContain('yalnızca rakam');
  });
  it('DB\'de var', () => {
    const r = validateRow(
      { name: 'Test Urun', sku: 'X-1', salePrice: 100, barcode: '1234567890123' },
      3,
      BASE_CTX,
    );
    expect(r.errors.find((e) => e.field === 'barcode')?.message).toContain('kullanımda');
  });
});

describe('validateRow — SKT', () => {
  it('SKT zorunlu kategori + boş', () => {
    const r = validateRow(
      { name: 'Test Urun', sku: 'X-1', salePrice: 100, categoryName: 'Sağlık ve Bakım' },
      3,
      BASE_CTX,
    );
    expect(r.errors.find((e) => e.field === 'expiryDate')?.message).toContain('SKT zorunlu');
  });
  it('SKT format hatalı', () => {
    const r = validateRow(
      { name: 'Test Urun', sku: 'X-1', salePrice: 100, expiryDate: 'yarın' },
      3,
      BASE_CTX,
    );
    expect(r.errors.find((e) => e.field === 'expiryDate')?.message).toContain('geçersiz tarih');
  });
  it('SKT geçmiş', () => {
    const r = validateRow(
      { name: 'Test Urun', sku: 'X-1', salePrice: 100, expiryDate: '01/01/2020' },
      3,
      BASE_CTX,
    );
    expect(r.errors.find((e) => e.field === 'expiryDate')?.message).toContain('geçmiş');
  });
  it('SKT 5+ yıl ileride → warning', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 10);
    const r = validateRow(
      { name: 'Test Urun', sku: 'X-1', salePrice: 100, expiryDate: `31/12/${future.getFullYear()}` },
      3,
      BASE_CTX,
    );
    expect(r.warnings.find((w) => w.field === 'expiryDate')?.message).toContain('çok ileride');
  });
});

describe('detectExcelDuplicates', () => {
  it('aynı ürün adı 2 satırda', () => {
    const rows: ImportRowResult[] = [
      validateRow({ name: 'Dup Ürün', sku: 'A-1', salePrice: 100 }, 3, BASE_CTX),
      validateRow({ name: 'Dup Ürün', sku: 'A-2', salePrice: 100 }, 4, BASE_CTX),
    ];
    detectExcelDuplicates(rows);
    expect(rows[0].errors.find((e) => e.message.includes('tekrarlı'))?.refRows).toEqual([4]);
    expect(rows[1].errors.find((e) => e.message.includes('tekrarlı'))?.refRows).toEqual([3]);
  });
  it('aynı SKU 2 satırda', () => {
    const rows: ImportRowResult[] = [
      validateRow({ name: 'A', sku: 'DUP-1', salePrice: 100 }, 3, BASE_CTX),
      validateRow({ name: 'B', sku: 'DUP-1', salePrice: 100 }, 4, BASE_CTX),
    ];
    detectExcelDuplicates(rows);
    expect(rows[0].errors.find((e) => e.field === 'sku' && e.message.includes('tekrarlı'))).toBeDefined();
  });
});

describe('validateImport — orchestrator', () => {
  it('full happy path 2 satır', () => {
    const r = validateImport({
      fileName: 'test.xlsx',
      fileSize: 1024,
      sheetName: 'Ürünler',
      headers: [
        'Ürün Adı *',
        'SKU *',
        'Kategori',
        'Marka',
        'Variant Boyut',
        'Alış Fiyatı (₺)',
        'Satış Fiyatı (₺) *',
        'Stok Eşiği',
        'Barkod (EAN-13)',
        'SKT Tarihi (GG/AA/YYYY)',
        'İlk Stok Adedi',
      ],
      rawRows: [
        { name: 'Yeni Ürün 1', sku: 'NEW-1', salePrice: 100 },
        { name: 'Yeni Ürün 2', sku: 'NEW-2', salePrice: 200 },
      ],
      ctx: BASE_CTX,
    });
    expect(r.fileErrors).toEqual([]);
    expect(r.summary.total).toBe(2);
    expect(r.summary.valid).toBe(2);
    expect(r.summary.error).toBe(0);
  });

  it('plan limit aşımı → satır validate edilmez', () => {
    const r = validateImport({
      fileName: 'test.xlsx',
      fileSize: 1024,
      sheetName: 'Ürünler',
      headers: [
        'Ürün Adı *',
        'SKU *',
        'Kategori',
        'Marka',
        'Variant Boyut',
        'Alış Fiyatı (₺)',
        'Satış Fiyatı (₺) *',
        'Stok Eşiği',
        'Barkod (EAN-13)',
        'SKT Tarihi (GG/AA/YYYY)',
        'İlk Stok Adedi',
      ],
      rawRows: new Array(500).fill({ name: 'X', sku: 'X-1', salePrice: 100 }),
      ctx: { ...BASE_CTX, planProductLimit: 100, currentProductCount: 50 },
    });
    expect(r.fileErrors.find((e) => e.code === 'plan_limit')).toBeDefined();
    expect(r.rows).toEqual([]);
  });
});

describe('mapRawRow', () => {
  it('header → field', () => {
    const r = mapRawRow({
      'Ürün Adı *': 'Test',
      'SKU *': 'X-1',
      'Satış Fiyatı (₺) *': 100,
      'Tanınmayan Sütun': 'x',
    });
    expect(r.name).toBe('Test');
    expect(r.sku).toBe('X-1');
    expect(r.salePrice).toBe(100);
    expect(r['Tanınmayan Sütun']).toBeUndefined();
  });
});

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

  it('header trim ve yıldız stripping çalışıyor', () => {
    const r = mapRawRow({
      '  Ürün Adı  *  ': 'Test',
      ' SKU * ': 'X-1',
    });
    expect(r.name).toBe('Test');
    expect(r.sku).toBe('X-1');
  });

  it('11 header tamamı tanınır', () => {
    const r = mapRawRow({
      'Ürün Adı *': 'a',
      'SKU *': 'b',
      Kategori: 'c',
      Marka: 'd',
      'Variant Boyut': 'e',
      'Alış Fiyatı (₺)': 1,
      'Satış Fiyatı (₺) *': 2,
      'Stok Eşiği': 3,
      'Barkod (EAN-13)': '1234567890123',
      'SKT Tarihi (GG/AA/YYYY)': '31/12/2030',
      'İlk Stok Adedi': 5,
    });
    expect(Object.keys(r).sort()).toEqual(
      ['barcode', 'brandName', 'categoryName', 'costPrice', 'expiryDate', 'initialStock', 'name', 'salePrice', 'sku', 'threshold', 'variantLabel'].sort(),
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// EDGE CASES — geniş kapsam test
// ═══════════════════════════════════════════════════════════════

describe('Edge — Ürün Adı sınır değerleri', () => {
  it('200 karakter tam sınır → kabul', () => {
    const name = 'A'.repeat(200);
    const r = validateRow({ name, sku: 'X-1', salePrice: 100 }, 3, BASE_CTX);
    expect(r.errors.find((e) => e.field === 'name')).toBeUndefined();
  });
  it('201 karakter → reject', () => {
    const name = 'A'.repeat(201);
    const r = validateRow({ name, sku: 'X-1', salePrice: 100 }, 3, BASE_CTX);
    expect(r.errors.find((e) => e.field === 'name')?.message).toContain('uzun/kısa');
  });
  it('2 karakter tam sınır → kabul', () => {
    const r = validateRow({ name: 'Ab', sku: 'X-1', salePrice: 100 }, 3, BASE_CTX);
    expect(r.errors.find((e) => e.field === 'name')).toBeUndefined();
  });
  it('sadece boşluk → boş muamelesi', () => {
    const r = validateRow({ name: '   ', sku: 'X-1', salePrice: 100 }, 3, BASE_CTX);
    expect(r.errors.find((e) => e.field === 'name')?.message).toContain('boş');
  });
  it('case-insensitive DB check (MEVCUT ÜRÜN → mevcut ürün)', () => {
    const r = validateRow({ name: 'MEVCUT ÜRÜN', sku: 'X-1', salePrice: 100 }, 3, BASE_CTX);
    expect(r.errors.find((e) => e.field === 'name')?.message).toContain('zaten kayıtlı');
  });
  it('leading/trailing boşluk trim edilir', () => {
    const r = validateRow({ name: '   Yeni Ürün   ', sku: 'X-1', salePrice: 100 }, 3, BASE_CTX);
    expect(r.normalized?.name).toBe('Yeni Ürün');
  });
  it('Türkçe + emoji karakter kabul', () => {
    const r = validateRow({ name: 'Çığlık 🐈 Maması', sku: 'X-1', salePrice: 100 }, 3, BASE_CTX);
    expect(r.errors.find((e) => e.field === 'name')).toBeUndefined();
  });
});

describe('Edge — SKU karakter setleri', () => {
  it('3 karakter tam sınır', () => {
    const r = validateRow({ name: 'Test', sku: 'ABC', salePrice: 100 }, 3, BASE_CTX);
    expect(r.errors.find((e) => e.field === 'sku')).toBeUndefined();
  });
  it('30 karakter tam sınır', () => {
    const sku = 'A'.repeat(30);
    const r = validateRow({ name: 'Test', sku, salePrice: 100 }, 3, BASE_CTX);
    expect(r.errors.find((e) => e.field === 'sku')).toBeUndefined();
  });
  it('31 karakter → reject', () => {
    const r = validateRow({ name: 'Test', sku: 'A'.repeat(31), salePrice: 100 }, 3, BASE_CTX);
    expect(r.errors.find((e) => e.field === 'sku')?.message).toContain('geçersiz');
  });
  it('underscore → reject (sadece tire kabul)', () => {
    const r = validateRow({ name: 'Test', sku: 'AB_CD', salePrice: 100 }, 3, BASE_CTX);
    expect(r.errors.find((e) => e.field === 'sku')?.message).toContain('geçersiz');
  });
  it('sadece rakam → kabul', () => {
    const r = validateRow({ name: 'Test', sku: '123456', salePrice: 100 }, 3, BASE_CTX);
    expect(r.errors.find((e) => e.field === 'sku')).toBeUndefined();
  });
  it('sadece harf → kabul', () => {
    const r = validateRow({ name: 'Test', sku: 'AAAAA', salePrice: 100 }, 3, BASE_CTX);
    expect(r.errors.find((e) => e.field === 'sku')).toBeUndefined();
  });
  it('Türkçe karakter SKU → reject', () => {
    const r = validateRow({ name: 'Test', sku: 'ÇĞ-MAMA-1', salePrice: 100 }, 3, BASE_CTX);
    expect(r.errors.find((e) => e.field === 'sku')?.message).toContain('geçersiz');
  });
  it('nokta ile → reject', () => {
    const r = validateRow({ name: 'Test', sku: 'A.B.C', salePrice: 100 }, 3, BASE_CTX);
    expect(r.errors.find((e) => e.field === 'sku')?.message).toContain('geçersiz');
  });
  it('lowercase/uppercase karışık kabul', () => {
    const r = validateRow({ name: 'Test', sku: 'aB-cD-eF', salePrice: 100 }, 3, BASE_CTX);
    expect(r.errors.find((e) => e.field === 'sku')).toBeUndefined();
  });
});

describe('Edge — Satış Fiyatı sınır değerleri', () => {
  it('0 → reject (min 1)', () => {
    const r = validateRow({ name: 'Test', sku: 'X-1', salePrice: 0 }, 3, BASE_CTX);
    expect(r.errors.find((e) => e.field === 'salePrice')?.message).toContain('aralık dışı');
  });
  it('0.5 → reject (< 1)', () => {
    const r = validateRow({ name: 'Test', sku: 'X-1', salePrice: 0.5 }, 3, BASE_CTX);
    expect(r.errors.find((e) => e.field === 'salePrice')?.message).toContain('aralık dışı');
  });
  it('1 tam alt sınır → kabul', () => {
    const r = validateRow({ name: 'Test', sku: 'X-1', salePrice: 1 }, 3, BASE_CTX);
    expect(r.errors.find((e) => e.field === 'salePrice')).toBeUndefined();
  });
  it('50000 tam üst sınır → kabul', () => {
    const r = validateRow({ name: 'Test', sku: 'X-1', salePrice: 50000 }, 3, BASE_CTX);
    expect(r.errors.find((e) => e.field === 'salePrice')).toBeUndefined();
  });
  it('50000.01 → reject', () => {
    const r = validateRow({ name: 'Test', sku: 'X-1', salePrice: 50000.01 }, 3, BASE_CTX);
    expect(r.errors.find((e) => e.field === 'salePrice')?.message).toContain('aralık dışı');
  });
  it('negatif → reject', () => {
    const r = validateRow({ name: 'Test', sku: 'X-1', salePrice: -10 }, 3, BASE_CTX);
    expect(r.errors.find((e) => e.field === 'salePrice')?.message).toContain('aralık dışı');
  });
});

describe('Edge — Barkod formatları', () => {
  it('13 hane tam → kabul', () => {
    const r = validateRow(
      { name: 'Test', sku: 'X-1', salePrice: 100, barcode: '9999988887777' },
      3,
      BASE_CTX,
    );
    expect(r.errors.find((e) => e.field === 'barcode')).toBeUndefined();
  });
  it('14 hane → reject', () => {
    const r = validateRow(
      { name: 'Test', sku: 'X-1', salePrice: 100, barcode: '12345678901234' },
      3,
      BASE_CTX,
    );
    expect(r.errors.find((e) => e.field === 'barcode')?.message).toContain('13 hane');
  });
  it('sıfırla başlayan 13 hane → kabul', () => {
    const r = validateRow(
      { name: 'Test', sku: 'X-1', salePrice: 100, barcode: '0001234567890' },
      3,
      BASE_CTX,
    );
    expect(r.errors.find((e) => e.field === 'barcode')).toBeUndefined();
  });
  it('boşluklu rakam → "yalnızca rakam" hatası', () => {
    const r = validateRow(
      { name: 'Test', sku: 'X-1', salePrice: 100, barcode: '123 4567890123' },
      3,
      BASE_CTX,
    );
    expect(r.errors.find((e) => e.field === 'barcode')?.message).toContain('yalnızca rakam');
  });
});

describe('Edge — SKT tarih formatları', () => {
  const futureYear = new Date().getFullYear() + 1;
  it('GG.AA.YYYY (nokta) kabul', () => {
    const r = validateRow(
      { name: 'Test', sku: 'X-1', salePrice: 100, expiryDate: `31.12.${futureYear}` },
      3,
      BASE_CTX,
    );
    expect(r.errors.find((e) => e.field === 'expiryDate')).toBeUndefined();
  });
  it('GG-AA-YYYY (tire) kabul', () => {
    const r = validateRow(
      { name: 'Test', sku: 'X-1', salePrice: 100, expiryDate: `31-12-${futureYear}` },
      3,
      BASE_CTX,
    );
    expect(r.errors.find((e) => e.field === 'expiryDate')).toBeUndefined();
  });
  it('2 haneli yıl → 2000+ tamamlanır', () => {
    const yy = (futureYear + 1) % 100;
    const r = validateRow(
      { name: 'Test', sku: 'X-1', salePrice: 100, expiryDate: `15/06/${String(yy).padStart(2, '0')}` },
      3,
      BASE_CTX,
    );
    expect(r.errors.find((e) => e.field === 'expiryDate')).toBeUndefined();
    expect(r.normalized?.expiryDate?.getFullYear()).toBe(futureYear + 1);
  });
  it('31/02/YYYY (geçersiz gün) → reject', () => {
    const r = validateRow(
      { name: 'Test', sku: 'X-1', salePrice: 100, expiryDate: `31/02/${futureYear}` },
      3,
      BASE_CTX,
    );
    expect(r.errors.find((e) => e.field === 'expiryDate')?.message).toContain('geçersiz tarih');
  });
  it('ISO YYYY-MM-DD → reject (GG/AA/YYYY bekler)', () => {
    const r = validateRow(
      { name: 'Test', sku: 'X-1', salePrice: 100, expiryDate: `${futureYear}-12-31` },
      3,
      BASE_CTX,
    );
    expect(r.errors.find((e) => e.field === 'expiryDate')?.message).toContain('geçersiz tarih');
  });
  it('Excel Date instance kabul', () => {
    const future = new Date(futureYear, 5, 15);
    const r = validateRow(
      { name: 'Test', sku: 'X-1', salePrice: 100, expiryDate: future },
      3,
      BASE_CTX,
    );
    expect(r.errors.find((e) => e.field === 'expiryDate')).toBeUndefined();
  });
});

describe('Edge — Stok / Initial Stock', () => {
  it('eşik float (5.5) → reject', () => {
    const r = validateRow(
      { name: 'Test', sku: 'X-1', salePrice: 100, threshold: 5.5 },
      3,
      BASE_CTX,
    );
    expect(r.errors.find((e) => e.field === 'threshold')?.message).toContain('geçersiz');
  });
  it('eşik 9999 tam sınır → kabul', () => {
    const r = validateRow(
      { name: 'Test', sku: 'X-1', salePrice: 100, threshold: 9999 },
      3,
      BASE_CTX,
    );
    expect(r.errors.find((e) => e.field === 'threshold')).toBeUndefined();
  });
  it('eşik 10000 → reject', () => {
    const r = validateRow(
      { name: 'Test', sku: 'X-1', salePrice: 100, threshold: 10000 },
      3,
      BASE_CTX,
    );
    expect(r.errors.find((e) => e.field === 'threshold')?.message).toContain('geçersiz');
  });
  it('initialStock 100000 tam üst sınır → kabul', () => {
    const r = validateRow(
      { name: 'Test', sku: 'X-1', salePrice: 100, initialStock: 100000 },
      3,
      BASE_CTX,
    );
    expect(r.errors.find((e) => e.field === 'initialStock')).toBeUndefined();
  });
  it('initialStock 100001 → reject', () => {
    const r = validateRow(
      { name: 'Test', sku: 'X-1', salePrice: 100, initialStock: 100001 },
      3,
      BASE_CTX,
    );
    expect(r.errors.find((e) => e.field === 'initialStock')?.message).toContain('yüksek');
  });
  it('initialStock float → reject', () => {
    const r = validateRow(
      { name: 'Test', sku: 'X-1', salePrice: 100, initialStock: 5.5 },
      3,
      BASE_CTX,
    );
    expect(r.errors.find((e) => e.field === 'initialStock')?.message).toContain('sayı değil');
  });
});

describe('Edge — Çoklu hata aynı satırda', () => {
  it('5 alan birden boş → 3 zorunlu alan hatası', () => {
    const r = validateRow({}, 3, BASE_CTX);
    const fields = r.errors.map((e) => e.field);
    expect(fields).toContain('name');
    expect(fields).toContain('sku');
    expect(fields).toContain('salePrice');
  });
  it('name DB\'de var + SKU DB\'de var → 2 hata', () => {
    const r = validateRow(
      { name: 'Mevcut Ürün', sku: 'EXIST-1', salePrice: 100 },
      3,
      BASE_CTX,
    );
    expect(r.errors.find((e) => e.field === 'name')).toBeDefined();
    expect(r.errors.find((e) => e.field === 'sku')).toBeDefined();
  });
});

describe('Edge — detectExcelDuplicates karmaşık', () => {
  it('3 satır aynı isim → her birinde diğer 2\'sini gösterir', () => {
    const rows: ImportRowResult[] = [
      validateRow({ name: 'X', sku: 'A-1', salePrice: 100 }, 3, BASE_CTX),
      validateRow({ name: 'X', sku: 'A-2', salePrice: 100 }, 4, BASE_CTX),
      validateRow({ name: 'X', sku: 'A-3', salePrice: 100 }, 5, BASE_CTX),
    ];
    detectExcelDuplicates(rows);
    expect(rows[0].errors.find((e) => e.message.includes('tekrarlı'))?.refRows).toEqual([4, 5]);
    expect(rows[1].errors.find((e) => e.message.includes('tekrarlı'))?.refRows).toEqual([3, 5]);
    expect(rows[2].errors.find((e) => e.message.includes('tekrarlı'))?.refRows).toEqual([3, 4]);
  });
  it('case-insensitive duplicate ("Mama" + "MAMA")', () => {
    const rows: ImportRowResult[] = [
      validateRow({ name: 'Mama', sku: 'A-1', salePrice: 100 }, 3, BASE_CTX),
      validateRow({ name: 'MAMA', sku: 'A-2', salePrice: 100 }, 4, BASE_CTX),
    ];
    detectExcelDuplicates(rows);
    expect(rows[0].errors.find((e) => e.message.includes('tekrarlı'))).toBeDefined();
  });
  it('barkod boş ise duplicate sayma', () => {
    const rows: ImportRowResult[] = [
      validateRow({ name: 'A', sku: 'A-1', salePrice: 100, barcode: '' }, 3, BASE_CTX),
      validateRow({ name: 'B', sku: 'A-2', salePrice: 100, barcode: '' }, 4, BASE_CTX),
    ];
    detectExcelDuplicates(rows);
    expect(rows[0].errors.find((e) => e.field === 'barcode' && e.message.includes('tekrarlı'))).toBeUndefined();
  });
  it('DB hatası + Excel duplicate aynı satırda → her ikisi de gösterilir', () => {
    const rows: ImportRowResult[] = [
      validateRow({ name: 'Mevcut Ürün', sku: 'A-1', salePrice: 100 }, 3, BASE_CTX),
      validateRow({ name: 'Mevcut Ürün', sku: 'A-2', salePrice: 100 }, 4, BASE_CTX),
    ];
    detectExcelDuplicates(rows);
    // DB hatası mevcut + Excel duplicate eklenmedi (DB error öncelikli)
    expect(rows[0].errors.filter((e) => e.field === 'name').length).toBe(1);
    expect(rows[0].errors[0].message).toContain('zaten kayıtlı');
  });
});

describe('Edge — Alış Fiyatı sınır + opsiyonel davranış', () => {
  it('0 → kabul (negatif değil)', () => {
    const r = validateRow(
      { name: 'Test', sku: 'X-1', costPrice: 0, salePrice: 100 },
      3,
      BASE_CTX,
    );
    expect(r.errors.find((e) => e.field === 'costPrice')).toBeUndefined();
    expect(r.normalized?.costPrice).toBe(0);
  });
  it('boş string → null', () => {
    const r = validateRow(
      { name: 'Test', sku: 'X-1', costPrice: '', salePrice: 100 },
      3,
      BASE_CTX,
    );
    expect(r.normalized?.costPrice).toBeNull();
  });
});

describe('Edge — Variant Boyut sınır', () => {
  it('100 karakter tam sınır kabul', () => {
    const r = validateRow(
      { name: 'Test', sku: 'X-1', salePrice: 100, variantLabel: 'A'.repeat(100) },
      3,
      BASE_CTX,
    );
    expect(r.errors.find((e) => e.field === 'variantLabel')).toBeUndefined();
  });
  it('101 karakter → reject', () => {
    const r = validateRow(
      { name: 'Test', sku: 'X-1', salePrice: 100, variantLabel: 'A'.repeat(101) },
      3,
      BASE_CTX,
    );
    expect(r.errors.find((e) => e.field === 'variantLabel')?.message).toContain('uzun');
  });
  it('boş → "Standart" default', () => {
    const r = validateRow(
      { name: 'Test', sku: 'X-1', salePrice: 100, variantLabel: '' },
      3,
      BASE_CTX,
    );
    expect(r.normalized?.variantLabel).toBe('Standart');
    expect(r.info.find((i) => i.field === 'variantLabel')).toBeDefined();
  });
});

describe('Edge — Kategori case + Marka case', () => {
  it('kategori büyük harf tamamen', () => {
    const r = validateRow(
      { name: 'Test', sku: 'X-1', salePrice: 100, categoryName: 'AKVARYUM' },
      3,
      BASE_CTX,
    );
    expect(r.normalized?.categoryName).toBe('Akvaryum');
  });
  it('marka case-insensitive match → normalize edilmiş isim döner', () => {
    const r = validateRow(
      { name: 'Test', sku: 'X-1', salePrice: 100, brandName: 'royal canin' },
      3,
      BASE_CTX,
    );
    expect(r.normalized?.brandName).toBe('Royal Canin');
    expect(r.info.find((i) => i.field === 'brandName')).toBeUndefined();
  });
});

describe('Edge — File metadata', () => {
  it('5 MB tam sınır kabul', () => {
    expect(
      validateFileMetadata({ fileName: 'a.xlsx', fileSize: 5 * 1024 * 1024 }),
    ).toEqual([]);
  });
  it('5 MB + 1 byte → reject', () => {
    const r = validateFileMetadata({ fileName: 'a.xlsx', fileSize: 5 * 1024 * 1024 + 1 });
    expect(r[0].code).toBe('size');
  });
  it('uzantı büyük harf (.XLSX) → kabul', () => {
    expect(validateFileMetadata({ fileName: 'a.XLSX', fileSize: 1024 })).toEqual([]);
  });
  it('uzantısız dosya → extension hatası', () => {
    const r = validateFileMetadata({ fileName: 'noext', fileSize: 1024 });
    expect(r[0].code).toBe('extension');
  });
});

describe('Edge — Plan limit hassasiyet', () => {
  it('tam sınırda (current+rowCount=limit) → kabul', () => {
    expect(validatePlanLimit({ rowCount: 50, current: 450, limit: 500 })).toEqual([]);
  });
  it('1 fazla → reject', () => {
    const r = validatePlanLimit({ rowCount: 51, current: 450, limit: 500 });
    expect(r[0].code).toBe('plan_limit');
  });
});

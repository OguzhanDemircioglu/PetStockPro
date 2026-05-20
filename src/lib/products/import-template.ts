/**
 * Ürün import Excel şablonu — header + 5 örnek satır.
 *
 * Sütunlar (sıra önemli — validation header check'i bu sıraya bağlı):
 *  1. Ürün Adı *
 *  2. SKU *
 *  3. Kategori
 *  4. Marka
 *  5. Variant Boyut
 *  6. Alış Fiyatı (₺)
 *  7. Satış Fiyatı (₺) *
 *  8. Stok Eşiği
 *  9. Barkod (EAN-13)
 *  10. SKT Tarihi (GG/AA/YYYY)
 *  11. İlk Stok Adedi
 *
 * Örnekler farklı senaryoları kapsar:
 *  - Mama (SKT zorunlu, marka var)
 *  - Kedi kumu (SKT yok, marka var)
 *  - Oyuncak (SKT yok, marka var)
 *  - İlaç (SKT zorunlu, geleceğe yakın tarih)
 *  - Akvaryum (sade, opsiyonel alanlar boş)
 */

import ExcelJS from 'exceljs';

export const IMPORT_TEMPLATE_HEADERS = [
  'Ürün Adı',
  'SKU',
  'Kategori',
  'Marka',
  'Variant Boyut',
  'Alış Fiyatı (₺)',
  'Satış Fiyatı (₺)',
  'Stok Eşiği',
  'Barkod (EAN-13)',
  'SKT Tarihi (GG/AA/YYYY)',
  'İlk Stok Adedi',
] as const;

export type ImportHeader = (typeof IMPORT_TEMPLATE_HEADERS)[number];

/** Header → field key eşleştirme (validation/normalize için). */
export const HEADER_TO_FIELD: Record<string, string> = {
  'Ürün Adı': 'name',
  SKU: 'sku',
  Kategori: 'categoryName',
  Marka: 'brandName',
  'Variant Boyut': 'variantLabel',
  'Alış Fiyatı (₺)': 'costPrice',
  'Satış Fiyatı (₺)': 'salePrice',
  'Stok Eşiği': 'threshold',
  'Barkod (EAN-13)': 'barcode',
  'SKT Tarihi (GG/AA/YYYY)': 'expiryDate',
  'İlk Stok Adedi': 'initialStock',
};

export const REQUIRED_HEADERS: readonly ImportHeader[] = ['Ürün Adı', 'SKU', 'Satış Fiyatı (₺)'];

/**
 * Örnek satırlar — kullanıcı bu satırları **silmeli** kendi ürünlerini eklemeden önce.
 * Şablonda bu uyarıyı ayrı bir bilgi satırı olarak (gri italik) gösterir.
 */
const SAMPLE_ROWS: Array<Record<string, string | number>> = [
  {
    'Ürün Adı': 'Royal Canin Adult Kedi Maması 2 kg',
    SKU: 'RC-AD-KEDI-2KG',
    Kategori: 'Kedi Kuru Mama',
    Marka: 'Royal Canin',
    'Variant Boyut': '2 kg',
    'Alış Fiyatı (₺)': 450,
    'Satış Fiyatı (₺)': 599.9,
    'Stok Eşiği': 5,
    'Barkod (EAN-13)': '3182550712965',
    'SKT Tarihi (GG/AA/YYYY)': '31/12/2027',
    'İlk Stok Adedi': 20,
  },
  {
    'Ürün Adı': "Biokat's Pelet Kedi Kumu 5 L",
    SKU: 'BK-PELET-5L',
    Kategori: 'Kedi Kumu',
    Marka: "Biokat's",
    'Variant Boyut': '5 L',
    'Alış Fiyatı (₺)': 120,
    'Satış Fiyatı (₺)': 189.5,
    'Stok Eşiği': 8,
    'Barkod (EAN-13)': '4002064614571',
    'SKT Tarihi (GG/AA/YYYY)': '',
    'İlk Stok Adedi': 30,
  },
  {
    'Ürün Adı': 'Kong Classic Köpek Oyuncağı M',
    SKU: 'KONG-CLASSIC-M',
    Kategori: 'Köpek Oyuncak',
    Marka: 'Kong',
    'Variant Boyut': 'M',
    'Alış Fiyatı (₺)': 120,
    'Satış Fiyatı (₺)': 249,
    'Stok Eşiği': 3,
    'Barkod (EAN-13)': '',
    'SKT Tarihi (GG/AA/YYYY)': '',
    'İlk Stok Adedi': 15,
  },
  {
    'Ürün Adı': 'Frontline Combo Spot On Kedi 3\'lü',
    SKU: 'FL-COMBO-KEDI-3',
    Kategori: 'Sağlık ve Bakım',
    Marka: 'Frontline',
    'Variant Boyut': '3 pipet',
    'Alış Fiyatı (₺)': 180,
    'Satış Fiyatı (₺)': 320,
    'Stok Eşiği': 4,
    'Barkod (EAN-13)': '3661103060789',
    'SKT Tarihi (GG/AA/YYYY)': '15/06/2027',
    'İlk Stok Adedi': 10,
  },
  {
    'Ürün Adı': 'Tetra Pro Color Balık Yemi 100 g',
    SKU: 'TT-PRO-100G',
    Kategori: 'Akvaryum',
    Marka: 'Tetra',
    'Variant Boyut': '100 g',
    'Alış Fiyatı (₺)': 42,
    'Satış Fiyatı (₺)': 78.5,
    'Stok Eşiği': 10,
    'Barkod (EAN-13)': '',
    'SKT Tarihi (GG/AA/YYYY)': '01/03/2028',
    'İlk Stok Adedi': 40,
  },
];

/**
 * .xlsx şablonu üretir — Uint8Array döner.
 *
 * Görsel düzen:
 *   ROW 1: Bilgi başlığı (sarı bg, merged): "📋 Bu örnek satırları silip kendi ürünlerini ekle"
 *   ROW 2: BAŞLIK satırı (turuncu bg, kalın beyaz)
 *   ROW 3-7: Örnek satırlar (gri italik — silinmesi gerektiğini vurgular)
 *   ROW 8+: Kullanıcının kendi satırları (boş)
 *
 * Validation bu sıraya bağlı: header row=2, data row=3+.
 */
export async function buildImportTemplate(): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PetStockPro';
  wb.created = new Date();

  const ws = wb.addWorksheet('Ürünler', {
    views: [{ state: 'frozen', ySplit: 2 }],
  });

  const colCount = IMPORT_TEMPLATE_HEADERS.length;

  // ROW 1 — Bilgi başlığı (sarı bg)
  ws.mergeCells(1, 1, 1, colCount);
  const infoCell = ws.getCell(1, 1);
  infoCell.value =
    '📋 Aşağıdaki 5 örnek satırı sil → kendi ürünlerini ekle. * işaretli sütunlar zorunlu. Tarih formatı: GG/AA/YYYY.';
  infoCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF7A5C00' } };
  infoCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFF4D6' }, // light yellow
  };
  infoCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  ws.getRow(1).height = 30;

  // ROW 2 — HEADER (turuncu bg)
  const requiredSet = new Set<string>(REQUIRED_HEADERS);
  IMPORT_TEMPLATE_HEADERS.forEach((h, i) => {
    const cell = ws.getCell(2, i + 1);
    cell.value = requiredSet.has(h) ? `${h} *` : h;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD44A14' }, // cat (turuncu)
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    };
  });
  ws.getRow(2).height = 32;

  // ROW 3-7 — Örnek satırlar (gri italik)
  SAMPLE_ROWS.forEach((row, rIdx) => {
    const xlRow = ws.getRow(3 + rIdx);
    IMPORT_TEMPLATE_HEADERS.forEach((h, cIdx) => {
      const cell = xlRow.getCell(cIdx + 1);
      const v = row[h];
      if (v !== '' && v !== undefined) {
        cell.value = v;
      }
      cell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF9CA3AF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' }, // gray-100
      };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      // Para sütunları sağa hizala
      if (h.includes('Fiyatı')) {
        cell.alignment.horizontal = 'right';
        cell.numFmt = '#,##0.00';
      }
      if (h === 'Stok Eşiği' || h === 'İlk Stok Adedi') {
        cell.alignment.horizontal = 'right';
        cell.numFmt = '#,##0';
      }
    });
  });

  // Sütun genişlikleri
  const widths = [38, 22, 22, 18, 16, 14, 14, 12, 18, 22, 14];
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  // Auto-filter (header row)
  ws.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: 2, column: colCount },
  };

  // Print options
  ws.pageSetup.orientation = 'landscape';
  ws.pageSetup.fitToPage = true;
  ws.pageSetup.fitToWidth = 1;
  ws.pageSetup.fitToHeight = 0;

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

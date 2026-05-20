import { describe, it, expect } from 'vitest';
import { buildXlsxBuffer, xlsxResponse } from './xlsx';
import ExcelJS from 'exceljs';

interface Row {
  name: string;
  qty: number;
  price: number;
  active: boolean;
  ts: Date;
}

const SAMPLE_ROWS: Row[] = [
  { name: 'Mama 2kg', qty: 25, price: 199.9, active: true, ts: new Date('2026-05-15T10:00:00Z') },
  { name: 'Kedi Kumu', qty: 10, price: 89.0, active: false, ts: new Date('2026-05-16T14:30:00Z') },
];

describe('buildXlsxBuffer', () => {
  it('üretilen buffer Excel olarak parse edilebiliyor', async () => {
    const buf = await buildXlsxBuffer<Row>({
      sheetName: 'Test',
      title: 'Test Sheet',
      columns: [
        { key: 'name', header: 'Ad', width: 20 },
        { key: 'qty', header: 'Adet', format: 'integer' },
        { key: 'price', header: 'Fiyat', format: 'currency_try' },
        { key: 'active', header: 'Aktif', format: 'boolean' },
        { key: 'ts', header: 'Tarih', format: 'date_tr' },
      ],
      rows: SAMPLE_ROWS,
    });
    expect(buf.byteLength).toBeGreaterThan(1000);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf.buffer as ArrayBuffer);
    const ws = wb.getWorksheet('Test');
    expect(ws).toBeDefined();
  });

  it('title satırı merged ve büyük font', async () => {
    const buf = await buildXlsxBuffer<Row>({
      sheetName: 'S',
      title: 'My Title',
      columns: [
        { key: 'name', header: 'Ad' },
        { key: 'qty', header: 'Adet', format: 'integer' },
      ],
      rows: [SAMPLE_ROWS[0]],
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf.buffer as ArrayBuffer);
    const ws = wb.getWorksheet('S')!;
    expect(ws.getCell(1, 1).value).toBe('My Title');
    expect(ws.getCell(1, 1).font?.size).toBe(16);
  });

  it('boş row dizisi → sadece header + title üretir', async () => {
    const buf = await buildXlsxBuffer<Row>({
      sheetName: 'Empty',
      title: 'Empty',
      columns: [{ key: 'name', header: 'Ad' }],
      rows: [],
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf.buffer as ArrayBuffer);
    const ws = wb.getWorksheet('Empty')!;
    expect(ws.rowCount).toBeGreaterThanOrEqual(2); // title + header
  });

  it('integer / currency / date formatları cell numFmt set ediyor', async () => {
    const buf = await buildXlsxBuffer<Row>({
      sheetName: 'F',
      title: 'F',
      columns: [
        { key: 'qty', header: 'Adet', format: 'integer' },
        { key: 'price', header: 'Fiyat', format: 'currency_try' },
        { key: 'ts', header: 'Tarih', format: 'date_tr' },
      ],
      rows: [SAMPLE_ROWS[0]],
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf.buffer as ArrayBuffer);
    const ws = wb.getWorksheet('F')!;
    // Header row at row 3 (no subtitle), data row at row 4
    const qtyCell = ws.getCell(4, 1);
    const priceCell = ws.getCell(4, 2);
    const dateCell = ws.getCell(4, 3);
    expect(qtyCell.numFmt).toBe('#,##0');
    expect(priceCell.numFmt).toContain('₺');
    expect(dateCell.numFmt).toBe('dd.mm.yyyy');
  });

  it('boolean format ✓ / ✕ string üretir', async () => {
    const buf = await buildXlsxBuffer<{ ok: boolean }>({
      sheetName: 'B',
      title: 'B',
      columns: [{ key: 'ok', header: 'OK', format: 'boolean' }],
      rows: [{ ok: true }, { ok: false }],
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf.buffer as ArrayBuffer);
    const ws = wb.getWorksheet('B')!;
    expect(ws.getCell(4, 1).value).toBe('✓');
    expect(ws.getCell(5, 1).value).toBe('✕');
  });

  it('null değer hücrede boş bırakır (string "null" yazmaz)', async () => {
    const buf = await buildXlsxBuffer<{ x: string | null }>({
      sheetName: 'N',
      title: 'N',
      columns: [{ key: 'x', header: 'X' }],
      rows: [{ x: null }, { x: 'val' }],
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf.buffer as ArrayBuffer);
    const ws = wb.getWorksheet('N')!;
    expect(ws.getCell(4, 1).value).toBeFalsy();
    expect(ws.getCell(5, 1).value).toBe('val');
  });

  it('subtitle eklenince header row 4 olur (yoksa 3)', async () => {
    const buf = await buildXlsxBuffer<Row>({
      sheetName: 'S',
      title: 'T',
      subtitle: 'sub',
      columns: [{ key: 'name', header: 'Ad' }],
      rows: [SAMPLE_ROWS[0]],
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf.buffer as ArrayBuffer);
    const ws = wb.getWorksheet('S')!;
    expect(ws.getCell(3, 1).value).toBe('sub'); // subtitle
    expect(ws.getCell(4, 1).value).toBe('Ad'); // header
  });

  it('getter fonksiyonu key olarak çalışıyor', async () => {
    const buf = await buildXlsxBuffer<Row>({
      sheetName: 'G',
      title: 'G',
      columns: [
        { key: (r) => `${r.name} (${r.qty})`, header: 'Combined' },
      ],
      rows: [SAMPLE_ROWS[0]],
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf.buffer as ArrayBuffer);
    const ws = wb.getWorksheet('G')!;
    expect(ws.getCell(4, 1).value).toBe('Mama 2kg (25)');
  });

  it('sheet name 31 karakter ile sınırlı', async () => {
    const longName = 'A'.repeat(40);
    const buf = await buildXlsxBuffer<Row>({
      sheetName: longName,
      title: 'T',
      columns: [{ key: 'name', header: 'A' }],
      rows: [],
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf.buffer as ArrayBuffer);
    expect(wb.worksheets[0].name).toBe('A'.repeat(31));
  });
});

describe('xlsxResponse', () => {
  it('Response Content-Type ve filename header set ediyor', async () => {
    const res = await xlsxResponse<Row>('test-file', {
      sheetName: 'S',
      title: 'T',
      columns: [{ key: 'name', header: 'Ad' }],
      rows: [SAMPLE_ROWS[0]],
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('spreadsheetml');
    expect(res.headers.get('content-disposition')).toContain('attachment');
    expect(res.headers.get('content-disposition')).toContain('test-file.xlsx');
  });

  it('filename özel karakterleri sanitize ediyor', async () => {
    const res = await xlsxResponse<Row>('file/with\\bad:chars', {
      sheetName: 'S',
      title: 'T',
      columns: [{ key: 'name', header: 'Ad' }],
      rows: [],
    });
    const cd = res.headers.get('content-disposition');
    expect(cd).toContain('file_with_bad_chars.xlsx');
  });
});

import { describe, it, expect } from 'vitest';
import { escapeCsvCell, rowsToCsv, csvResponseBody } from './csv';

describe('escapeCsvCell', () => {
  it('düz string', () => {
    expect(escapeCsvCell('hello')).toBe('hello');
  });

  it('number', () => {
    expect(escapeCsvCell(42)).toBe('42');
  });

  it('null/undefined → boş string', () => {
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
  });

  it(';  içeren string sarılır', () => {
    expect(escapeCsvCell('a;b')).toBe('"a;b"');
  });

  it('quote içeren string sarılır + içte """"', () => {
    expect(escapeCsvCell('a"b')).toBe('"a""b"');
  });

  it('newline içeren string sarılır', () => {
    expect(escapeCsvCell('a\nb')).toBe('"a\nb"');
  });
});

describe('rowsToCsv', () => {
  it('header + 2 satır', () => {
    const csv = rowsToCsv(['Ad', 'Adet'], [
      ['Royal Canin', 5],
      ['Hill\'s', 3],
    ]);
    expect(csv).toBe('Ad;Adet\r\nRoyal Canin;5\r\nHill\'s;3');
  });

  it('TR karakterler korunur (UTF-8)', () => {
    const csv = rowsToCsv(['Şehir'], [['İstanbul']]);
    expect(csv).toBe('Şehir\r\nİstanbul');
  });

  it('boş satır', () => {
    const csv = rowsToCsv(['A'], []);
    expect(csv).toBe('A');
  });
});

describe('csvResponseBody', () => {
  it('UTF-8 BOM ile başlar', () => {
    const body = csvResponseBody(['A'], [['x']]);
    expect(body[0]).toBe('﻿');
    expect(body.slice(1)).toBe('A\r\nx');
  });
});

/**
 * CSV export utility — Sprint 11 raporlar + KVKK veri taşıma için.
 *
 * Excel TR uyumlu UTF-8 BOM + ; delimiter (TR locale)
 * Quote escape: " → ""
 * Cell wrap: ; | newline | " içeriyorsa "..." sar.
 */

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(headers: string[], rows: (string | number | null)[][]): string {
  const headerLine = headers.map(escapeCsvCell).join(';');
  const lines = rows.map((r) => r.map(escapeCsvCell).join(';'));
  return [headerLine, ...lines].join('\r\n');
}

/**
 * UTF-8 BOM eklenmiş Buffer döner — Excel TR'de doğru karakter görünüm için.
 * Response Content-Type: text/csv; charset=utf-8.
 */
export function csvResponseBody(headers: string[], rows: (string | number | null)[][]): string {
  const BOM = '﻿';
  return BOM + rowsToCsv(headers, rows);
}

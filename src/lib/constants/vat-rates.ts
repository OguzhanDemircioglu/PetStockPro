/**
 * KDV oranları — tek kaynak (single source of truth)
 *
 * TR 2024 sonrası standart oran %20. Pet mama özel oran %10.
 * Otoritatif: docs/EKRAN-AYARLAR.md §2.3, MANTIK-HATALARI-2026-05-14 OT2-2/YT-3
 */

export const VAT_RATES = {
  STANDARD: 20,
  PET_FOOD: 10,
  REDUCED: 8,
  ZERO: 0,
} as const;

export type VatRate = typeof VAT_RATES[keyof typeof VAT_RATES];

export const VAT_RATE_OPTIONS: Array<{ value: VatRate; label: string; description: string }> = [
  { value: 20, label: '%20', description: 'Standart oran' },
  { value: 10, label: '%10', description: 'Pet mama, özel oran' },
  { value: 8, label: '%8', description: 'İndirilmiş oran' },
  { value: 0, label: '%0', description: "KDV'siz" },
];

export const DEFAULT_VAT_RATE: VatRate = VAT_RATES.STANDARD;

/**
 * KDV dahil fiyattan KDV hariç fiyat hesabı
 */
export function priceWithoutVat(priceWithVat: number, rate: VatRate): number {
  if (rate === 0) return priceWithVat;
  return priceWithVat / (1 + rate / 100);
}

/**
 * KDV hariç fiyattan KDV dahil fiyat hesabı
 */
export function priceWithVat(priceWithoutVat: number, rate: VatRate): number {
  return priceWithoutVat * (1 + rate / 100);
}

/**
 * KDV tutarı (dahil fiyattan)
 */
export function vatAmount(priceWithVat: number, rate: VatRate): number {
  return priceWithVat - priceWithoutVat(priceWithVat, rate);
}

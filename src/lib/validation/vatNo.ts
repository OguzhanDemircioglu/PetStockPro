/**
 * TR Vergi Numarası doğrulama — 10 hane VKN (kurumsal) veya 11 hane TC kimlik (şahıs)
 *
 * Otoritatif: docs/MANTIK-HATALARI-2026-05-14 O3, EKRAN-AYARLAR.md §2.1
 */

/**
 * 11 hane TC kimlik numarası checksum doğrulama
 * Algoritma: https://www.nvi.gov.tr/tc-kimlik-no-dogrulama
 */
export function isValidTcNo(value: string): boolean {
  if (!/^\d{11}$/.test(value)) return false;
  if (value[0] === '0') return false;

  const digits = value.split('').map(Number);

  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const evenSum = digits[1] + digits[3] + digits[5] + digits[7];

  const check10 = (oddSum * 7 - evenSum) % 10;
  if (check10 !== digits[9]) return false;

  const totalFirst10 = digits.slice(0, 10).reduce((a, b) => a + b, 0);
  const check11 = totalFirst10 % 10;
  if (check11 !== digits[10]) return false;

  return true;
}

/**
 * 10 hane VKN (Vergi Kimlik Numarası) checksum doğrulama
 * Algoritma: Gelir İdaresi Başkanlığı
 */
export function isValidVkn(value: string): boolean {
  if (!/^\d{10}$/.test(value)) return false;

  const digits = value.split('').map(Number);
  let sum = 0;

  for (let i = 0; i < 9; i++) {
    const tmp = (digits[i] + 9 - i) % 10;
    sum += tmp === 9 ? tmp : (tmp * (2 ** (9 - i))) % 9;
  }

  const check = (10 - (sum % 10)) % 10;
  return check === digits[9];
}

/**
 * Genel vergi numarası doğrulama — 10 (VKN) veya 11 (TC) hane
 */
export function isValidVatNo(value: string): boolean {
  const cleaned = value.replace(/\s+/g, '');
  if (cleaned.length === 10) return isValidVkn(cleaned);
  if (cleaned.length === 11) return isValidTcNo(cleaned);
  return false;
}

/**
 * Vergi numarası tipi tespit
 */
export type VatNoType = 'tc' | 'vkn' | 'invalid';

export function detectVatNoType(value: string): VatNoType {
  const cleaned = value.replace(/\s+/g, '');
  if (cleaned.length === 11 && isValidTcNo(cleaned)) return 'tc';
  if (cleaned.length === 10 && isValidVkn(cleaned)) return 'vkn';
  return 'invalid';
}

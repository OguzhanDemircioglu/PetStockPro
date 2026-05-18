/**
 * Recovery Codes — TXT dosyası serialize/parse yardımcıları
 *
 * Format: 4-karakter-blok dash 4-karakter-blok (örn. `ABCD-EFGH`).
 * Alfabe: `[A-HJ-NP-Z2-9]` — I/O/0/1 hariç (insan-okunabilir).
 *
 * Kullanım:
 * - `formatRecoveryCodesAsText(codes, opts)` — wizard / regenerate ekranlarında
 *   "📥 TXT olarak indir" için blob içeriği üretir.
 * - `extractRecoveryCodesFromText(text)` — login TOTP step'inde kullanıcı TXT
 *   dosyasını yükleyince geçerli kodları regex ile çıkarır (deduplike).
 */

export const RECOVERY_CODE_REGEX = /[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}/g;

const RECOVERY_CODE_SINGLE = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

export interface FormatRecoveryCodesOptions {
  /** Hesap kimliği (e-posta) — başlığa yazılır. */
  email?: string;
  /** Üretim zamanı — başlığa yazılır (default: now ISO). */
  generatedAt?: Date;
}

/**
 * Recovery code listesini insan-okunabilir TXT içeriğine çevir.
 *
 * Çıktı:
 * ```
 * PetStockPro — Yedek Kodlar
 * Hesap: <email>
 * Üretim: 2026-05-18T15:30:00.000Z
 *
 * 1. ABCD-EFGH
 * 2. ...
 * ```
 *
 * Her satır 1 kod (numaralı). Parser bu satırlardan kodları çıkarır;
 * yorum satırları regex ile match etmediği için skiplenir.
 */
export function formatRecoveryCodesAsText(
  codes: readonly string[],
  opts: FormatRecoveryCodesOptions = {},
): string {
  const generatedAt = (opts.generatedAt ?? new Date()).toISOString();
  const lines: string[] = [
    'PetStockPro — Yedek Kodlar',
    opts.email ? `Hesap: ${opts.email}` : '',
    `Üretim: ${generatedAt}`,
    '',
    '⚠ Her kod tek kullanımlık. Bu dosyayı güvenli bir yerde sakla.',
    '',
  ].filter(Boolean);

  codes.forEach((code, idx) => {
    lines.push(`${(idx + 1).toString().padStart(2, ' ')}. ${code}`);
  });

  lines.push('');
  return lines.join('\n');
}

/**
 * TXT içeriğinden geçerli recovery kodlarını regex ile çek.
 *
 * - Büyük harfe çevirir (kullanıcı küçük yazsa da geçerli).
 * - Dedupe (Set ile sıralı, ilk geliş sırası korunur).
 * - Geçersiz / format dışı satırları sessizce atlar (yorum satırları).
 * - Boş string için `[]` döner.
 */
export function extractRecoveryCodesFromText(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  const upper = text.toUpperCase();
  const matches = upper.match(RECOVERY_CODE_REGEX) ?? [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const code of matches) {
    if (!seen.has(code) && RECOVERY_CODE_SINGLE.test(code)) {
      seen.add(code);
      result.push(code);
    }
  }
  return result;
}

/** Tek bir kodun format'a uygun olup olmadığını döner (parser dışı kullanım için). */
export function isValidRecoveryCodeFormat(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  return RECOVERY_CODE_SINGLE.test(code.toUpperCase());
}

/** Browser tarafında dosya indirme tetikleyici (anchor click + revoke). */
export function downloadRecoveryCodesTxt(
  codes: readonly string[],
  filename: string,
  opts: FormatRecoveryCodesOptions = {},
): void {
  if (typeof window === 'undefined') return;
  const content = formatRecoveryCodesAsText(codes, opts);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Scrape-edilmiş metin alanlarını temizleyen yardımcılar.
 *
 * Catalog seed (scripts/data/pet-products-catalog.json) ve
 * petstockpro.catalog_seed_products satırlarında ortaya çıkan
 * HTML entity + fazla whitespace kalıntılarını normalize eder.
 *
 * Idempotent — temiz string yeniden temizlenirse değişmez.
 */

const NAMED_ENTITIES: Record<string, string> = {
  apos: "'",
  quot: '"',
  amp: '&',
  lt: '<',
  gt: '>',
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  laquo: '«',
  raquo: '»',
  copy: '©',
  reg: '®',
  trade: '™',
};

/**
 * `&#039;` → `'`, `&amp;` → `&`, `&quot;` → `"` vb. dönüştürür.
 * Sayısal entity'ler (`&#NNN;` ve `&#xHH;`) ve yaygın isimli entity'ler.
 * Bilinmeyen entity'ler dokunulmadan kalır.
 */
export function decodeHtmlEntities(input: string): string {
  if (!input) return input;
  return input
    .replace(/&#(\d+);/g, (_m, code: string) => {
      const n = parseInt(code, 10);
      if (!Number.isFinite(n) || n < 32 || n > 0x10ffff) return _m;
      return String.fromCodePoint(n);
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex: string) => {
      const n = parseInt(hex, 16);
      if (!Number.isFinite(n) || n < 32 || n > 0x10ffff) return _m;
      return String.fromCodePoint(n);
    })
    .replace(/&([a-zA-Z]+);/g, (m, name: string) => NAMED_ENTITIES[name] ?? m);
}

/**
 * 2+ ardışık whitespace (boşluk/tab) → tek boşluk, baş/son trim.
 * Newline karakterlerini koru (description'larda paragraf ayrımı önemli).
 */
export function normalizeInlineWhitespace(input: string): string {
  if (!input) return input;
  return input.replace(/[ \t ]{2,}/g, ' ').trim();
}

/**
 * Newline'ları da düzleştirir + multi-ws collapse + trim. Ürün adı için.
 */
export function normalizeProductName(input: string): string {
  if (!input) return input;
  const decoded = decodeHtmlEntities(input);
  return decoded.replace(/\s+/g, ' ').trim();
}

/**
 * Description: newline'lar korunur, satır içi multi-ws collapse + trim.
 */
export function normalizeProductDescription(input: string | null | undefined): string | null {
  if (input == null) return null;
  const decoded = decodeHtmlEntities(input);
  // newline'ları normalize et (\r\n / \r → \n), her satırı içsel olarak temizle, son boş satırları sil
  const lines = decoded
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => normalizeInlineWhitespace(l));
  // sondaki ardışık boş satırları at
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  while (lines.length > 0 && lines[0] === '') lines.shift();
  return lines.join('\n');
}

/**
 * Bir ürün satırı için tüm metin alanlarını temizler — diff dönerse caller karar verir.
 */
export interface ProductTextFields {
  name: string;
  description?: string | null;
}

export function cleanProductTextFields(input: ProductTextFields): {
  name: string;
  description: string | null;
  changed: boolean;
} {
  const cleanName = normalizeProductName(input.name);
  const cleanDesc = normalizeProductDescription(input.description ?? null);
  const changed =
    cleanName !== input.name || (cleanDesc ?? null) !== (input.description ?? null);
  return { name: cleanName, description: cleanDesc, changed };
}

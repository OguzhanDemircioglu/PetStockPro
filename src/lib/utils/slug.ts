/**
 * Türkçe slug üretimi — alfanumerik + tire, lowercase.
 *
 * DB tarafındaki petstockpro.tr_slug() ile aynı çıktıyı vermeli (Sprint 0 SQL):
 *   ı→i, ş→s, ğ→g, ü→u, ö→o, ç→c, [^a-z0-9]+→-, baş/son tire trim
 *
 * Slug max 90 karakter (DB unique slug + suffix için yer kalsın).
 */
export function makeSlug(input: string): string {
  return input
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

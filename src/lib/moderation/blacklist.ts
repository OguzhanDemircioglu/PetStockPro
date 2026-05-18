/**
 * TR-aware blacklist moderation — server-side inline check.
 *
 * Tüketim: server action içinde Zod sonrası `checkBlacklist(text)` çağrılır.
 * Match varsa form action sonucuna `moderationFlags` eklenir, UI'da uyarı
 * banner gösterilir (block etmez — "uyar" pattern).
 *
 * Liste ~50 kelime (TR küfür/hakaret + birkaç scam markerı). Maintenance:
 * Yeni eklenecek terim varsa BANNED listesine ekle, regex word-boundary ile
 * çalışır. Liste kasıtlı olarak küçük tutuldu — false positive'i azaltmak için
 * + güçlü casing/leetspeak normalize eder.
 *
 * Match olduğunda `categories` döner:
 *   - 'profanity' — küfür
 *   - 'insult' — hakaret
 *   - 'sexual' — cinsel içerik
 *   - 'scam' — dolandırıcılık marker'ı
 */

export type BlacklistCategory = 'profanity' | 'insult' | 'sexual' | 'scam';

export interface BlacklistMatch {
  /** Bulunan kelime (normalized form, orijinal değil). */
  term: string;
  category: BlacklistCategory;
}

export interface BlacklistCheckResult {
  /** Match var mı (en az 1). */
  flagged: boolean;
  /** Bulunan tüm match'ler (dedupe). */
  matches: BlacklistMatch[];
}

/**
 * TR-aware text normalize:
 * - Lowercase (locale TR)
 * - TR-spesifik karakterler: ı→i, ş→s, ğ→g, ü→u, ö→o, ç→c
 * - Diakritik temizleme (NFD + ASCII fallback)
 * - Leetspeak: 0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a, $→s
 * - Boşluk/dash/dot içine yerleştirilmiş karakterleri bitişik yap (s.k → sk)
 * - 2+ tekrarlanan harfleri tek harfe indir (ananaaaa → anan)
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  let n = text
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
  // Genel diakritik (Almanca/Fransızca vb.) — NFD + combining stripped
  n = n.normalize('NFD').replace(/[̀-ͯ]/g, '');
  // Leetspeak
  n = n
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's');
  // Word-içi noktalama (s.k, s*k, s_k, s-k → sk) — boşluk YOK, kelime ayracı korunur.
  // Lookbehind/lookahead ile tek geçişte tüm match'leri sıfırla (s.i.k → sik).
  n = n.replace(/(?<=[a-z])[._\-*+]+(?=[a-z])/g, '');
  // Single-letter token sequence merge (a m k → amk, s i k → sik) —
  // 2+ tek-harf token'ı bitişikleştir. False positive ufak ama abuse pattern için zorunlu.
  // Multi-token grupla + içindeki boşlukları sil.
  n = n.replace(/(?<=^|\s)([a-z](?:\s+[a-z])+)(?=\s|$)/g, (match) =>
    match.replace(/\s+/g, ''),
  );
  // Tekrar eden harfleri 2'ye indir (aaaaa → aa)
  n = n.replace(/(.)\1{2,}/g, '$1$1');
  return n;
}

/**
 * Yasaklı kelime listesi — küçük başla, gerektiğinde genişlet.
 * TR + universal hakaret/küfür markerlari.
 */
const BANNED: ReadonlyArray<readonly [string, BlacklistCategory]> = [
  // Profanity (TR küfür)
  ['sik', 'profanity'],
  ['sikim', 'profanity'],
  ['sikik', 'profanity'],
  ['sikis', 'profanity'],
  ['sikti', 'profanity'],
  ['amk', 'profanity'],
  ['aq', 'profanity'],
  ['amq', 'profanity'],
  ['amina', 'profanity'],
  ['aminako', 'profanity'],
  ['aminakoyim', 'profanity'],
  ['amcik', 'sexual'],
  ['amcigi', 'sexual'],
  ['orospu', 'insult'],
  ['orospucocugu', 'insult'],
  ['oc', 'insult'],
  ['piclik', 'insult'],
  ['pic', 'insult'],
  ['gotveren', 'insult'],
  ['gotlek', 'insult'],
  ['ibne', 'insult'],
  ['ibnelik', 'insult'],
  ['gerizekali', 'insult'],
  ['salak', 'insult'],
  ['aptal', 'insult'],
  ['enayi', 'insult'],
  ['serefsiz', 'insult'],
  ['namussuz', 'insult'],
  ['kahpe', 'insult'],
  ['piskevele', 'insult'],
  // Sexual
  ['porno', 'sexual'],
  ['seks', 'sexual'],
  ['sex', 'sexual'],
  ['azgin', 'sexual'],
  ['memeleri', 'sexual'],
  // Scam markerları (TR e-ticaret yaygın)
  ['bedavalink', 'scam'],
  ['kazanmilyon', 'scam'],
  ['krediopromo', 'scam'],
  ['onbinkazandim', 'scam'],
  // Universal İngilizce
  ['fuck', 'profanity'],
  ['fucking', 'profanity'],
  ['shit', 'profanity'],
  ['bitch', 'insult'],
  ['asshole', 'insult'],
  ['nigger', 'insult'],
  ['cunt', 'sexual'],
  ['dick', 'sexual'],
  ['pussy', 'sexual'],
];

/** Yasaklı kelimeyi sınır karakterleriyle regex'e çevir (word-boundary). */
function buildRegex(term: string): RegExp {
  // Term zaten normalize edilmiş — başında/sonunda non-letter veya string boundary.
  return new RegExp(`(^|[^a-z])${term}([^a-z]|$)`, 'i');
}

/**
 * Sync blacklist check — TR-aware normalize + word-boundary regex match.
 *
 * - boş/null input → flagged=false
 * - normalize + her BANNED term için regex test
 * - Match category göre dedupe + ilk gelen kalır
 */
export function checkBlacklist(text: string | null | undefined): BlacklistCheckResult {
  if (!text || typeof text !== 'string') {
    return { flagged: false, matches: [] };
  }
  const normalized = normalizeText(text);
  if (!normalized) {
    return { flagged: false, matches: [] };
  }
  const seen = new Set<string>();
  const matches: BlacklistMatch[] = [];
  for (const [term, category] of BANNED) {
    if (seen.has(term)) continue;
    if (buildRegex(term).test(normalized)) {
      seen.add(term);
      matches.push({ term, category });
    }
  }
  return { flagged: matches.length > 0, matches };
}

/** Toplam yasaklı kelime sayısı (test/diagnostic için). */
export function getBlacklistSize(): number {
  return BANNED.length;
}

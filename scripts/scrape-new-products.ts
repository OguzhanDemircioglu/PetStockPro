/**
 * Pet Products Catalog — Yeni ürün scrape + image download (v0.2.0 genişletme)
 *
 * Mevcut katalog (328 ürün, ~46 marka) üzerine kanonik kaynaklardan
 * yeni ürünler eklemek için credit-free direct HTML fetch akışı:
 *
 *   1. URL listesi: $TEMP/seed-data/scrape-targets.txt (936 URL)
 *   2. Her URL için: HTML fetch → og:title + og:image + og:description regex
 *   3. URL slug + og:title'tan brand/name/weight çıkar
 *   4. URL slug'tan categorySlug + animalType infer
 *   5. Görsel YOK → ürünü SKIP (v0.2.0 kuralı)
 *   6. Görsel indir → sha1(brand/name) ilk 16 hex → scripts/data/images/{hash}.{ext}
 *   7. Mevcut catalog ile dedup (brand+name+weight key, lowercase trim)
 *   8. Output: scripts/data/scrape-output.json
 *
 * Çalıştırma:
 *   npx tsx scripts/scrape-new-products.ts
 *
 * Rate limit: 6 paralel, 400ms throttle. ~5-10 dk tahmini süre.
 *
 * Mevcut enrich-product-images.ts ile akrabalık: aynı sha1 hash + image
 * download akışı, aynı USER_AGENT, aynı 5MB max image limit.
 */

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

// ---------- Paths ----------
const TARGETS_PATH = resolve(tmpdir(), 'seed-data/scrape-targets.txt');
const CATALOG_PATH = resolve(process.cwd(), 'scripts/data/pet-products-catalog.json');
const IMAGES_DIR = resolve(process.cwd(), 'scripts/data/images');
const IMAGES_REL = 'scripts/data/images';
const OUTPUT_PATH = resolve(process.cwd(), 'scripts/data/scrape-output.json');

// ---------- Tuning ----------
const CONCURRENCY = 6;
const DELAY_MS = 400;
const TIMEOUT_MS = 15_000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';

// ---------- Types ----------
type AnimalType = 'cat' | 'dog' | 'bird' | 'fish' | 'rabbit' | 'hamster' | 'reptile';

interface ScrapedProduct {
  name: string;
  brand: string;
  categorySlug: string;
  animalType: AnimalType;
  weight: string;
  barcode: string | null;
  imageUrl: string;
  imagePath: string;
  description: string;
  sourceUrl: string;
}

interface ExistingProduct {
  name: string;
  brand: string;
  weight: string;
}

interface CatalogShape {
  products: ExistingProduct[];
}

// ---------- Brand whitelist (canonical names) ----------
// URL slug eşlemesi: en uzun slug'ı önce kontrol et (greedy match).
const BRAND_MAP: Array<{ slug: string; canonical: string }> = [
  // 4+ word brands first
  { slug: 'hills-science-plan', canonical: "Hill's Science Plan" },
  { slug: 'hills-prescription-diet', canonical: "Hill's Prescription Diet" },
  { slug: 'royal-canin-veterinary', canonical: 'Royal Canin Veterinary' },
  { slug: 'versele-laga-prestige', canonical: 'Versele-Laga Prestige' },
  { slug: 'versele-laga-nutribird', canonical: 'Versele-Laga NutriBird' },
  { slug: 'versele-laga-loro-parque', canonical: 'Versele-Laga Loro Parque' },
  { slug: 'pro-choice', canonical: 'Pro Choice' },
  { slug: 'pro-plan', canonical: 'Pro Plan' },
  { slug: 'pro-diet', canonical: 'ProDiet' },
  { slug: 'pro-line', canonical: 'ProLine' },
  { slug: 'cats-best', canonical: "Cat's Best" },
  { slug: 'ever-clean', canonical: 'Ever Clean' },
  { slug: 'tidy-cats', canonical: 'Tidy Cats' },
  { slug: 'jr-farm', canonical: 'JR Farm' },
  { slug: 'reflex-plus', canonical: 'Reflex Plus' },
  { slug: 'brit-care', canonical: 'Brit Care' },
  { slug: 'gardenmix-platin', canonical: 'Gardenmix Platin' },
  { slug: 'biokats', canonical: "Biokat's" },
  { slug: 'farmina-nd', canonical: 'N&D' },
  { slug: 'dog-chow', canonical: 'Purina Dog Chow' },
  { slug: 'felix', canonical: 'Felix' },
  { slug: 'cesar', canonical: 'Cesar' },

  // 2-3 word brands
  { slug: 'royal-canin', canonical: 'Royal Canin' },
  { slug: 'versele-laga', canonical: 'Versele-Laga' },
  { slug: 'proplan', canonical: 'Pro Plan' },
  { slug: 'prochoice', canonical: 'Pro Choice' },
  { slug: 'lindocat', canonical: 'Lindocat' },
  { slug: 'sanabelle', canonical: 'Sanabelle' },
  { slug: 'sanicat', canonical: 'Sanicat' },
  { slug: 'sepicat', canonical: 'Sepicat' },
  { slug: 'catsan', canonical: 'Catsan' },
  { slug: 'beaphar', canonical: 'Beaphar' },
  { slug: 'belcando', canonical: 'Belcando' },
  { slug: 'eurogold', canonical: 'EuroGold' },
  { slug: 'gardenmix', canonical: 'Gardenmix' },
  { slug: 'pronature', canonical: 'Pronature' },
  { slug: 'pedigree', canonical: 'Pedigree' },
  { slug: 'whiskas', canonical: 'Whiskas' },
  { slug: 'sheba', canonical: 'Sheba' },
  { slug: 'friskies', canonical: 'Friskies' },
  { slug: 'gourmet', canonical: 'Gourmet' },
  { slug: 'purina', canonical: 'Purina' },
  { slug: 'miratorg', canonical: 'Miratorg' },
  { slug: 'reflex', canonical: 'Reflex' },
  { slug: 'vancat', canonical: 'Vancat' },
  { slug: 'felix', canonical: 'Felix' },
  { slug: 'acana', canonical: 'Acana' },
  { slug: 'orijen', canonical: 'Orijen' },
  { slug: 'bozita', canonical: 'Bozita' },
  { slug: 'bosch', canonical: 'Bosch' },
  { slug: 'obivan', canonical: 'Obivan' },
  { slug: 'lavital', canonical: 'LaVital' },
  { slug: 'la-vital', canonical: 'LaVital' },
  { slug: 'luis', canonical: 'Luis' },
  { slug: 'wanpy', canonical: 'Wanpy' },
  { slug: 'kong', canonical: 'Kong' },
  { slug: 'trixie', canonical: 'Trixie' },
  { slug: 'ferplast', canonical: 'Ferplast' },
  { slug: 'tetra', canonical: 'Tetra' },
  { slug: 'sera', canonical: 'Sera' },
  { slug: 'tropical', canonical: 'Tropical' },
  { slug: 'jbl', canonical: 'JBL' },
  { slug: 'padovan', canonical: 'Padovan' },
  { slug: 'schesir', canonical: 'Schesir' },
  { slug: 'catit', canonical: 'Catit' },
  { slug: 'animonda', canonical: 'Animonda' },
  { slug: 'gimcat', canonical: 'GimCat' },
  { slug: 'gimdog', canonical: 'GimDog' },
  { slug: 'vitakraft', canonical: 'Vitakraft' },
  { slug: 'happy-cat', canonical: 'Happy Cat' },
  { slug: 'happy-dog', canonical: 'Happy Dog' },
  { slug: 'leonardo', canonical: 'Leonardo' },
  { slug: 'almo-nature', canonical: 'Almo Nature' },
  { slug: 'arden-grange', canonical: 'Arden Grange' },
  { slug: 'eukanuba', canonical: 'Eukanuba' },
  { slug: 'lily', canonical: "Lily's Kitchen" },
  { slug: 'panzi', canonical: 'Panzi' },
  { slug: 'pet-style', canonical: 'Pet Style' },
  { slug: 'challenge', canonical: 'Challenge' },
  { slug: 'herniks', canonical: 'Herniks' },
  { slug: 'vetsmell', canonical: 'Vetsmell' },
  { slug: 'vetoquinol', canonical: 'Vetoquinol' },
  { slug: 'bayer', canonical: 'Bayer' },
  { slug: 'sentry', canonical: 'Sentry' },
  { slug: 'nutri-vet', canonical: 'Nutri-Vet' },
  { slug: 'flexi', canonical: 'Flexi' },
  { slug: 'savic', canonical: 'Savic' },
  { slug: 'sanal', canonical: 'Sanal' },
  { slug: 'tropi-fit', canonical: 'TropiFit' },
  { slug: 'biokat', canonical: "Biokat's" },
  { slug: 'pi-pi-pet', canonical: 'Pi Pi Pet' },
  { slug: 'panzi', canonical: 'Panzi' },

  // --- Round 2 brand additions (analyze-unknown-brands çıktısından) ---
  // En uzun slug'lar önce sırayla — greedy match
  { slug: 'garden-mix-platin', canonical: 'Gardenmix Platin' },
  { slug: 'garden-mix', canonical: 'Gardenmix' },
  { slug: 'vet-s-plus', canonical: "Vet's Plus" },
  { slug: 'optimeal-super-premium', canonical: 'Optimeal Super Premium' },
  { slug: 'optimeal', canonical: 'Optimeal' },
  { slug: 'pro-performance', canonical: 'Pro Performance' },
  { slug: 'chefs-choice', canonical: "Chef's Choice" },
  { slug: 'club4paws-premium', canonical: 'Club4Paws Premium' },
  { slug: 'club4paws', canonical: 'Club4Paws' },
  { slug: 'brit-veterinary-diet', canonical: 'Brit Veterinary Diet' },
  { slug: 'hill-s-science', canonical: "Hill's Science Plan" },
  { slug: 'hill-s-prescription', canonical: "Hill's Prescription Diet" },
  { slug: 'inaba-ciao-churu', canonical: 'Inaba Ciao Churu' },
  { slug: 'inaba-churu', canonical: 'Inaba Churu' },
  { slug: 'inaba', canonical: 'Inaba' },
  { slug: 'gold-wings-premium', canonical: 'Gold Wings Premium' },
  { slug: 'gold-wings', canonical: 'Gold Wings' },
  { slug: 'nd-tropical-selection', canonical: 'N&D Tropical Selection' },
  { slug: 'nd-ocean', canonical: 'N&D Ocean' },
  { slug: 'nd-prime', canonical: 'N&D Prime' },
  { slug: 'n-d-prime', canonical: 'N&D Prime' },
  { slug: 'nd-dusuk-tahilli', canonical: 'N&D Düşük Tahıllı' },
  { slug: 'pawise', canonical: 'Pawise' },
  { slug: 'proline', canonical: 'ProLine' },
  { slug: 'me-o', canonical: 'Me-O' },
  { slug: 'imac', canonical: 'IMAC' },
  { slug: 'petline', canonical: 'Petline' },
  { slug: 'dr-sacchi', canonical: 'Dr. Sacchi' },
  { slug: 'drsacchi', canonical: 'Dr. Sacchi' },
  { slug: 'ro-cat', canonical: 'RO-Cat' },
  { slug: 'fitmin', canonical: 'Fitmin' },
  { slug: 'm-pets', canonical: 'M-Pets' },
  { slug: 'curli', canonical: 'Curli' },
  { slug: 'bonnie', canonical: 'Bonnie' },
  { slug: 'felicia', canonical: 'Felicia' },
  { slug: 'moderna', canonical: 'Moderna' },
  { slug: 'spectrum', canonical: 'Spectrum' },
  { slug: 'advance', canonical: 'Advance' },
  { slug: 'flamingo', canonical: 'Flamingo' },
  { slug: 'rokus', canonical: 'Rokus' },
  { slug: 'eastland', canonical: 'Eastland' },
  { slug: 'karlie', canonical: 'Karlie' },
  { slug: 'o-dog', canonical: "O'Dog" },
  { slug: '8-in-1', canonical: '8in1' },
  { slug: 'nutri-feline', canonical: 'Nutri-Feline' },
  { slug: 'zampa-plus', canonical: 'Zampa Plus' },
  { slug: 'zampa', canonical: 'Zampa' },
  { slug: 'sandy-cat', canonical: 'Sandy Cat' },
  { slug: 'sandy', canonical: 'Sandy' },
];

// ---------- Slug helpers ----------
function slugToWords(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectBrand(urlPath: string): { canonical: string; matchedSlug: string } | null {
  const slugPath = urlPath.toLowerCase();
  // En uzun slug match'i için map'i sırasına göre kontrol et (map zaten uzunluk sırasına göre)
  for (const { slug, canonical } of BRAND_MAP) {
    if (slugPath.startsWith(slug + '-') || slugPath.includes('/' + slug + '-')) {
      return { canonical, matchedSlug: slug };
    }
  }
  return null;
}

// Weight patterns:
//   "2-kg" (2 kg), "850-gr" (850 g), "1-5-kg" (1.5 kg), "100-ml" (100 ml), "12-li" (12 adet),
//   "2kg" (no dash, petlebi style), "15kg.html", "1-5kg.html" (1.5 kg petlebi),
//   "850gr", "100ml", "2.5kg"
// Greedy: önce ana sayı, sonra opsiyonel decimal (- veya . ile), sonra opsiyonel sep, sonra unit
const WEIGHT_RE = /[-_](\d+)(?:[-_.](\d+))?[-_]?(kg|gr|g|ml|l|cm|adet|li|lu|adetlik)(?:[-_]|\.|$)/i;

function extractWeight(urlPath: string): string | null {
  const m = urlPath.toLowerCase().match(WEIGHT_RE);
  if (!m) return null;
  const main = m[1];
  const decimal = m[2];
  const unit = m[3].toLowerCase();
  const num = decimal ? `${main}.${decimal}` : main;
  const unitMap: Record<string, string> = {
    kg: 'kg',
    gr: 'g',
    g: 'g',
    ml: 'ml',
    l: 'L',
    cm: 'cm',
    adet: 'adet',
    li: 'adet',
    lu: 'adet',
    adetlik: 'adet',
  };
  return `${num} ${unitMap[unit] ?? unit}`;
}

// ---------- Animal + category inference ----------
function inferAnimalType(urlPath: string, title: string): AnimalType | null {
  const text = `${urlPath} ${title}`.toLowerCase();
  if (/(\bkedi\b|cat(?!fish)|kitten)/i.test(text)) return 'cat';
  if (/(\bkopek\b|köpek|\bdog\b|puppy)/i.test(text)) return 'dog';
  if (/(muhabbet|papagan|kanarya|paraket|finch|sultan-pap|\bkus\b|kuş|\bbird\b)/i.test(text))
    return 'bird';
  if (/(akvaryum|aquarium|\bbalik\b|balık|\bfish\b|cichlid|discus|guppy|tetra-)/i.test(text))
    return 'fish';
  if (/(tavsan|tavşan|rabbit)/i.test(text)) return 'rabbit';
  if (/(hamster|gerbil|fare|mouse|rat-)/i.test(text)) return 'hamster';
  if (/(kaplumbaga|kaplumbağa|reptile|surungen|sürüngen|gecko|lizard|tortoise|turtle|iguana)/i.test(
    text,
  ))
    return 'reptile';
  return null;
}

// Category slug map — animalType + URL slug → categorySlug
function inferCategorySlug(animalType: AnimalType, urlPath: string, title: string): string | null {
  const text = `${urlPath} ${title}`.toLowerCase();
  // Cat
  if (animalType === 'cat') {
    if (/yas-mama|wet-food|konserve|pouch/i.test(text)) return 'kedi-yas-mamalar';
    if (/odul|tre+at|snack|kraker/i.test(text)) return 'kedi-oduller';
    if (/kuru-mama|dry-food|mama/i.test(text)) return 'kedi-kuru-mamalar';
    if (/kum|litter|cat-litter/i.test(text)) return 'kedi-kumlar';
    if (/oyuncak|tirmalama|tirmalamasi|toy|catnip/i.test(text)) return 'kedi-oyuncaklar';
    if (/tasma|harness|collar/i.test(text)) return 'kedi-tasmalar';
    if (/yatak|yuva|bed/i.test(text)) return 'kedi-yatak-ve-yuvalar';
    if (/sampuan|sampuani|kolonya|bakim|firca|tarak|tirnak|deodorant/i.test(text))
      return 'kedi-bakim-urunleri';
    if (/vitamin|katki|supplement|destek|takviye/i.test(text)) return 'kedi-vitamin-ve-katkilari';
    if (/mama-kab|su-kab|bowl|kab\b/i.test(text)) return 'kedi-mama-ve-su-kaplari';
    return 'kedi-kuru-mamalar'; // fallback
  }
  // Dog
  if (animalType === 'dog') {
    if (/yas-mama|wet-food|konserve|pouch|et-ezmesi/i.test(text)) return 'kopek-yas-mamalar';
    if (/odul|kemik|treat|snack|biskuvi|jerky/i.test(text)) return 'kopek-oduller';
    if (/kuru-mama|dry-food|mama/i.test(text)) return 'kopek-kuru-mamalar';
    if (/oyuncak|toy/i.test(text)) return 'kopek-oyuncaklar';
    if (/tasma|kayis|harness|collar/i.test(text)) return 'kopek-tasmalar';
    if (/gezdirme|leash|kayis|fluksi|flexi/i.test(text)) return 'kopek-gezdirme-urunleri';
    if (/yatak|bed|kulube|kulübe/i.test(text)) return 'kopek-yataklar';
    if (/mama-kab|su-kab|bowl|kab\b|otomatik-mama/i.test(text)) return 'kopek-mama-ve-su-kaplari';
    if (/sampuan|sampuani|bakim|firca|tarak|tirnak|deodorant|kolonya/i.test(text))
      return 'kopek-bakim-urunleri';
    if (/vitamin|takviye|supplement|destek|katki/i.test(text)) return 'kopek-vitaminler';
    return 'kopek-aksesuarlar';
  }
  // Bird
  if (animalType === 'bird') {
    if (/kraker|cracker|stick/i.test(text)) return 'kus-krakerler';
    if (/yem|food|seed|tohum|tahil|grain/i.test(text)) return 'kus-yemler';
    if (/kum|sand|grit/i.test(text)) return 'kus-kumlar';
    if (/kafes|cage/i.test(text)) return 'kus-kafesler';
    if (/oyuncak|toy/i.test(text)) return 'kus-oyuncaklar';
    return 'kus-aksesuarlar';
  }
  // Fish (aquarium)
  if (animalType === 'fish') {
    if (/vitamin|mineral|takviye|supplement/i.test(text)) return 'akvaryum-balik-vitamin-mineral';
    if (/yem|food|pellet|flake|tablet|granule/i.test(text)) return 'akvaryum-balik-yemi';
    if (/fanus|akvaryum-cam|aquarium\b/i.test(text)) return 'akvaryum-ve-fanus';
    if (/filtre|filter/i.test(text)) return 'akvaryum-filtreler';
    if (/aydinlatma|lighting|lamba|led/i.test(text)) return 'akvaryum-aydinlatma';
    if (/isitici|isitma|sogutma|cooler|heater/i.test(text)) return 'akvaryum-isitma-sogutma';
    if (/su-duzenleyici|water-conditioner|conditioner|stabilizator|nitrat|ph-/i.test(text))
      return 'akvaryum-su-duzenleyiciler';
    if (/bakim|temizlik|cleaner|sunger/i.test(text)) return 'akvaryum-bakim-temizlik';
    return 'akvaryum-ekipman-aksesuarlar';
  }
  // Rodent (rabbit + hamster + kemirgen)
  if (animalType === 'rabbit' || animalType === 'hamster') {
    if (/yem|food|tohum|pellet|saman/i.test(text)) return 'kemirgen-yemler';
    if (/kafes|cage/i.test(text)) return 'kemirgen-kafesler';
    if (/oyuncak|toy|tekerlek|wheel/i.test(text)) return 'kemirgen-oyuncaklar';
    if (/sampuan|bakim|firca|sa[gğ]l[iı]k/i.test(text)) return 'kemirgen-bakim-saglik';
    return 'kemirgen-yemler';
  }
  // Reptile
  if (animalType === 'reptile') {
    if (/yem|food|pellet|gammarus/i.test(text)) return 'surungenler-yemi';
    if (/taban|substrate|kum|sand/i.test(text)) return 'surungenler-taban-malzemeleri';
    return 'surungenler-aksesuarlar';
  }
  return null;
}

// ---------- HTTP / regex extractors ----------
const META_OG_TITLE = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i;
const META_OG_TITLE_REV = /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i;
const META_OG_IMAGE = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i;
const META_OG_IMAGE_REV = /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i;
const META_TW_IMAGE = /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i;
const META_OG_DESC = /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i;
const META_OG_DESC_REV = /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i;
const TITLE_TAG = /<title[^>]*>([^<]+)<\/title>/i;
// EAN-13 barcode pattern (13 hane), product:retailer_item_id veya schema/itemprop="gtin13"
const META_BARCODE_GTIN =
  /<meta[^>]+(?:itemprop|property)=["'](?:gtin13|product:retailer_item_id|brand:gtin13)["'][^>]+content=["'](\d{8,14})["']/i;

function pick(html: string, ...regexes: RegExp[]): string | null {
  for (const r of regexes) {
    const m = html.match(r);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'tr-TR,tr;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function resolveImageUrl(raw: string, baseUrl: string): string | null {
  const candidate = raw.trim();
  if (!candidate) return null;
  if (candidate.startsWith('http')) return candidate;
  if (candidate.startsWith('//')) return `https:${candidate}`;
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return null;
  }
}

function extOfContentType(ct: string | null): string | null {
  if (!ct) return null;
  const c = ct.toLowerCase();
  if (c.includes('jpeg') || c.includes('jpg')) return 'jpg';
  if (c.includes('png')) return 'png';
  if (c.includes('webp')) return 'webp';
  if (c.includes('gif')) return 'gif';
  if (c.includes('avif')) return 'avif';
  return null;
}

function extOfUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\.(jpe?g|png|webp|gif|avif)(?:$|\?)/i);
    if (!m) return null;
    const e = m[1].toLowerCase();
    return e === 'jpeg' ? 'jpg' : e;
  } catch {
    return null;
  }
}

async function downloadImage(
  imageUrl: string,
  refererUrl: string,
): Promise<{ buffer: Buffer; ext: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(imageUrl, {
      headers: {
        'user-agent': USER_AGENT,
        accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        referer: refererUrl,
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type');
    if (ct && !ct.toLowerCase().startsWith('image/')) return null;
    const cl = res.headers.get('content-length');
    if (cl && Number(cl) > MAX_IMAGE_BYTES) return null;
    const ext = extOfContentType(ct) ?? extOfUrl(imageUrl) ?? 'jpg';
    const arr = await res.arrayBuffer();
    if (arr.byteLength > MAX_IMAGE_BYTES) return null;
    return { buffer: Buffer.from(arr), ext };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function hashKey(brand: string, name: string): string {
  return createHash('sha1').update(`${brand}/${name}`).digest('hex').slice(0, 16);
}

// ---------- Title cleanup ----------
function cleanTitle(raw: string): string {
  return raw
    .replace(/\s*[-–|]\s*Markamama.*$/i, '')
    .replace(/\s*[-–|]\s*Petlebi.*$/i, '')
    .replace(/\s*[-–|]\s*7\/24.*$/i, '')
    .replace(/\s*\(\s*\d+(\.\d+)?\s*tl\s*\).*$/i, '')
    .replace(/Şimdi Satın Al.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------- Worker ----------
interface ParseResult {
  product: ScrapedProduct | null;
  reason: string;
}

async function processOne(
  url: string,
  dedupSet: Set<string>,
  newDedupSet: Set<string>,
): Promise<ParseResult> {
  let urlObj: URL;
  try {
    urlObj = new URL(url);
  } catch {
    return { product: null, reason: 'invalid_url' };
  }

  // URL slug bazlı ön-filtre
  const path = urlObj.pathname.replace(/^\/+/, '').replace(/\.html$/, '');
  const brandDetect = detectBrand(path);
  const weight = extractWeight(path);
  if (!brandDetect) return { product: null, reason: 'brand_unknown' };
  if (!weight) return { product: null, reason: 'weight_missing' };

  const html = await fetchText(url);
  if (!html) return { product: null, reason: 'fetch_failed' };

  // Image al → yoksa skip
  const rawImage = pick(html, META_OG_IMAGE, META_OG_IMAGE_REV, META_TW_IMAGE);
  if (!rawImage) return { product: null, reason: 'no_og_image' };
  const imageUrl = resolveImageUrl(rawImage, url);
  if (!imageUrl) return { product: null, reason: 'image_url_invalid' };

  // Title al
  const ogTitle = pick(html, META_OG_TITLE, META_OG_TITLE_REV) ?? pick(html, TITLE_TAG);
  if (!ogTitle) return { product: null, reason: 'no_title' };
  let name = cleanTitle(ogTitle);
  // Brand'ı title başından çıkar — name canonical olur (örn "Royal Canin Kitten 2 KG" → "Kitten 2 KG" değil,
  // tam canonical isim "Royal Canin Kitten Yavru Kedi Maması 2 KG" şeklinde tutalım)
  // Mevcut catalog stiline uyacak şekilde TAM ad bırakıyorum (brand dahil)
  if (name.length < 8) return { product: null, reason: 'title_too_short' };
  if (name.length > 200) name = name.slice(0, 200).trim();

  // AnimalType + categorySlug infer
  const animalType = inferAnimalType(path, name);
  if (!animalType) return { product: null, reason: 'animal_unknown' };
  const categorySlug = inferCategorySlug(animalType, path, name);
  if (!categorySlug) return { product: null, reason: 'category_unknown' };

  // Barcode opsiyonel
  const barcode = pick(html, META_BARCODE_GTIN);

  // Description
  const ogDesc = pick(html, META_OG_DESC, META_OG_DESC_REV) ?? '';
  const description =
    ogDesc.length > 10
      ? ogDesc.slice(0, 300).trim()
      : `${brandDetect.canonical} markasının ${animalType === 'cat' ? 'kedi' : animalType === 'dog' ? 'köpek' : animalType === 'bird' ? 'kuş' : animalType === 'fish' ? 'akvaryum' : animalType === 'rabbit' ? 'tavşan' : animalType === 'hamster' ? 'hamster' : 'sürüngen'} ürünü.`;

  // Dedup check
  const dedupKey = `${brandDetect.canonical}|${name}|${weight}`.toLowerCase().trim();
  if (dedupSet.has(dedupKey)) return { product: null, reason: 'duplicate_existing' };
  if (newDedupSet.has(dedupKey)) return { product: null, reason: 'duplicate_within_batch' };
  newDedupSet.add(dedupKey);

  // Image indir
  const result = await downloadImage(imageUrl, url);
  if (!result) return { product: null, reason: 'image_download_failed' };

  const fname = `${hashKey(brandDetect.canonical, name)}.${result.ext}`;
  const abs = resolve(IMAGES_DIR, fname);
  // Hash çakışması varsa (aynı brand+name iki kez) overwrite OK — content yine doğru
  await writeFile(abs, result.buffer);

  return {
    product: {
      name,
      brand: brandDetect.canonical,
      categorySlug,
      animalType,
      weight,
      barcode: barcode && /^\d{8,14}$/.test(barcode) ? barcode : null,
      imageUrl,
      imagePath: `${IMAGES_REL}/${fname}`,
      description,
      sourceUrl: url,
    },
    reason: 'ok',
  };
}

// ---------- Concurrency runner ----------
async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  let cursor = 0;
  let done = 0;
  const total = items.length;
  async function pump(): Promise<void> {
    while (cursor < items.length) {
      const idx = cursor++;
      await worker(items[idx], idx);
      done += 1;
      onProgress?.(done, total);
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }
  const pumps = Array.from({ length: Math.min(concurrency, items.length) }, () => pump());
  await Promise.all(pumps);
}

// ---------- Main ----------
async function main(): Promise<void> {
  console.log('[scrape] Loading targets...');
  const rawTargets = await readFile(TARGETS_PATH, 'utf8');
  const targets = rawTargets
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('http'));
  console.log(`[scrape] ${targets.length} URLs queued`);

  console.log('[scrape] Loading existing catalog for dedup...');
  const catalogRaw = await readFile(CATALOG_PATH, 'utf8');
  const catalog = JSON.parse(catalogRaw) as CatalogShape;
  const dedupSet = new Set<string>();
  for (const p of catalog.products) {
    const key = `${p.brand}|${p.name}|${p.weight}`.toLowerCase().trim();
    dedupSet.add(key);
  }
  console.log(`[scrape] ${dedupSet.size} existing keys in dedup set`);

  await mkdir(IMAGES_DIR, { recursive: true });

  const newDedupSet = new Set<string>();
  const products: ScrapedProduct[] = [];
  const reasonCounts: Record<string, number> = {};

  await runWithConcurrency(
    targets,
    CONCURRENCY,
    async (url) => {
      const { product, reason } = await processOne(url, dedupSet, newDedupSet);
      reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
      if (product) products.push(product);
    },
    (done, total) => {
      if (done % 10 === 0 || done === total) {
        process.stdout.write(`\r[scrape] ${done}/${total} (got ${products.length})`);
      }
    },
  );
  process.stdout.write('\n');

  console.log('[scrape] Reason breakdown:');
  for (const [r, c] of Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${r.padEnd(28)} ${c}`);
  }

  await writeFile(OUTPUT_PATH, JSON.stringify({ products }, null, 2));

  // Image klasör boyutu
  let totalBytes = 0;
  try {
    const { readdir } = await import('node:fs/promises');
    const files = await readdir(IMAGES_DIR);
    for (const f of files) {
      const s = await stat(resolve(IMAGES_DIR, f));
      totalBytes += s.size;
    }
  } catch {
    /* ignore */
  }

  console.log(
    `[scrape] Done. Scraped ${products.length} new products. Image dir: ${(totalBytes / 1024 / 1024).toFixed(1)} MB`,
  );
  console.log(`[scrape] Output: ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('[scrape] FATAL:', err);
  process.exit(1);
});

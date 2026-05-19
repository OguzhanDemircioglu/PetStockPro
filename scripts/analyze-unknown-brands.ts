/**
 * brand_unknown URL'leri analiz et — en sık görülen marka slug'larını çıkar
 * ki BRAND_MAP'e ekleyip ikinci tur yapabilelim.
 *
 * Çalıştırma:
 *   npx tsx scripts/analyze-unknown-brands.ts
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const TARGETS_PATH = resolve(tmpdir(), 'seed-data/scrape-targets.txt');
const SCRAPE_OUTPUT = resolve(process.cwd(), 'scripts/data/scrape-output.json');

// Aynı BRAND_MAP'i import edemeyiz (TS olarak da olur ama hızlı olsun); inline dupliçe
const BRAND_SLUGS = [
  'hills-science-plan', 'hills-prescription-diet', 'royal-canin-veterinary',
  'versele-laga-prestige', 'versele-laga-nutribird', 'versele-laga-loro-parque',
  'pro-choice', 'pro-plan', 'pro-diet', 'pro-line', 'cats-best', 'ever-clean',
  'tidy-cats', 'jr-farm', 'reflex-plus', 'brit-care', 'gardenmix-platin',
  'biokats', 'farmina-nd', 'dog-chow', 'felix', 'cesar',
  'royal-canin', 'versele-laga', 'proplan', 'prochoice', 'lindocat', 'sanabelle',
  'sanicat', 'sepicat', 'catsan', 'beaphar', 'belcando', 'eurogold', 'gardenmix',
  'pronature', 'pedigree', 'whiskas', 'sheba', 'friskies', 'gourmet', 'purina',
  'miratorg', 'reflex', 'vancat', 'acana', 'orijen', 'bozita', 'bosch', 'obivan',
  'lavital', 'la-vital', 'luis', 'wanpy', 'kong', 'trixie', 'ferplast', 'tetra',
  'sera', 'tropical', 'jbl', 'padovan', 'schesir', 'catit', 'animonda', 'gimcat',
  'gimdog', 'vitakraft', 'happy-cat', 'happy-dog', 'leonardo', 'almo-nature',
  'arden-grange', 'eukanuba', 'lily', 'panzi', 'pet-style', 'challenge', 'herniks',
  'vetsmell', 'vetoquinol', 'bayer', 'sentry', 'nutri-vet', 'flexi', 'savic',
  'sanal', 'tropi-fit', 'biokat', 'pi-pi-pet',
];

function detectBrand(urlPath: string): boolean {
  const slugPath = urlPath.toLowerCase();
  for (const slug of BRAND_SLUGS) {
    if (slugPath.startsWith(slug + '-') || slugPath.includes('/' + slug + '-')) return true;
  }
  return false;
}

async function main() {
  const rawTargets = await readFile(TARGETS_PATH, 'utf8');
  const targets = rawTargets.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith('http'));

  const unknown: string[] = [];
  for (const url of targets) {
    try {
      const u = new URL(url);
      const path = u.pathname.replace(/^\/+/, '').replace(/\.html$/, '');
      if (!detectBrand(path)) unknown.push(url);
    } catch {
      // skip
    }
  }

  // İlk slug parçasını çıkar (brand candidate)
  const brandCandidates: Record<string, number> = {};
  for (const url of unknown) {
    try {
      const u = new URL(url);
      const path = u.pathname.replace(/^\/+/, '').replace(/\.html$/, '');
      // Petlebi: kopek-urunleri/{brand}-... formatı — / sonrası ilk slug bloğu
      const lastSlash = path.lastIndexOf('/');
      const segment = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
      // İlk 1-2-3 token (- ile ayrılmış)
      const parts = segment.split('-');
      for (const len of [3, 2, 1]) {
        if (parts.length < len) continue;
        const candidate = parts.slice(0, len).join('-');
        // Pek genel kelimeler skip et
        if (['kedi', 'kopek', 'kus', 'akvaryum', 'kemirgen', 'tavsan', 'mama', 'yas', 'kuru'].includes(candidate)) continue;
        brandCandidates[candidate] = (brandCandidates[candidate] ?? 0) + 1;
        break;
      }
    } catch {
      // skip
    }
  }

  const top = Object.entries(brandCandidates)
    .filter(([, v]) => v >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 60);

  console.log(`[analyze] ${unknown.length} URLs with brand_unknown`);
  console.log(`[analyze] Top brand candidates (>=2 occurrences):`);
  for (const [name, count] of top) {
    console.log(`  ${count.toString().padStart(3)}  ${name}`);
  }

  // Save list of unknown URLs for inspection
  await writeFile(
    resolve(tmpdir(), 'seed-data/unknown-brand-urls.txt'),
    unknown.join('\n'),
    'utf8',
  );
  console.log(`[analyze] Wrote ${unknown.length} unknown URLs to $TMP/seed-data/unknown-brand-urls.txt`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Watermark/kampanya rozeti içeren catalog seed image'larını
 * alternatif kaynaklardan indirilmiş temiz versiyonlarıyla değiştir.
 *
 * Akış:
 *   1. MAP içindeki her satır için scripts/data/alt-images/{altName}'i oku
 *   2. R2'de seed/{originalHash}.webp key'ine yeni içeriği PUT et (üzerine yaz)
 *   3. forceOverwrite=true ile mevcut R2 dosyasını override et
 *
 * Idempotent: tekrar çalıştırılırsa aynı dosya aynı key'e yazılır.
 *
 * NOT: DB'de image_path değişmez (key aynı kalır). Sadece R2 content yenilenir.
 * Frontend cache (`<img src>` CDN) eski versiyon serve edebilir — kullanıcı
 * F5/Ctrl+Shift+R yapması gerekir.
 *
 * Çalıştırma:
 *   npx tsx scripts/replace-catalog-images.ts
 */

import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { uploadToR2 } from '../src/lib/storage/r2-client';

const ALT_DIR = resolve(process.cwd(), 'scripts/data/alt-images');

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

/**
 * Mapping: originalHash → alt file name in scripts/data/alt-images.
 * Hash key DB'deki image_path = `seed/{hash}.webp` ile aynı.
 */
const MAP: Array<{ hash: string; altFile: string; productName: string }> = [
  { hash: '5bb1ce1c5d536f4e', altFile: 'kong-donut.jpg', productName: 'Kong AirDog Donut' },
  { hash: '0bc56931f80da1a6', altFile: '1-eurogold-tunek.webp', productName: 'EuroGold Tünek' },
  { hash: '3a0888c3d3b251fb', altFile: '2-trixie-otlu.jpg', productName: 'Trixie Otlu Tavuk' },
  { hash: '3eb73df2be91d80e', altFile: '3-eastland-canli-v2.jpg', productName: 'Eastland Çanlı Boncuk' },
  { hash: '5c4c8d47ae7da29a', altFile: '5-eastland-yengec.jpg', productName: 'Eastland Yengeç' },
  { hash: '5f37a90026e5fad1', altFile: '6-hills-kitten.jpg', productName: 'Hill\'s Kitten 5kg' },
  { hash: '6a9be930ce48bd4c', altFile: '7-advance-senior10.png', productName: 'Advance Senior 10+' },
  { hash: '6af8aa38ace63537', altFile: '8-advance-hairball.png', productName: 'Advance Hairball' },
  { hash: '6ce945a155babde3', altFile: '9-prochoice-somon-100g.jpg', productName: 'ProChoice Somon 100g' },
  { hash: '7a12f77a19106029', altFile: '10-advance-puppy-medium.webp', productName: 'Advance Puppy Medium' },
  { hash: '7c36d438ee100e4b', altFile: '11-prochoice-pouch-kuzu.png', productName: 'ProChoice Pouch Kuzu' },
  { hash: '08bc26a9aaf52b47', altFile: '12-spectrum-tavsan-12kg.jpg', productName: 'Spectrum Tavşan 12kg' },
  { hash: '8a39c6b23dc4a5b2', altFile: '13-hills-sterilised-kitten.jpg', productName: 'Hill\'s Sterilised Kitten' },
  { hash: '09d4da1090bdd714', altFile: '14-felicia-tavuk-85g.jpg', productName: 'Felicia Tavuk Pouch' },
  { hash: '09fc0fa68530d1e5', altFile: '15-advance-kitten-400g.jpg', productName: 'Advance Kitten 400g' },
  { hash: '9a3b9c2f668b7e84', altFile: '16-eastland-kaplumbaga.png', productName: 'Eastland Kaplumbağa' },
  { hash: '9af82d5c5de5dbc1', altFile: '17-vetsplus-stick.jpg', productName: 'Vet\'s Plus Krema' },
  { hash: '9bcd0ffb199ee639', altFile: '18-nutribird-c15.png', productName: 'NutriBird C15' },
  { hash: '9e78c41a6bb5a2bf', altFile: '19-goldwings-kus-kumu.jpg', productName: 'Gold Wings Kuş Kumu' },
  { hash: '017adda13f007530', altFile: '20-felicia-ton-tavuk.jpg', productName: 'Felicia Ton Tavuk Pate' },
  { hash: '10ce0f02a662ee0f', altFile: '21-advance-medium-3kg.jpg', productName: 'Advance Medium 3kg' },
];

async function main(): Promise<void> {
  console.log(`[replace] ${MAP.length} ürün için R2 override başlıyor...`);
  let ok = 0;
  let fail = 0;
  for (const entry of MAP) {
    const altPath = resolve(ALT_DIR, entry.altFile);
    const ext = extname(entry.altFile).toLowerCase();
    const contentType = CONTENT_TYPE_BY_EXT[ext] ?? 'application/octet-stream';
    const key = `seed/${entry.hash}.webp`;
    try {
      const buffer = await readFile(altPath);
      await uploadToR2(key, buffer, {
        contentType,
        cacheControl: 'public, max-age=31536000, immutable',
      });
      console.log(`  ✓ ${key} ← ${entry.altFile} (${(buffer.byteLength / 1024).toFixed(1)} KB) [${entry.productName}]`);
      ok++;
    } catch (err) {
      console.error(`  ✕ ${key} ← ${entry.altFile} — ${(err as Error).message}`);
      fail++;
    }
  }
  console.log(``);
  console.log(`── Sonuç: ${ok} başarılı, ${fail} başarısız ──`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

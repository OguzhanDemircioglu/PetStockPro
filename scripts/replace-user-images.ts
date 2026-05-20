/**
 * Kullanıcının manuel bulduğu temiz resimlerle catalog seed image'larını
 * değiştir. Her ürün için scripts/data/alt-images/user-{hash}.png dosyası
 * mevcut R2 seed/{hash}.webp key'inin üzerine yazılır.
 *
 * Idempotent: tekrar çalıştırılırsa aynı sonuç.
 *
 * NOT: PNG dosyaları image/png content-type ile aynı .webp uzantılı key'e
 * yazılır. R2 / CDN content-type header'ı honor eder, browser PNG render eder.
 * DB image_path değişmez.
 *
 * Çalıştırma:
 *   npx tsx scripts/replace-user-images.ts
 */

import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { uploadToR2 } from '../src/lib/storage/r2-client';

const ALT_DIR = resolve(process.cwd(), 'scripts/data/alt-images');

const MAP: Array<{ hash: string; product: string }> = [
  { hash: '0bc56931f80da1a6', product: 'EuroGold Tünek 25cm' },
  { hash: '3a0888c3d3b251fb', product: 'Trixie Otlu Peluş 8cm' },
  { hash: '5c4c8d47ae7da29a', product: 'Eastland Yengeç 11cm' },
  { hash: '5f37a90026e5fad1', product: "Hill's Kitten 5kg" },
  { hash: '6ce945a155babde3', product: 'ProChoice Somon 100g' },
  { hash: '9a3b9c2f668b7e84', product: 'Eastland Kaplumbağa 15cm' },
  { hash: '33d43cdfcddb2676', product: 'Royal Canin Fussy Exigent' },
  { hash: '62e3537329869695', product: 'Felicia Urinary 2kg' },
  { hash: '347bf8065059e61b', product: 'Ferplast Tasma 50kg' },
  { hash: '96ea3aadc001312c', product: 'Felix 52 Adet' },
  { hash: '5b023118c378b23f', product: 'Eastland Patili Küret 28cm' },
  { hash: '8c802a7cc45ec8c1', product: 'Eastland Köpekbalığı 30cm' },
  { hash: '829b09db6d734fad', product: 'Eastland Frizbi 20cm' },
];

async function main(): Promise<void> {
  console.log(`[replace-user] ${MAP.length} kullanıcı resmi için R2 override...`);
  let ok = 0;
  let fail = 0;
  for (const entry of MAP) {
    const srcPath = resolve(ALT_DIR, `user-${entry.hash}.png`);
    const r2Key = `seed/${entry.hash}.webp`;
    try {
      const buffer = await readFile(srcPath);
      await uploadToR2(r2Key, buffer, {
        contentType: 'image/png',
        cacheControl: 'public, max-age=31536000, immutable',
      });
      console.log(`  ✓ ${r2Key} (${(buffer.byteLength / 1024).toFixed(1)} KB) [${entry.product}]`);
      ok++;
    } catch (err) {
      console.error(`  ✕ ${r2Key} — ${(err as Error).message}`);
      fail++;
    }
  }
  console.log('');
  console.log(`── Sonuç: ${ok} başarılı, ${fail} başarısız ──`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

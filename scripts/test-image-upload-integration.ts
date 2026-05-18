/**
 * Integration test: gerçek DB + gerçek Supabase Storage ile image upload akışı.
 *
 * Run: npx tsx scripts/test-image-upload-integration.ts
 *
 * Test ettiği senaryolar:
 *   1. Geçerli ürün için PNG upload → DB satır + Storage dosya + public URL
 *   2. Public URL fetch → 200 (gerçekten erişilebilir)
 *   3. İlk görsel auto-primary
 *   4. İkinci görsel non-primary + displayOrder=1
 *   5. setPrimary ile yeni primary atama
 *   6. delete primary → ikinci görsel auto-promote
 *   7. delete son görsel → temizlik
 *   8. Başka tenant ürünü upload → product_not_found reject
 */
import 'dotenv/config';
import {
  uploadProductImage,
  listProductImages,
  deleteProductImage,
  setPrimaryProductImage,
} from '../src/lib/catalog/product-images';
import { db } from '../src/lib/db/client';

// 1x1 transparent PNG (67 byte)
const PNG_67B = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
// 8x8 red JPEG (~120 byte) ikinci dosya için
const JPG_120B = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAAIAAgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AB//Z',
  'base64',
);

const COMPANY_SPRINT3 = 'c6e4ebf6-af0b-426f-aa22-775af2871579';
const COMPANY_MAGICUI = '75e82a44-c0b0-421b-89a3-15427e1dc55f';
const PRODUCT_CATIT = '58f5a40a-61c4-454e-81a3-99fd6bc37bd7';

let passed = 0;
let failed = 0;

function assert(cond: unknown, label: string) {
  if (cond) {
    console.log('  ✓', label);
    passed++;
  } else {
    console.log('  ✗', label);
    failed++;
  }
}

async function cleanup() {
  // Var olan tüm görselleri sil — test idempotent olsun
  const existing = await listProductImages(COMPANY_SPRINT3, PRODUCT_CATIT, db);
  for (const img of existing) {
    await deleteProductImage(COMPANY_SPRINT3, img.id, db);
  }
}

async function main() {
  console.log('\n🧪 Integration test başlıyor...\n');

  await cleanup();

  // ============ Test 1: İlk görsel upload (PNG) ============
  console.log('Test 1: İlk PNG upload — auto-primary');
  const r1 = await uploadProductImage(
    COMPANY_SPRINT3,
    {
      productId: PRODUCT_CATIT,
      fileName: 'test1.png',
      contentType: 'image/png',
      altText: 'Test görsel 1',
    },
    PNG_67B,
    db,
  );
  assert(r1.ok, 'Upload başarılı');
  if (!r1.ok) {
    console.error('  → reason:', r1.reason, r1.message);
    return;
  }
  const img1Id = r1.imageId;
  const img1Url = r1.url;
  assert(img1Url.startsWith('https://'), 'Public URL HTTPS');
  assert(img1Url.includes('product-images'), 'Bucket adı URL\'de var');

  // Public fetch
  const fetchR1 = await fetch(img1Url);
  assert(fetchR1.status === 200, 'Public URL fetch 200');
  assert(
    fetchR1.headers.get('content-type')?.startsWith('image/'),
    'Content-Type image/*',
  );

  // ============ Test 2: List + isPrimary check ============
  console.log('\nTest 2: list → 1 görsel, isPrimary=true');
  const list1 = await listProductImages(COMPANY_SPRINT3, PRODUCT_CATIT, db);
  assert(list1.length === 1, 'Liste 1 satır');
  assert(list1[0].isPrimary === true, 'İlk görsel primary');
  assert(list1[0].displayOrder === 0, 'displayOrder=0');
  assert(list1[0].altText === 'Test görsel 1', 'altText doğru');

  // ============ Test 3: İkinci görsel JPG → non-primary + displayOrder=1 ============
  console.log('\nTest 3: İkinci JPG upload — non-primary, displayOrder=1');
  const r2 = await uploadProductImage(
    COMPANY_SPRINT3,
    {
      productId: PRODUCT_CATIT,
      fileName: 'test2.jpg',
      contentType: 'image/jpeg',
    },
    JPG_120B,
    db,
  );
  assert(r2.ok, 'İkinci upload başarılı');
  if (!r2.ok) {
    console.error('  → reason:', r2.reason, r2.message);
  } else {
    const list2 = await listProductImages(COMPANY_SPRINT3, PRODUCT_CATIT, db);
    assert(list2.length === 2, 'Liste 2 satır');
    const second = list2.find((i) => i.id === r2.imageId);
    assert(second?.isPrimary === false, 'İkinci görsel non-primary');
    assert(second?.displayOrder === 1, 'displayOrder=1');
  }

  // ============ Test 4: setPrimary ile ikinciyi primary yap ============
  if (r2.ok) {
    console.log('\nTest 4: setPrimary — ikinciyi primary yap');
    const sp = await setPrimaryProductImage(COMPANY_SPRINT3, r2.imageId, db);
    assert(sp.ok, 'setPrimary başarılı');
    if (sp.ok) {
      assert(sp.previousPrimaryId === img1Id, 'Önceki primary doğru');
    }
    const list3 = await listProductImages(COMPANY_SPRINT3, PRODUCT_CATIT, db);
    const newPrimary = list3.find((i) => i.isPrimary);
    assert(newPrimary?.id === r2.imageId, 'Yeni primary ikinci görsel');
    const oldPrimary = list3.find((i) => i.id === img1Id);
    assert(oldPrimary?.isPrimary === false, 'Eski primary unset');
  }

  // ============ Test 5: Başka tenant'ın ürününe upload → reject ============
  console.log('\nTest 5: Başka tenant\'a upload → product_not_found');
  const rOther = await uploadProductImage(
    COMPANY_MAGICUI, // farklı tenant
    {
      productId: PRODUCT_CATIT, // Sprint 3'ün ürünü
      fileName: 'hack.png',
      contentType: 'image/png',
    },
    PNG_67B,
    db,
  );
  assert(!rOther.ok, 'Reject edildi');
  if (!rOther.ok) {
    assert(
      rOther.reason === 'product_not_found',
      'Reason product_not_found',
    );
  }

  // ============ Test 6: Primary delete → ikinci auto-promote ============
  if (r2.ok) {
    console.log('\nTest 6: Primary delete → diğeri auto-promote');
    const list4 = await listProductImages(COMPANY_SPRINT3, PRODUCT_CATIT, db);
    const primary = list4.find((i) => i.isPrimary);
    assert(primary !== undefined, 'Primary mevcut');
    if (primary) {
      const del = await deleteProductImage(COMPANY_SPRINT3, primary.id, db);
      assert(del.ok, 'Delete başarılı');
      if (del.ok) {
        assert(del.wasPrimary === true, 'wasPrimary true');
        assert(del.newPrimaryId !== null, 'newPrimaryId set');
      }
      const list5 = await listProductImages(COMPANY_SPRINT3, PRODUCT_CATIT, db);
      assert(list5.length === 1, '1 görsel kaldı');
      assert(list5[0].isPrimary === true, 'Kalan görsel primary oldu');
    }
  }

  // ============ Test 7: Son görsel delete → newPrimaryId null ============
  console.log('\nTest 7: Son görseli sil → newPrimaryId null');
  const remaining = await listProductImages(COMPANY_SPRINT3, PRODUCT_CATIT, db);
  if (remaining.length > 0) {
    const del = await deleteProductImage(COMPANY_SPRINT3, remaining[0].id, db);
    assert(del.ok, 'Son delete başarılı');
    if (del.ok) {
      assert(del.newPrimaryId === null, 'newPrimaryId null');
    }
    const list6 = await listProductImages(COMPANY_SPRINT3, PRODUCT_CATIT, db);
    assert(list6.length === 0, 'Ürünün görseli kalmadı');
  }

  // ============ Sonuç ============
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`✓ Passed: ${passed}`);
  console.log(`${failed === 0 ? '✓' : '✗'} Failed: ${failed}`);
  console.log('─'.repeat(50));
  if (failed > 0) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n💥 Test runner crashed:', err);
    process.exit(1);
  });

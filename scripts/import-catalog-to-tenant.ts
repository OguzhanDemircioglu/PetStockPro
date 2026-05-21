/**
 * Catalog seed → tenant bulk import.
 *
 * Mevcut tenant'a catalog_seed_products'tan:
 *   1. Unique marka (95) → brands tablosuna (ON CONFLICT DO NOTHING)
 *   2. Her ürün → products + product_variants + product_images (R2 image transfer)
 *
 * Idempotent: slug çakışmaları skip edilir. Re-run safe.
 *
 * Kullanım:
 *   npx tsx scripts/import-catalog-to-tenant.ts <companyId>
 *   npx tsx scripts/import-catalog-to-tenant.ts  (default: ilk company)
 *
 * UYARI: 1.240 ürün × 3 DB op × 2 R2 op = ~7.000 işlem. 5-10 dakika sürer.
 * Test/playground tenant'larında çalıştır, production tenant'a değil.
 */

import 'dotenv/config';
import postgres from 'postgres';
import { fetchFromR2, uploadToR2 } from '../src/lib/storage/r2-client';
import { makeSlug } from '../src/lib/utils/slug';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in .env');
}

const queryClient = postgres(process.env.DATABASE_URL, {
  prepare: false,
  connection: { search_path: 'petstockpro,public' },
});

interface CatalogRow {
  id: number;
  name: string;
  brand: string;
  weight: string;
  animal_type: string;
  category_slug: string;
  image_path: string;
  description: string | null;
}

function generateSku(brand: string, name: string, weight: string): string {
  const brandAbbr =
    brand
      .split(/\s+/)
      .map((w) => w[0])
      .filter((c) => /[a-zA-Z]/.test(c ?? ''))
      .join('')
      .toUpperCase()
      .slice(0, 4) || 'GEN';
  const nameTokens = name
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]/g, ''))
    .filter((w) => w.length >= 3 && !brand.toLowerCase().includes(w.toLowerCase()));
  const namePart = (nameTokens[0] ?? 'STD').toUpperCase().slice(0, 4);
  const weightAbbr = weight.replace(/\s+/g, '').toUpperCase().slice(0, 4) || 'STD';
  return `${brandAbbr}-${namePart}-${weightAbbr}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

async function main(): Promise<void> {
  // 1. companyId belirle
  let companyId = process.argv[2];
  if (!companyId) {
    const result = await queryClient<Array<{ id: string; name: string }>>`
      SELECT id, name FROM petstockpro.companies ORDER BY created_at LIMIT 1
    `;
    if (result.length === 0) {
      throw new Error('Tenant yok. Önce kullanıcı kaydı yap veya companyId arg ver.');
    }
    companyId = result[0].id;
    console.log(`[import] companyId arg verilmedi, ilk tenant kullanılıyor: ${result[0].name} (${companyId})`);
  } else {
    console.log(`[import] Target tenant: ${companyId}`);
  }

  // 2. Unique brand bulk insert
  console.log('[import] === ADIM 1: Markalar ===');
  const uniqueBrands = await queryClient<Array<{ brand: string }>>`
    SELECT DISTINCT brand FROM petstockpro.catalog_seed_products ORDER BY brand
  `;
  console.log(`[import] ${uniqueBrands.length} unique marka bulundu`);

  let brandsInserted = 0;
  for (const { brand } of uniqueBrands) {
    const slug = makeSlug(brand).slice(0, 100);
    try {
      const inserted = await queryClient`
        INSERT INTO petstockpro.brands (company_id, name, slug)
        VALUES (${companyId}, ${brand}, ${slug})
        ON CONFLICT (company_id, slug) DO NOTHING
        RETURNING id
      `;
      if (inserted.length > 0) brandsInserted++;
    } catch (e) {
      console.log(`  ⚠ Brand skip: ${brand} (${(e as Error).message})`);
    }
  }
  console.log(`[import] ✓ ${brandsInserted} yeni marka insert edildi (${uniqueBrands.length - brandsInserted} zaten vardı)`);

  // 3. Tenant lookup map'leri kur
  const tenantBrands = await queryClient<Array<{ id: string; name: string }>>`
    SELECT id, name FROM petstockpro.brands WHERE company_id = ${companyId}
  `;
  const tenantCategories = await queryClient<Array<{ id: string; slug: string }>>`
    SELECT id, slug FROM petstockpro.categories WHERE company_id = ${companyId}
  `;
  const branches = await queryClient<Array<{ id: string }>>`
    SELECT id FROM petstockpro.branches WHERE company_id = ${companyId} AND is_active = true LIMIT 1
  `;
  if (branches.length === 0) {
    console.log('[import] ⚠ Aktif şube yok — branch_inventory satırları skip edilecek');
  }
  const defaultBranchId = branches[0]?.id ?? null;

  const brandMap = new Map(tenantBrands.map((b) => [b.name.toLowerCase(), b.id]));
  const catSlugMap = new Map(tenantCategories.map((c) => [c.slug, c.id]));
  console.log(`[import] Tenant lookup: ${brandMap.size} brand / ${catSlugMap.size} kategori / branch=${defaultBranchId ?? 'NONE'}`);

  // 4. Catalog ürünleri yükle
  console.log('[import] === ADIM 2: Ürünler ===');
  const catalogItems = await queryClient<CatalogRow[]>`
    SELECT id, name, brand, weight, animal_type, category_slug, image_path, description
    FROM petstockpro.catalog_seed_products
    ORDER BY id
  `;
  console.log(`[import] ${catalogItems.length} catalog ürünü işlenecek`);

  let productsCreated = 0;
  let productsSkipped = 0;
  let imagesTransferred = 0;
  let imageFailures = 0;

  for (let i = 0; i < catalogItems.length; i++) {
    const item = catalogItems[i];
    const brandId = brandMap.get(item.brand.toLowerCase());
    const categoryId = catSlugMap.get(item.category_slug);

    if (!brandId || !categoryId) {
      productsSkipped++;
      continue;
    }

    // Product slug — name'den slug üret + benzersizlik için id ekle
    const productSlug = `${makeSlug(item.name).slice(0, 80)}-${item.id}`;

    let productId: string | null = null;
    try {
      const inserted = await queryClient`
        INSERT INTO petstockpro.products (
          company_id, brand_id, category_id, name, slug, description,
          animal_types, is_active
        )
        VALUES (
          ${companyId}, ${brandId}, ${categoryId}, ${item.name}, ${productSlug},
          ${item.description}, ${JSON.stringify([item.animal_type])}::jsonb, true
        )
        ON CONFLICT (company_id, slug) DO NOTHING
        RETURNING id
      `;
      if (inserted.length === 0) {
        productsSkipped++;
        continue;
      }
      productId = inserted[0].id as string;
    } catch (e) {
      productsSkipped++;
      if (productsSkipped < 5) console.log(`  ⚠ Product insert fail: ${item.name.slice(0, 40)}: ${(e as Error).message.slice(0, 80)}`);
      continue;
    }

    // Variant insert (default)
    const variantSku = generateSku(item.brand, item.name, item.weight);
    try {
      await queryClient`
        INSERT INTO petstockpro.product_variants (
          product_id, sku, value_label, cost_price, sale_price, threshold,
          is_default, is_active
        )
        VALUES (
          ${productId}, ${variantSku}, ${item.weight}, '0', '0', 5, true, true
        )
      `;
    } catch (e) {
      console.log(`  ⚠ Variant fail for ${item.name.slice(0, 40)}: ${(e as Error).message.slice(0, 80)}`);
    }

    // R2 image transfer: seed/{hash}.webp → tenants/{companyId}/{productId}/{uuid}.webp
    try {
      const seedBuffer = await fetchFromR2(item.image_path);
      if (seedBuffer) {
        const ext = (item.image_path.match(/\.(\w+)$/)?.[1] ?? 'webp').toLowerCase();
        const mime =
          ext === 'webp' ? 'image/webp' :
          ext === 'png' ? 'image/png' :
          ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/webp';
        const uuid = crypto.randomUUID();
        const newKey = `tenants/${companyId}/${productId}/${uuid}.${ext}`;
        const newUrl = await uploadToR2(newKey, seedBuffer, {
          contentType: mime,
          cacheControl: 'public, max-age=31536000, immutable',
        });
        await queryClient`
          INSERT INTO petstockpro.product_images (
            product_id, url, is_primary, display_order, alt_text
          )
          VALUES (${productId}, ${newUrl}, true, 0, NULL)
        `;
        imagesTransferred++;
      }
    } catch {
      imageFailures++;
    }

    productsCreated++;
    if ((i + 1) % 50 === 0 || i + 1 === catalogItems.length) {
      process.stdout.write(
        `\r[import] ${i + 1}/${catalogItems.length} (created=${productsCreated} skipped=${productsSkipped} img=${imagesTransferred})`,
      );
    }
  }
  process.stdout.write('\n');

  console.log('[import] === SONUÇ ===');
  console.log(`  ✓ ${brandsInserted} yeni marka`);
  console.log(`  ✓ ${productsCreated} yeni ürün`);
  console.log(`  → ${productsSkipped} skipped (slug dup veya brand/kategori uyumsuz)`);
  console.log(`  📷 ${imagesTransferred} görsel R2 transfer (${imageFailures} fail)`);

  await queryClient.end();
}

main().catch((e) => {
  console.error('[import] FATAL:', e);
  process.exit(1);
});

/**
 * Staging demo data seed — 5 pet shop, ~30 ürün, mock stok.
 *
 * Idempotent: existing tenant slug varsa skip. Tekrar çalıştırılabilir.
 *
 * Usage:
 *   npx tsx src/db/seed/staging-demo.ts
 *
 * NOT: Production'da çalıştırmaz — env STAGING_SEED_ALLOW=1 olmadan reddeder.
 */

// dotenv'i her şeyden önce yükle — import hoisting bug fix
import 'dotenv/config';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
dotenvConfig({ path: resolve(process.cwd(), '.env.local'), override: true });

import { eq } from 'drizzle-orm';
import { db } from '../../lib/db/client';
import {
  cities,
  districts,
  companies,
  users,
  branches,
  storefrontSettings,
  products,
  productVariants,
  branchInventory,
  stockMovements,
  categories,
} from '../schema';
import { hashPassword } from '../../lib/auth/password';

interface DemoTenant {
  slug: string;
  name: string;
  cityName: string;
  districtName: string;
  whatsappPhone: string;
  vatNo: string;
  locationLat: string;
  locationLng: string;
  about: string;
  ownerEmail: string;
  products: Array<{
    name: string;
    categorySlug: string;
    description: string;
    salePrice: string;
    costPrice: string;
    sku: string;
    stockQty: number;
  }>;
}

const DEMO_PASSWORD = 'DemoBayi123!';

const TENANTS: DemoTenant[] = [
  {
    slug: 'mavi-pet-istanbul',
    name: 'Mavi Pet Shop',
    cityName: 'İstanbul',
    districtName: 'Kadıköy',
    whatsappPhone: '+905321001001',
    vatNo: '1111111111',
    locationLat: '40.9892000',
    locationLng: '29.0260000',
    about: 'Kadıköy\'ün gözde pet shop\'u. 12 yıldır kediler, köpekler, kuşlar ve egzotik dostlarımız için kaliteli ürünler. Hafta içi 09:00-21:00, Cumartesi-Pazar 10:00-22:00.',
    ownerEmail: 'mavi@demo.petstockpro.local',
    products: [
      { name: 'Royal Canin Maxi Adult Köpek Maması 15kg', categorySlug: 'kuru-mama', description: 'Büyük ırk yetişkin köpekler için premium kuru mama.', salePrice: '799.00', costPrice: '620.00', sku: 'MAVI-RC-MAX-15', stockQty: 28 },
      { name: 'Whiskas Kedi Maması Ton Balıklı 2kg', categorySlug: 'kuru-mama', description: 'Yetişkin kediler için ton balıklı kuru mama.', salePrice: '189.00', costPrice: '145.00', sku: 'MAVI-WHK-TUN-2', stockQty: 45 },
      { name: 'Catit Pixi Akıllı Mama Otomatı 5L', categorySlug: 'aksesuar', description: 'Wi-Fi bağlantılı, mobil uygulama ile programlanabilir mama otomatı.', salePrice: '3499.00', costPrice: '2750.00', sku: 'MAVI-CAT-PXI-5L', stockQty: 8 },
      { name: 'Trixie Tüy Toplama Eldiveni', categorySlug: 'aksesuar', description: 'Kedi ve köpek tüylerini eve dağıtmadan toplar.', salePrice: '79.90', costPrice: '52.00', sku: 'MAVI-TRX-GLV', stockQty: 32 },
      { name: 'Kitten Vitamin Şurup 50ml', categorySlug: 'saglik-vitamin', description: 'Yavru kediler için multivitamin destek.', salePrice: '149.00', costPrice: '95.00', sku: 'MAVI-VIT-50ML', stockQty: 18 },
      { name: 'Ördek Şekilli Peluş Köpek Oyuncağı', categorySlug: 'oyuncak', description: 'Sesli, çiğnemeye dayanıklı pet oyuncak.', salePrice: '59.90', costPrice: '32.00', sku: 'MAVI-PEL-DCK', stockQty: 65 },
    ],
  },
  {
    slug: 'patiland-ankara',
    name: 'Patiland Pet Shop',
    cityName: 'Ankara',
    districtName: 'Çankaya',
    whatsappPhone: '+905322002002',
    vatNo: '2222222222',
    locationLat: '39.9080000',
    locationLng: '32.8470000',
    about: 'Çankaya\'nın en geniş ürün yelpazesine sahip pet shop\'u. Veteriner hekim danışmanlığı, akvaryum, kuş, sürüngen tüm hayvanlar için ürün.',
    ownerEmail: 'patiland@demo.petstockpro.local',
    products: [
      { name: 'Pro Plan Adult Kedi Maması Tavuklu 10kg', categorySlug: 'kuru-mama', description: 'Yetişkin kediler için Purina Pro Plan tavuklu kuru mama.', salePrice: '1299.00', costPrice: '980.00', sku: 'PATI-PP-CAT-10', stockQty: 15 },
      { name: 'Hill\'s Science Diet Köpek Yavru 3kg', categorySlug: 'kuru-mama', description: 'Yavru köpekler için bilim destekli beslenme.', salePrice: '599.00', costPrice: '450.00', sku: 'PATI-HSD-PUP-3', stockQty: 22 },
      { name: 'Kedi Tırmalama Tahtası Yüksek 60cm', categorySlug: 'aksesuar', description: 'Sisal halat sarımı, tabanı geniş.', salePrice: '249.00', costPrice: '160.00', sku: 'PATI-SCR-60', stockQty: 14 },
      { name: 'Akvaryum Filtresi 100L', categorySlug: 'aksesuar', description: 'Sessiz çalışan akvaryum filtre seti.', salePrice: '459.00', costPrice: '320.00', sku: 'PATI-AQF-100', stockQty: 9 },
      { name: 'Bentonit Kedi Kumu 10L Lavanta', categorySlug: 'temizlik-bakim', description: 'Topaklanan, kokuyu emen kedi kumu.', salePrice: '189.00', costPrice: '120.00', sku: 'PATI-CL-LAV-10', stockQty: 52 },
      { name: 'Köpek Tasması XL Reflektörlü', categorySlug: 'aksesuar', description: 'Gece görünür, çelik toka, ayarlanabilir.', salePrice: '129.00', costPrice: '78.00', sku: 'PATI-CLR-XL', stockQty: 27 },
      { name: 'Muhabbet Kuşu Yem Karışımı 1kg', categorySlug: 'kuru-mama', description: '8 farklı tohum karışımı, vitamin destekli.', salePrice: '89.00', costPrice: '55.00', sku: 'PATI-BRD-1', stockQty: 38 },
    ],
  },
  {
    slug: 'ege-pet-izmir',
    name: 'Ege Pet Center',
    cityName: 'İzmir',
    districtName: 'Karşıyaka',
    whatsappPhone: '+905323003003',
    vatNo: '3333333333',
    locationLat: '38.4610000',
    locationLng: '27.1150000',
    about: 'İzmir Karşıyaka\'da 8 yıldır hizmet veren pet shop. Doğal ve organik ürünler, evcil hayvan eğitim danışmanlığı.',
    ownerEmail: 'egepet@demo.petstockpro.local',
    products: [
      { name: 'Acana Köpek Maması Wild Coast 6kg', categorySlug: 'kuru-mama', description: 'Tahıl-içermeyen, balık ağırlıklı premium köpek maması.', salePrice: '1899.00', costPrice: '1450.00', sku: 'EGE-AC-WC-6', stockQty: 11 },
      { name: 'Organic Kedi Maması Tavuk 4kg', categorySlug: 'kuru-mama', description: 'Organik sertifikalı yerli üretim kedi maması.', salePrice: '459.00', costPrice: '340.00', sku: 'EGE-ORG-CAT-4', stockQty: 18 },
      { name: 'Köpek Eğitim Klikırı Set', categorySlug: 'oyuncak', description: 'Klikır + 5 farklı ödül, kullanım kitabı.', salePrice: '169.00', costPrice: '110.00', sku: 'EGE-TR-CLK', stockQty: 24 },
      { name: 'Kedi Otu Doğal 30gr', categorySlug: 'saglik-vitamin', description: 'Stres azaltan, organik yetiştirilmiş kedi otu.', salePrice: '39.90', costPrice: '20.00', sku: 'EGE-CN-30', stockQty: 88 },
      { name: 'Çift Taraflı Mama Kabı Paslanmaz', categorySlug: 'aksesuar', description: 'Kaymaz taban, paslanmaz çelik, dishwasher-safe.', salePrice: '149.00', costPrice: '92.00', sku: 'EGE-BWL-DS', stockQty: 31 },
      { name: 'Köpek Tıraş Makinesi Sessiz', categorySlug: 'temizlik-bakim', description: 'Pille çalışan, sessiz motor, çift hızlı tıraş.', salePrice: '599.00', costPrice: '380.00', sku: 'EGE-GRM-SLT', stockQty: 7 },
    ],
  },
  {
    slug: 'bursa-yavru-pet',
    name: 'Bursa Yavru Pet',
    cityName: 'Bursa',
    districtName: 'Nilüfer',
    whatsappPhone: '+905324004004',
    vatNo: '4444444444',
    locationLat: '40.2180000',
    locationLng: '28.9970000',
    about: 'Nilüfer\'in en sevilen pet shop\'u. Yavru hayvan bakım malzemelerinde uzmanız. Ücretsiz danışma + ürün denemesi.',
    ownerEmail: 'bursayavru@demo.petstockpro.local',
    products: [
      { name: 'Yavru Köpek Maması Lamb & Rice 2kg', categorySlug: 'kuru-mama', description: '2-12 ay arası yavru köpekler için kuzu etli formül.', salePrice: '329.00', costPrice: '240.00', sku: 'BRS-YV-LR-2', stockQty: 36 },
      { name: 'Yavru Kedi Süt Tozu 200gr', categorySlug: 'saglik-vitamin', description: 'Anne sütüne en yakın formül, biberon dahil.', salePrice: '189.00', costPrice: '130.00', sku: 'BRS-MLK-200', stockQty: 19 },
      { name: 'Pet Taşıma Çantası Medium', categorySlug: 'aksesuar', description: 'Havalandırmalı, içi yumuşak yastıklı, omuzdan asılır.', salePrice: '349.00', costPrice: '240.00', sku: 'BRS-CRY-M', stockQty: 16 },
      { name: 'Köpek Yavru Pati Bakım Kremi', categorySlug: 'temizlik-bakim', description: 'Çatlamış patiler için doğal nem kremi.', salePrice: '79.00', costPrice: '45.00', sku: 'BRS-PAW-CR', stockQty: 41 },
      { name: 'Köpek Eğitim Çiti 4 Panel', categorySlug: 'aksesuar', description: 'Modüler tasarım, ev içi alan ayırma.', salePrice: '579.00', costPrice: '380.00', sku: 'BRS-FNC-4', stockQty: 6 },
      { name: 'Yavru Hamak Yatak', categorySlug: 'aksesuar', description: 'Yıkanabilir, yumuşak fleece, küçük ırk dostu.', salePrice: '189.00', costPrice: '115.00', sku: 'BRS-HMK', stockQty: 24 },
    ],
  },
  {
    slug: 'akdeniz-petci',
    name: 'Akdeniz Petçi',
    cityName: 'Antalya',
    districtName: 'Muratpaşa',
    whatsappPhone: '+905325005005',
    vatNo: '5555555555',
    locationLat: '36.8860000',
    locationLng: '30.7320000',
    about: 'Antalya merkez, denize yakın pet shop. Plaj sezonu pet aksesuarları, deniz ve havuz dostu ürünler.',
    ownerEmail: 'akdeniz@demo.petstockpro.local',
    products: [
      { name: 'Köpek Can Yeleği Medium', categorySlug: 'aksesuar', description: 'Yüzme + tekne için, reflektörlü, ayarlanabilir.', salePrice: '299.00', costPrice: '195.00', sku: 'AKD-LFV-M', stockQty: 18 },
      { name: 'Pet Güneş Kremi 100ml', categorySlug: 'saglik-vitamin', description: 'Hassas burunlar ve kulak uçları için, hayvan dostu formül.', salePrice: '139.00', costPrice: '88.00', sku: 'AKD-SUN-100', stockQty: 27 },
      { name: 'Brit Care Köpek Maması Salmon 7kg', categorySlug: 'kuru-mama', description: 'Hipoalerjenik somon balıklı yetişkin köpek maması.', salePrice: '1149.00', costPrice: '880.00', sku: 'AKD-BRT-SAL-7', stockQty: 13 },
      { name: 'Sphynx Kedi Şampuanı 250ml', categorySlug: 'temizlik-bakim', description: 'Hassas ciltli kediler için, parfümsüz formül.', salePrice: '189.00', costPrice: '125.00', sku: 'AKD-SHM-250', stockQty: 22 },
      { name: 'Otomatik Su Pınarı Sessiz 2L', categorySlug: 'aksesuar', description: 'Karbon filtreli, sessiz motor, kedi-köpek için.', salePrice: '459.00', costPrice: '310.00', sku: 'AKD-FNT-2', stockQty: 14 },
      { name: 'Köpek Kayışı Geri Toplanabilir 5m', categorySlug: 'aksesuar', description: 'Otomatik kilitli, 25kg\'a kadar dayanıklı.', salePrice: '189.00', costPrice: '115.00', sku: 'AKD-LSH-5', stockQty: 35 },
      { name: 'Trixie Kedi Tasması Tropic', categorySlug: 'aksesuar', description: 'Hızlı açılır güvenlik tokası, tropik desenli.', salePrice: '89.00', costPrice: '52.00', sku: 'AKD-TRX-CL', stockQty: 48 },
    ],
  },
];

async function ensureTenant(t: DemoTenant): Promise<{ created: boolean; skipped: boolean }> {
  const [existing] = await db.select({ id: companies.id }).from(companies).where(eq(companies.slug, t.slug)).limit(1);
  if (existing) {
    console.log(`  ⊘ ${t.slug} mevcut — skip`);
    return { created: false, skipped: true };
  }

  // City + district lookup
  const [city] = await db.select({ id: cities.id }).from(cities).where(eq(cities.name, t.cityName)).limit(1);
  if (!city) throw new Error(`City not found: ${t.cityName}`);
  const cityDistricts = await db.select({ id: districts.id, name: districts.name }).from(districts).where(eq(districts.cityId, city.id));
  const district = cityDistricts.find((d) => d.name.toLowerCase() === t.districtName.toLowerCase());
  if (!district) throw new Error(`District not found in ${t.cityName}: ${t.districtName}`);

  // Insert company
  const [company] = await db.insert(companies).values({
    name: t.name,
    slug: t.slug,
    plan: 'PRO',
    vatNo: t.vatNo,
    vatRequiredAt: new Date(),
    whatsappPhone: t.whatsappPhone,
    cityId: city.id,
    districtId: district.id,
    storefrontStatus: 'approved',
    locationLat: t.locationLat,
    locationLng: t.locationLng,
  }).returning({ id: companies.id });

  // Owner user
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const [owner] = await db.insert(users).values({
    email: t.ownerEmail,
    passwordHash,
    role: 'BAYI_SAHIBI',
    companyId: company.id,
    name: t.name + ' Sahibi',
    emailVerifiedAt: new Date(),
    onboardingCompletedAt: new Date(),
    kvkkConsentedAt: new Date(),
  }).returning({ id: users.id });

  // Branch
  const [branch] = await db.insert(branches).values({
    companyId: company.id,
    name: 'Merkez Şube',
    cityId: city.id,
    districtId: district.id,
    address: `${t.cityName} ${t.districtName}`,
    whatsappPhone: t.whatsappPhone,
    status: 'active',
  }).returning({ id: branches.id });

  // Storefront settings
  await db.insert(storefrontSettings).values({
    companyId: company.id,
    isEnabled: true,
    aboutContent: t.about,
  });

  // Categories — global (Migration 0026 sonrası companyId yok)
  const allCats = await db.select({ id: categories.id, slug: categories.slug }).from(categories);
  const catBySlug = new Map(allCats.map((c) => [c.slug, c.id]));

  /**
   * Generic kategori slug'larını ürün adına göre kedi/köpek/akvaryum
   * vb. prefix'li gerçek DB slug'una çevirir.
   */
  function resolveCategoryId(rawSlug: string, productName: string): string | undefined {
    const name = productName.toLowerCase();
    const isKedi = /kedi|cat|kitten|sphynx/i.test(name);
    const isKopek = /köpek|kopek|dog|puppy|yavru köpek/i.test(name);
    const isKus = /kuş|kus|muhabbet|bird/i.test(name);
    const isAkvaryum = /akvaryum|aquarium|balık|fish/i.test(name);
    const animal: 'kedi' | 'kopek' | 'kus' | 'akvaryum' =
      isAkvaryum ? 'akvaryum' : isKus ? 'kus' : isKedi ? 'kedi' : isKopek ? 'kopek' : 'kopek';

    const tryOrder: string[] = [];
    switch (rawSlug) {
      case 'kuru-mama':
        tryOrder.push(`${animal}-kuru-mamalar`, 'kopek-kuru-mamalar', 'kedi-kuru-mamalar');
        break;
      case 'aksesuar':
        tryOrder.push(`${animal}-aksesuarlar`, `${animal}-mama-ve-su-kaplari`, 'kopek-aksesuarlar');
        break;
      case 'oyuncak':
        tryOrder.push(`${animal}-oyuncaklar`, 'kopek-oyuncaklar');
        break;
      case 'saglik-vitamin':
        tryOrder.push(`${animal}-vitaminler`, 'kopek-vitaminler', 'kedi-vitamin-ve-katkilari');
        break;
      case 'temizlik-bakim':
        tryOrder.push(`${animal}-bakim-urunleri`, 'kopek-bakim-urunleri', 'kedi-bakim-urunleri');
        break;
      default:
        tryOrder.push(rawSlug);
    }
    for (const slug of tryOrder) {
      const id = catBySlug.get(slug);
      if (id) return id;
    }
    return undefined;
  }

  // Products + variants + inventory
  let productsAdded = 0;
  for (const p of t.products) {
    const categoryId = resolveCategoryId(p.categorySlug, p.name);
    if (!categoryId) {
      console.warn(`    ! ${p.sku}: kategori bulunamadı (${p.categorySlug}) — skip`);
      continue;
    }

    const [product] = await db.insert(products).values({
      companyId: company.id,
      name: p.name,
      slug: p.sku.toLowerCase(),
      description: p.description,
      categoryId,
      isActive: true,
      vitrinPublished: true,
      vitrinPublishedAt: new Date(),
      totalStockQty: p.stockQty,
    }).returning({ id: products.id });

    const [variant] = await db.insert(productVariants).values({
      companyId: company.id,
      productId: product.id,
      sku: p.sku,
      valueLabel: 'Standart',
      costPrice: p.costPrice,
      salePrice: p.salePrice,
      isDefault: true,
      isActive: true,
      displayOrder: 1,
      threshold: 5,
    }).returning({ id: productVariants.id });

    await db.insert(branchInventory).values({
      companyId: company.id,
      branchId: branch.id,
      variantId: variant.id,
      stockQty: p.stockQty,
      lastReceivedAt: new Date(),
    });
    // Açılış stoğu → ledger backing. Reconcile (Faz 3) için her envanter satırının
    // karşılığında stock_movement olmalı; aksi halde "envanter var, ledger yok" drift'i.
    await db.insert(stockMovements).values({
      companyId: company.id,
      branchId: branch.id,
      variantId: variant.id,
      type: 'stock_in',
      quantity: p.stockQty,
      beforeQty: 0,
      afterQty: p.stockQty,
      unitCost: p.costPrice,
      note: 'Açılış stoğu (demo seed)',
      createdById: owner.id,
    });
    productsAdded++;
  }

  console.log(`  ✓ ${t.slug}: ${productsAdded}/${t.products.length} ürün eklendi`);
  return { created: true, skipped: false };
}

async function main() {
  if (process.env.NEXT_PUBLIC_STAGING_MODE !== 'true' && process.env.STAGING_SEED_ALLOW !== '1') {
    console.error('✕ STAGING_SEED_ALLOW=1 veya NEXT_PUBLIC_STAGING_MODE=true gerek');
    process.exit(1);
  }

  console.log(`🌱 Staging demo seed — ${TENANTS.length} tenant`);
  let created = 0;
  let skipped = 0;
  for (const t of TENANTS) {
    const result = await ensureTenant(t);
    if (result.created) created++;
    else if (result.skipped) skipped++;
  }
  console.log(`\n✓ Tamam: ${created} yeni tenant, ${skipped} skip (mevcut)`);
  console.log(`  Demo BAYI password: ${DEMO_PASSWORD}`);
  process.exit(0);
}

main().catch((e) => {
  console.error('✕ Seed başarısız:', e);
  process.exit(1);
});

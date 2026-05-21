/**
 * Mock data ile 8 export route'un .xlsx çıktısını üretir + masaüstüne yazar.
 *
 * Çalıştır: npx tsx scripts/generate-excel-mocks.ts
 * Çıktı: C:/Users/oguzh/OneDrive/Desktop/petstockpro-excel-mocks/*.xlsx
 *
 * Üretilen dosyalar gerçek route'lardan farklı sadece DB bypass — aynı
 * helper (buildXlsxBuffer) + aynı kolon definition + aynı format kullanır.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildXlsxBuffer } from '../src/lib/utils/xlsx';

const OUTPUT_DIR = 'C:/Users/oguzh/OneDrive/Desktop/petstockpro-excel-mocks';
const TENANT = 'Pati Dükkanı Pet Shop';
const NOW = new Date();

const PAYMENT_TR: Record<string, string> = {
  cash: 'Peşin',
  net_30: '30 gün vadeli',
  net_60: '60 gün vadeli',
  other: 'Diğer',
};

const TYPE_TR: Record<string, string> = {
  stock_in: '📥 Giriş',
  stock_out: '📤 Çıkış',
  transfer: '🔁 Transfer',
  stocktake: '📋 Sayım',
  stocktake_initial: '📋 İlk Sayım',
};

// ────────────────────────────────────────────────────────────
// MOCK 1 — Ürünler
// ────────────────────────────────────────────────────────────
interface MockProduct {
  name: string;
  slug: string;
  categoryName: string | null;
  brandName: string | null;
  variantCount: number;
  totalStockQty: number;
  defaultSalePrice: string | null;
  vitrinPublished: boolean;
  isActive: boolean;
  createdAt: Date;
}

const products: MockProduct[] = [
  { name: 'Royal Canin Adult Kedi Maması 2 kg', slug: 'royal-canin-adult-kedi-2kg', categoryName: 'Kedi Kuru Mama', brandName: 'Royal Canin', variantCount: 3, totalStockQty: 47, defaultSalePrice: '599.90', vitrinPublished: true, isActive: true, createdAt: new Date('2026-04-15') },
  { name: 'Pro Plan Köpek Maması Lamb & Rice 14 kg', slug: 'proplan-kopek-lamb-14kg', categoryName: 'Köpek Kuru Mama', brandName: 'Pro Plan', variantCount: 2, totalStockQty: 12, defaultSalePrice: '1450.00', vitrinPublished: true, isActive: true, createdAt: new Date('2026-04-18') },
  { name: 'Catit Pixi Akıllı Otomatik Mama Kabı', slug: 'catit-pixi-otomatik-mama-kabi', categoryName: 'Mama ve Su Kapları', brandName: 'Catit', variantCount: 1, totalStockQty: 5, defaultSalePrice: '3499.00', vitrinPublished: true, isActive: true, createdAt: new Date('2026-04-20') },
  { name: 'Biokat\'s Pelet Kedi Kumu 5 L', slug: 'biokats-pelet-kedi-kumu-5l', categoryName: 'Kedi Kumu', brandName: "Biokat's", variantCount: 2, totalStockQty: 28, defaultSalePrice: '189.50', vitrinPublished: true, isActive: true, createdAt: new Date('2026-04-22') },
  { name: 'Hill\'s Kısırlaştırılmış Kedi Maması 1.5 kg', slug: 'hills-kisirlas-kedi-15kg', categoryName: 'Kedi Kuru Mama', brandName: "Hill's Science Plan", variantCount: 2, totalStockQty: 22, defaultSalePrice: '485.00', vitrinPublished: true, isActive: true, createdAt: new Date('2026-04-25') },
  { name: 'Kong Classic Köpek Oyuncağı M', slug: 'kong-classic-m', categoryName: 'Köpek Oyuncak', brandName: 'Kong', variantCount: 3, totalStockQty: 18, defaultSalePrice: '249.00', vitrinPublished: true, isActive: true, createdAt: new Date('2026-04-28') },
  { name: 'Acana Adult Small Breed 2 kg', slug: 'acana-small-breed-2kg', categoryName: 'Köpek Kuru Mama', brandName: 'Acana', variantCount: 1, totalStockQty: 0, defaultSalePrice: '650.00', vitrinPublished: false, isActive: true, createdAt: new Date('2026-05-01') },
  { name: 'Frontline Combo Spot On Kedi 3\'lü', slug: 'frontline-combo-spot-on-kedi', categoryName: 'Sağlık ve Bakım', brandName: 'Frontline', variantCount: 1, totalStockQty: 9, defaultSalePrice: '320.00', vitrinPublished: true, isActive: true, createdAt: new Date('2026-05-03') },
  { name: 'Tetra Pro Color Balık Yemi 100 g', slug: 'tetra-pro-color-100g', categoryName: 'Akvaryum', brandName: 'Tetra', variantCount: 1, totalStockQty: 35, defaultSalePrice: '78.50', vitrinPublished: true, isActive: true, createdAt: new Date('2026-05-05') },
  { name: 'JBL Algol Akvaryum Yosun Önleyici', slug: 'jbl-algol-akvaryum', categoryName: 'Akvaryum', brandName: 'JBL', variantCount: 1, totalStockQty: 14, defaultSalePrice: '125.00', vitrinPublished: true, isActive: true, createdAt: new Date('2026-05-07') },
  { name: 'Fluval Edge 12L Akvaryum Seti', slug: 'fluval-edge-12l', categoryName: 'Akvaryum', brandName: 'Fluval', variantCount: 1, totalStockQty: 3, defaultSalePrice: '2890.00', vitrinPublished: true, isActive: true, createdAt: new Date('2026-05-09') },
  { name: 'Vitakraft Muz Çubuk Muhabbet Kuşu', slug: 'vitakraft-muz-cubuk', categoryName: 'Kuş', brandName: 'Vitakraft', variantCount: 1, totalStockQty: 42, defaultSalePrice: '34.90', vitrinPublished: true, isActive: true, createdAt: new Date('2026-05-10') },
  { name: 'Beaphar Tasma Kedi Kene Pire', slug: 'beaphar-tasma-kene-pire-kedi', categoryName: 'Sağlık ve Bakım', brandName: 'Beaphar', variantCount: 1, totalStockQty: 0, defaultSalePrice: '155.00', vitrinPublished: false, isActive: false, createdAt: new Date('2026-04-10') },
];

// ────────────────────────────────────────────────────────────
// MOCK 2 — Markalar
// ────────────────────────────────────────────────────────────
const brands = [
  { name: 'Royal Canin', slug: 'royal-canin', logoUrl: 'https://example.com/logos/royal-canin.png', productCount: 38, createdAt: new Date('2026-04-01') },
  { name: 'Pro Plan', slug: 'pro-plan', logoUrl: null, productCount: 24, createdAt: new Date('2026-04-01') },
  { name: "Hill's Science Plan", slug: 'hills-science-plan', logoUrl: null, productCount: 19, createdAt: new Date('2026-04-01') },
  { name: 'Catit', slug: 'catit', logoUrl: null, productCount: 12, createdAt: new Date('2026-04-02') },
  { name: 'Acana', slug: 'acana', logoUrl: null, productCount: 16, createdAt: new Date('2026-04-02') },
  { name: 'Kong', slug: 'kong', logoUrl: null, productCount: 9, createdAt: new Date('2026-04-03') },
  { name: "Biokat's", slug: 'biokats', logoUrl: null, productCount: 7, createdAt: new Date('2026-04-03') },
  { name: 'Frontline', slug: 'frontline', logoUrl: null, productCount: 5, createdAt: new Date('2026-04-04') },
  { name: 'Tetra', slug: 'tetra', logoUrl: null, productCount: 14, createdAt: new Date('2026-04-04') },
  { name: 'JBL', slug: 'jbl', logoUrl: null, productCount: 11, createdAt: new Date('2026-04-05') },
  { name: 'Fluval', slug: 'fluval', logoUrl: null, productCount: 6, createdAt: new Date('2026-04-05') },
  { name: 'Vitakraft', slug: 'vitakraft', logoUrl: null, productCount: 8, createdAt: new Date('2026-04-06') },
  { name: 'Beaphar', slug: 'beaphar', logoUrl: null, productCount: 10, createdAt: new Date('2026-04-06') },
];

// ────────────────────────────────────────────────────────────
// MOCK 3 — Kategoriler
// ────────────────────────────────────────────────────────────
const categories = [
  { emoji: '🐈', name: 'Kedi Kuru Mama', slug: 'kedi-kuru-mama', sktRequired: true, displayOrder: 1, productCount: 42 },
  { emoji: '🐈', name: 'Kedi Yaş Mama', slug: 'kedi-yas-mama', sktRequired: true, displayOrder: 2, productCount: 18 },
  { emoji: '🐈', name: 'Kedi Kumu', slug: 'kedi-kumu', sktRequired: false, displayOrder: 3, productCount: 14 },
  { emoji: '🐕', name: 'Köpek Kuru Mama', slug: 'kopek-kuru-mama', sktRequired: true, displayOrder: 11, productCount: 38 },
  { emoji: '🐕', name: 'Köpek Yaş Mama', slug: 'kopek-yas-mama', sktRequired: true, displayOrder: 12, productCount: 12 },
  { emoji: '🐕', name: 'Köpek Oyuncak', slug: 'kopek-oyuncak', sktRequired: false, displayOrder: 13, productCount: 22 },
  { emoji: '🐦', name: 'Kuş', slug: 'kus', sktRequired: false, displayOrder: 21, productCount: 16 },
  { emoji: '🐠', name: 'Akvaryum', slug: 'akvaryum', sktRequired: false, displayOrder: 31, productCount: 28 },
  { emoji: '🐹', name: 'Kemirgen', slug: 'kemirgen', sktRequired: false, displayOrder: 41, productCount: 9 },
  { emoji: '💊', name: 'Sağlık ve Bakım', slug: 'saglik-bakim', sktRequired: true, displayOrder: 51, productCount: 24 },
  { emoji: '🍽', name: 'Mama ve Su Kapları', slug: 'mama-su-kabi', sktRequired: false, displayOrder: 61, productCount: 15 },
];

// ────────────────────────────────────────────────────────────
// MOCK 4 — Şubeler
// ────────────────────────────────────────────────────────────
const branches = [
  { name: 'Merkez Şube', cityName: 'İstanbul', districtName: 'Kadıköy', address: 'Bağdat Cad. No:142, Caddebostan / Kadıköy', whatsappPhone: '+905321112233', variantInventoryCount: 154, totalStockQty: 2840, isActive: true, createdAt: new Date('2025-08-15') },
  { name: 'Anadolu Şubesi', cityName: 'İstanbul', districtName: 'Üsküdar', address: 'Bağlarbaşı Mah. Hekimoğlu Cad. No:24, Üsküdar', whatsappPhone: '+905324445566', variantInventoryCount: 98, totalStockQty: 1620, isActive: true, createdAt: new Date('2025-12-03') },
  { name: 'İzmir Bornova', cityName: 'İzmir', districtName: 'Bornova', address: 'Erzene Mah. 138/3 Sok. No:8/A, Bornova', whatsappPhone: '+905327778899', variantInventoryCount: 64, totalStockQty: 980, isActive: true, createdAt: new Date('2026-02-20') },
  { name: 'Online Depo', cityName: 'İstanbul', districtName: 'Tuzla', address: 'Akfırat OSB, Tuzla — Sadece online satış stok', whatsappPhone: null, variantInventoryCount: 220, totalStockQty: 4500, isActive: false, createdAt: new Date('2025-11-10') },
];

// ────────────────────────────────────────────────────────────
// MOCK 5 — Tedarikçiler
// ────────────────────────────────────────────────────────────
const suppliers = [
  { name: 'Royal Canin Türkiye Distribütör', vatNo: '1234567890', vatOffice: 'Maslak V.D.', contactName: 'Ayşe Yılmaz', phone: '+902129990011', email: 'siparis@royalcanin-tr.com', city: 'İstanbul', district: 'Sarıyer', leadTimeDays: 7, paymentTerms: 'net_30', iban: 'TR320010009999901234567890', totalIncomingQty: 1245, isActive: true },
  { name: 'Pet Toptan Ltd. Şti.', vatNo: '9876543210', vatOffice: 'Ümraniye V.D.', contactName: 'Mehmet Demir', phone: '+902169998877', email: 'info@pettoptan.com.tr', city: 'İstanbul', district: 'Ümraniye', leadTimeDays: 3, paymentTerms: 'cash', iban: 'TR450020010099887766554433', totalIncomingQty: 856, isActive: true },
  { name: 'Hill\'s Türkiye', vatNo: '5544332211', vatOffice: 'Levent V.D.', contactName: 'Selin Kara', phone: '+902129997788', email: 'tr-orders@hills.com', city: 'İstanbul', district: 'Beşiktaş', leadTimeDays: 14, paymentTerms: 'net_60', iban: null, totalIncomingQty: 312, isActive: true },
  { name: 'Hayvan Dünyası A.Ş.', vatNo: '6677889900', vatOffice: 'Bornova V.D.', contactName: 'Kerem Aktaş', phone: '+902323337788', email: 'satis@hayvandunyasi.com.tr', city: 'İzmir', district: 'Bornova', leadTimeDays: 5, paymentTerms: 'net_30', iban: 'TR670030099876543210987654', totalIncomingQty: 488, isActive: true },
  { name: 'Akva Market', vatNo: '4488776655', vatOffice: 'Konak V.D.', contactName: 'Burak Şahin', phone: '+902323335566', email: 'info@akvamarket.com', city: 'İzmir', district: 'Konak', leadTimeDays: 2, paymentTerms: 'other', iban: null, totalIncomingQty: 62, isActive: false },
];

// ────────────────────────────────────────────────────────────
// MOCK 6 — Audit log
// ────────────────────────────────────────────────────────────
function mkAudit(daysAgo: number, action: string, userEmail: string, entityType: string, entityId: string, superadmin = false, reason: string | null = null, afterState: object | null = null) {
  return {
    createdAt: new Date(NOW.getTime() - daysAgo * 24 * 3600 * 1000),
    action,
    userEmail,
    entityType,
    entityId,
    performedAsSuperadmin: superadmin,
    superadminReason: reason,
    afterState,
  };
}

const auditRows = [
  mkAudit(0.1, 'stock_movement.stock_in', 'ahmet@patidukkani.com', 'stock_movement', 'a1b2c3d4-1111-2222-3333-444455556666', false, null, { afterQty: 47, quantity: 20, branchId: 'br-1', variantId: 'v-1' }),
  mkAudit(0.3, 'product.published', 'ahmet@patidukkani.com', 'product', 'p-12345678-aaaa-bbbb-cccc-dddd', false, null, { vitrinPublished: true }),
  mkAudit(1.2, 'stock_movement.stock_out', 'kasiyer@patidukkani.com', 'stock_movement', 'b2c3d4e5-aaaa-bbbb-cccc-dddd', false, null, { subtype: 'sale', quantity: 1, unitPrice: 599.9 }),
  mkAudit(2, 'branch.manager_removed', 'ahmet@patidukkani.com', 'branch', 'br-2-anadolu', false, null, null),
  mkAudit(3, 'user.invited', 'ahmet@patidukkani.com', 'user', 'u-new-staff', false, null, { email: 'yeni.kasiyer@patidukkani.com', role: 'STAFF' }),
  mkAudit(4, 'stock_movement.reversed', 'ahmet@patidukkani.com', 'stock_movement', 'c3d4e5f6-1111-2222-3333-4444', false, null, { reversesId: 'orig-mov-id' }),
  mkAudit(5, 'brands.catalog_seeded', 'ahmet@patidukkani.com', 'brand', null as never, false, null, { inserted: 95, skipped: 0 }),
  mkAudit(6.5, 'product.deleted', 'ahmet@patidukkani.com', 'product', 'p-old-discontinued', false, null, null),
  mkAudit(8, 'plan.upgraded', 'ahmet@patidukkani.com', 'company', 'co-1', true, 'Müşteri telefondan upgrade istedi, ödeme yapıldı', { from: 'FREE', to: 'PRO' }),
  mkAudit(10, 'category.created', 'ahmet@patidukkani.com', 'category', 'cat-new', false, null, { name: 'Egzotik Hayvanlar', emoji: '🦎' }),
  mkAudit(12, 'stocktake.completed', 'ahmet@patidukkani.com', 'stocktake', 'st-1', false, null, { totalItems: 124, diffItems: 3 }),
  mkAudit(14, 'company.vat_no_set', 'ahmet@patidukkani.com', 'company', 'co-1', false, null, { vatNo: '****567890' }),
];

// ────────────────────────────────────────────────────────────
// MOCK 7 — Daily Sales (son 30 gün)
// ────────────────────────────────────────────────────────────
const dailySales: Array<{ day: string; qty: number; revenue: number; count: number }> = [];
for (let i = 0; i < 30; i++) {
  const d = new Date(NOW.getTime() - i * 24 * 3600 * 1000);
  const dayStr = d.toISOString().slice(0, 10);
  // Hafta sonu daha yüksek satış
  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
  const baseQty = isWeekend ? 18 : 12;
  const variance = Math.round((Math.sin(i / 3) + 1) * 5);
  const qty = baseQty + variance;
  const avgPrice = 240 + Math.round(Math.cos(i / 5) * 40);
  dailySales.push({ day: dayStr, qty, revenue: qty * avgPrice, count: Math.ceil(qty / 1.8) });
}

// ────────────────────────────────────────────────────────────
// MOCK 8 — Top selling variants (son 90 gün)
// ────────────────────────────────────────────────────────────
const topVariants = [
  { productName: 'Royal Canin Adult Kedi Maması', variantLabel: '2 kg', sku: 'RC-AD-KEDI-2KG', totalQty: 142, totalRevenue: 85179.8, saleCount: 89 },
  { productName: 'Pro Plan Köpek Maması Lamb & Rice', variantLabel: '14 kg', sku: 'PP-LAMB-14KG', totalQty: 38, totalRevenue: 55100, saleCount: 22 },
  { productName: "Biokat's Pelet Kedi Kumu", variantLabel: '5 L', sku: 'BK-PELET-5L', totalQty: 124, totalRevenue: 23498, saleCount: 76 },
  { productName: "Hill's Kısırlaştırılmış Kedi Maması", variantLabel: '1.5 kg', sku: 'HS-KSR-15KG', totalQty: 67, totalRevenue: 32495, saleCount: 41 },
  { productName: 'Kong Classic Köpek Oyuncağı', variantLabel: 'M', sku: 'KONG-M', totalQty: 48, totalRevenue: 11952, saleCount: 36 },
  { productName: 'Frontline Combo Spot On', variantLabel: 'Kedi 3\'lü', sku: 'FL-COMBO-KEDI-3', totalQty: 32, totalRevenue: 10240, saleCount: 28 },
  { productName: 'Tetra Pro Color Balık Yemi', variantLabel: '100 g', sku: 'TT-PRO-100G', totalQty: 84, totalRevenue: 6594, saleCount: 52 },
  { productName: 'Catit Pixi Akıllı Mama Kabı', variantLabel: 'Standart', sku: 'CT-PIXI-STD', totalQty: 8, totalRevenue: 27992, saleCount: 8 },
  { productName: 'JBL Algol Yosun Önleyici', variantLabel: '100 ml', sku: 'JBL-ALGOL-100', totalQty: 26, totalRevenue: 3250, saleCount: 22 },
  { productName: 'Vitakraft Muz Çubuk', variantLabel: 'Muhabbet', sku: 'VK-MUZ-MUH', totalQty: 215, totalRevenue: 7503.5, saleCount: 142 },
];

// ────────────────────────────────────────────────────────────
// MOCK 9 — Stock movements (30 hareket)
// ────────────────────────────────────────────────────────────
interface MockMovement {
  createdAt: Date;
  type: string;
  subtype: string | null;
  branchName: string;
  productName: string;
  variantLabel: string;
  beforeQty: number;
  quantity: number;
  afterQty: number;
  unitCost: string | null;
  unitPrice: string | null;
  customerRef: string | null;
  paymentMethod: string | null;
  supplierName: string | null;
  documentNo: string | null;
  reason: string | null;
  note: string | null;
  performedBy: string | null;
  reversedById: string | null;
  reversesId: string | null;
}

const movements: MockMovement[] = [
  { createdAt: new Date(NOW.getTime() - 0.5 * 3600 * 1000), type: 'stock_out', subtype: 'sale', branchName: 'Merkez Şube', productName: 'Royal Canin Adult Kedi Maması', variantLabel: '2 kg', beforeQty: 48, quantity: -1, afterQty: 47, unitCost: '450.00', unitPrice: '599.90', customerRef: 'Sevgi Hanım', paymentMethod: 'card', supplierName: null, documentNo: null, reason: null, note: null, performedBy: 'kasiyer@patidukkani.com', reversedById: null, reversesId: null },
  { createdAt: new Date(NOW.getTime() - 2 * 3600 * 1000), type: 'stock_out', subtype: 'sale', branchName: 'Merkez Şube', productName: "Biokat's Pelet Kedi Kumu", variantLabel: '5 L', beforeQty: 30, quantity: -2, afterQty: 28, unitCost: '120.00', unitPrice: '189.50', customerRef: 'WhatsApp - Murat Bey', paymentMethod: 'cash', supplierName: null, documentNo: null, reason: null, note: 'Vitrin tıklamasından geldi', performedBy: 'kasiyer@patidukkani.com', reversedById: null, reversesId: null },
  { createdAt: new Date(NOW.getTime() - 4 * 3600 * 1000), type: 'stock_in', subtype: null, branchName: 'Merkez Şube', productName: 'Royal Canin Adult Kedi Maması', variantLabel: '2 kg', beforeQty: 28, quantity: 20, afterQty: 48, unitCost: '450.00', unitPrice: null, customerRef: null, paymentMethod: null, supplierName: 'Royal Canin Türkiye Distribütör', documentNo: 'IRS-2026-1023', reason: null, note: 'Aylık sipariş', performedBy: 'ahmet@patidukkani.com', reversedById: null, reversesId: null },
  { createdAt: new Date(NOW.getTime() - 6 * 3600 * 1000), type: 'transfer', subtype: null, branchName: 'Merkez Şube', productName: 'Pro Plan Köpek Maması Lamb & Rice', variantLabel: '14 kg', beforeQty: 18, quantity: -6, afterQty: 12, unitCost: null, unitPrice: null, customerRef: null, paymentMethod: null, supplierName: null, documentNo: null, reason: 'Anadolu şubesi talep etti', note: null, performedBy: 'ahmet@patidukkani.com', reversedById: null, reversesId: null },
  { createdAt: new Date(NOW.getTime() - 6 * 3600 * 1000), type: 'transfer', subtype: null, branchName: 'Anadolu Şubesi', productName: 'Pro Plan Köpek Maması Lamb & Rice', variantLabel: '14 kg', beforeQty: 4, quantity: 6, afterQty: 10, unitCost: null, unitPrice: null, customerRef: null, paymentMethod: null, supplierName: null, documentNo: null, reason: 'Anadolu şubesi talep etti', note: null, performedBy: 'ahmet@patidukkani.com', reversedById: null, reversesId: null },
  { createdAt: new Date(NOW.getTime() - 1 * 24 * 3600 * 1000), type: 'stocktake', subtype: null, branchName: 'Merkez Şube', productName: "Hill's Kısırlaştırılmış Kedi", variantLabel: '1.5 kg', beforeQty: 24, quantity: -2, afterQty: 22, unitCost: '320.00', unitPrice: null, customerRef: null, paymentMethod: null, supplierName: null, documentNo: 'ST-2026-05', reason: 'Sayım: loss', note: 'Aylık sayım — 2 adet eksik', performedBy: 'ahmet@patidukkani.com', reversedById: null, reversesId: null },
  { createdAt: new Date(NOW.getTime() - 1.2 * 24 * 3600 * 1000), type: 'stock_out', subtype: 'waste', branchName: 'Merkez Şube', productName: 'Frontline Combo Spot On', variantLabel: 'Kedi 3\'lü', beforeQty: 10, quantity: -1, afterQty: 9, unitCost: '180.00', unitPrice: null, customerRef: null, paymentMethod: null, supplierName: null, documentNo: null, reason: 'SKT geçmiş', note: 'İade edildi tedarikçiye', performedBy: 'ahmet@patidukkani.com', reversedById: null, reversesId: null },
  { createdAt: new Date(NOW.getTime() - 2 * 24 * 3600 * 1000), type: 'stock_out', subtype: 'sale', branchName: 'Anadolu Şubesi', productName: 'Catit Pixi Akıllı Mama Kabı', variantLabel: 'Standart', beforeQty: 7, quantity: -2, afterQty: 5, unitCost: '2200.00', unitPrice: '3499.00', customerRef: 'Demet Hanım', paymentMethod: 'credit', supplierName: null, documentNo: null, reason: null, note: '15 gün veresiye', performedBy: 'kasiyer@patidukkani.com', reversedById: null, reversesId: null },
  { createdAt: new Date(NOW.getTime() - 3 * 24 * 3600 * 1000), type: 'stock_in', subtype: null, branchName: 'İzmir Bornova', productName: 'Tetra Pro Color Balık Yemi', variantLabel: '100 g', beforeQty: 0, quantity: 40, afterQty: 40, unitCost: '42.00', unitPrice: null, customerRef: null, paymentMethod: null, supplierName: 'Akva Market', documentNo: 'AKV-2026-0145', reason: null, note: null, performedBy: 'ahmet@patidukkani.com', reversedById: null, reversesId: null },
  { createdAt: new Date(NOW.getTime() - 4 * 24 * 3600 * 1000), type: 'stock_out', subtype: 'gift', branchName: 'Merkez Şube', productName: 'Kong Classic Köpek Oyuncağı', variantLabel: 'M', beforeQty: 20, quantity: -1, afterQty: 19, unitCost: '120.00', unitPrice: null, customerRef: 'Sadık müşteri hediyesi', paymentMethod: null, supplierName: null, documentNo: null, reason: null, note: 'Sevgi Hanım 5 yıllık müşteri', performedBy: 'ahmet@patidukkani.com', reversedById: null, reversesId: null },
];

// ────────────────────────────────────────────────────────────
// EXPORT ÜRETİM
// ────────────────────────────────────────────────────────────

async function genUrunler() {
  const buf = await buildXlsxBuffer<MockProduct>({
    sheetName: 'Ürünler',
    title: '🛍 Ürün Listesi',
    subtitle: `Toplam ${products.length} kayıt`,
    metadata: { tenantName: TENANT, generatedAt: NOW, filterSummary: 'Tüm ürünler' },
    columns: [
      { key: 'name', header: 'Ürün Adı', width: 40 },
      { key: 'slug', header: 'Slug', width: 28 },
      { key: (r) => r.categoryName ?? '—', header: 'Kategori', width: 22 },
      { key: (r) => r.brandName ?? '—', header: 'Marka', width: 18 },
      { key: 'variantCount', header: 'Aktif Variant', width: 14, format: 'integer' },
      { key: 'totalStockQty', header: 'Toplam Stok', width: 14, format: 'integer' },
      { key: (r) => (r.defaultSalePrice ? Number(r.defaultSalePrice) : null), header: 'Satış Fiyatı (₺)', width: 18, format: 'currency_try' },
      { key: (r) => (r.vitrinPublished ? 'Açık' : 'Kapalı'), header: 'Vitrin', width: 12, align: 'center' },
      { key: (r) => (r.isActive ? 'Aktif' : 'Pasif'), header: 'Durum', width: 10, align: 'center' },
      { key: 'createdAt', header: 'Oluşturma', width: 14, format: 'date_tr' },
    ],
    rows: products,
  });
  return { name: '1-urunler.xlsx', buf };
}

async function _genMarkalar() {
  const buf = await buildXlsxBuffer<typeof brands[number]>({
    sheetName: 'Markalar',
    title: '🏷 Marka Listesi',
    subtitle: `Toplam ${brands.length} marka`,
    metadata: { tenantName: TENANT, generatedAt: NOW },
    columns: [
      { key: 'name', header: 'Marka Adı', width: 30 },
      { key: 'slug', header: 'Slug', width: 24 },
      { key: (r) => r.logoUrl ?? '—', header: 'Logo URL', width: 36 },
      { key: 'productCount', header: 'Ürün Sayısı', width: 14, format: 'integer' },
      { key: 'createdAt', header: 'Oluşturma', width: 14, format: 'date_tr' },
    ],
    rows: brands,
  });
  return { name: '2-markalar.xlsx', buf };
}

async function _genKategoriler() {
  const buf = await buildXlsxBuffer<typeof categories[number]>({
    sheetName: 'Kategoriler',
    title: '📂 Kategori Listesi',
    subtitle: `Toplam ${categories.length} kategori (SUPERADMIN export)`,
    metadata: { tenantName: TENANT, generatedAt: NOW },
    columns: [
      { key: (r) => r.emoji ?? '', header: 'Emoji', width: 8, align: 'center' },
      { key: 'name', header: 'Kategori Adı', width: 28 },
      { key: 'slug', header: 'Slug', width: 24 },
      { key: (r) => (r.sktRequired ? 'Evet' : 'Hayır'), header: 'SKT Zorunlu', width: 14, align: 'center' },
      { key: 'displayOrder', header: 'Sıra', width: 10, format: 'integer' },
      { key: 'productCount', header: 'Ürün Sayısı', width: 14, format: 'integer' },
    ],
    rows: categories,
  });
  return { name: '3-kategoriler.xlsx', buf };
}

async function genSubeler() {
  const buf = await buildXlsxBuffer<typeof branches[number]>({
    sheetName: 'Şubeler',
    title: '🏪 Şube Listesi',
    subtitle: `Toplam ${branches.length} şube`,
    metadata: { tenantName: TENANT, generatedAt: NOW },
    columns: [
      { key: 'name', header: 'Şube Adı', width: 24 },
      { key: (r) => r.cityName ?? '—', header: 'Şehir', width: 14 },
      { key: (r) => r.districtName ?? '—', header: 'İlçe', width: 14 },
      { key: (r) => r.address ?? '—', header: 'Adres', width: 50 },
      { key: (r) => r.whatsappPhone ?? '—', header: 'WhatsApp', width: 18 },
      { key: 'variantInventoryCount', header: 'Variant Sayısı', width: 14, format: 'integer' },
      { key: 'totalStockQty', header: 'Toplam Stok', width: 14, format: 'integer' },
      { key: (r) => (r.isActive ? 'Aktif' : 'Pasif'), header: 'Durum', width: 10, align: 'center' },
      { key: 'createdAt', header: 'Oluşturma', width: 14, format: 'date_tr' },
    ],
    rows: branches,
  });
  return { name: '4-subeler.xlsx', buf };
}

async function genTedarikciler() {
  const buf = await buildXlsxBuffer<typeof suppliers[number]>({
    sheetName: 'Tedarikçiler',
    title: '🏢 Tedarikçi Listesi',
    subtitle: `Toplam ${suppliers.length} tedarikçi`,
    metadata: { tenantName: TENANT, generatedAt: NOW },
    columns: [
      { key: 'name', header: 'Tedarikçi Adı', width: 32 },
      { key: (r) => r.vatNo ?? '—', header: 'VKN', width: 14 },
      { key: (r) => r.vatOffice ?? '—', header: 'Vergi Dairesi', width: 20 },
      { key: (r) => r.contactName ?? '—', header: 'Yetkili Kişi', width: 22 },
      { key: (r) => r.phone ?? '—', header: 'Telefon', width: 18 },
      { key: (r) => r.email ?? '—', header: 'E-posta', width: 28 },
      { key: (r) => r.city ?? '—', header: 'Şehir', width: 14 },
      { key: (r) => r.district ?? '—', header: 'İlçe', width: 14 },
      { key: 'leadTimeDays', header: 'Lead Time (gün)', width: 16, format: 'integer' },
      { key: (r) => PAYMENT_TR[r.paymentTerms] ?? r.paymentTerms, header: 'Ödeme Koşulu', width: 18 },
      { key: (r) => r.iban ?? '—', header: 'IBAN', width: 32 },
      { key: 'totalIncomingQty', header: 'Toplam Giriş', width: 14, format: 'integer' },
      { key: (r) => (r.isActive ? 'Aktif' : 'Pasif'), header: 'Durum', width: 10, align: 'center' },
    ],
    rows: suppliers,
  });
  return { name: '5-tedarikciler.xlsx', buf };
}

async function genAuditLog() {
  const buf = await buildXlsxBuffer<typeof auditRows[number]>({
    sheetName: 'Audit Log',
    title: '📜 Denetim Kayıtları',
    subtitle: `Son ${auditRows.length} kayıt`,
    metadata: { tenantName: TENANT, generatedAt: NOW, filterSummary: 'Tüm kayıtlar' },
    columns: [
      { key: 'createdAt', header: 'Tarih', width: 18, format: 'datetime_tr' },
      { key: 'action', header: 'Aksiyon', width: 28 },
      { key: (r) => r.userEmail ?? '—', header: 'Kullanıcı', width: 30 },
      { key: (r) => r.entityType ?? '—', header: 'Hedef Türü', width: 18 },
      { key: (r) => r.entityId ?? '—', header: 'Hedef ID', width: 36 },
      { key: (r) => (r.performedAsSuperadmin ? '✓' : '✕'), header: 'Süperadmin', width: 12, align: 'center' },
      { key: (r) => r.superadminReason ?? '—', header: 'Süperadmin Sebep', width: 36 },
      { key: (r) => (r.afterState ? JSON.stringify(r.afterState) : '—'), header: 'After State (JSON)', width: 60 },
    ],
    rows: auditRows,
  });
  return { name: '6-audit-log.xlsx', buf };
}

async function genReportsDaily() {
  const buf = await buildXlsxBuffer<typeof dailySales[number]>({
    sheetName: 'Günlük Satış',
    title: '📈 Günlük Satış Raporu',
    subtitle: `Son ${dailySales.length} gün · toplam ${dailySales.reduce((s, d) => s + d.qty, 0)} adet`,
    metadata: { tenantName: TENANT, generatedAt: NOW, filterSummary: 'Pencere: 30 gün' },
    columns: [
      { key: (r) => new Date(r.day), header: 'Tarih', width: 14, format: 'date_tr' },
      { key: 'qty', header: 'Adet', width: 12, format: 'integer' },
      { key: 'revenue', header: 'Ciro (₺)', width: 16, format: 'currency_try' },
      { key: 'count', header: 'Satış Sayısı', width: 14, format: 'integer' },
    ],
    rows: dailySales,
  });
  return { name: '7a-gunluk-satis-30gun.xlsx', buf };
}

async function genReportsTop() {
  const buf = await buildXlsxBuffer<typeof topVariants[number]>({
    sheetName: 'En Çok Satanlar',
    title: '🏆 En Çok Satan Ürünler',
    subtitle: `Son 90 gün · ${topVariants.length} variant`,
    metadata: { tenantName: TENANT, generatedAt: NOW, filterSummary: 'Pencere: 90 gün' },
    columns: [
      { key: 'productName', header: 'Ürün', width: 36 },
      { key: 'variantLabel', header: 'Variant', width: 18 },
      { key: 'sku', header: 'SKU', width: 22 },
      { key: 'totalQty', header: 'Toplam Adet', width: 14, format: 'integer' },
      { key: 'totalRevenue', header: 'Toplam Ciro (₺)', width: 18, format: 'currency_try' },
      { key: 'saleCount', header: 'Satış Sayısı', width: 14, format: 'integer' },
    ],
    rows: topVariants,
  });
  return { name: '7b-en-cok-satanlar-90gun.xlsx', buf };
}

async function genStockMovements() {
  const buf = await buildXlsxBuffer<MockMovement>({
    sheetName: 'Stok Hareketleri',
    title: '📦 Stok Hareketleri (Ledger)',
    subtitle: `Son ${movements.length} hareket`,
    metadata: { tenantName: TENANT, generatedAt: NOW, filterSummary: 'Tüm hareketler' },
    columns: [
      { key: 'createdAt', header: 'Tarih', width: 18, format: 'datetime_tr' },
      { key: (r) => TYPE_TR[r.type] ?? r.type, header: 'Tür', width: 14 },
      { key: (r) => r.subtype ?? '—', header: 'Alt Tür', width: 14 },
      { key: 'branchName', header: 'Şube', width: 18 },
      { key: 'productName', header: 'Ürün', width: 32 },
      { key: 'variantLabel', header: 'Variant', width: 16 },
      { key: 'beforeQty', header: 'Önce', width: 10, format: 'integer' },
      { key: 'quantity', header: 'Δ', width: 8, format: 'integer' },
      { key: 'afterQty', header: 'Sonra', width: 10, format: 'integer' },
      { key: (r) => (r.unitCost ? Number(r.unitCost) : null), header: 'Birim Alış (₺)', width: 16, format: 'currency_try' },
      { key: (r) => (r.unitPrice ? Number(r.unitPrice) : null), header: 'Birim Satış (₺)', width: 16, format: 'currency_try' },
      { key: (r) => r.customerRef ?? '—', header: 'Müşteri', width: 26 },
      { key: (r) => r.paymentMethod ?? '—', header: 'Ödeme', width: 14 },
      { key: (r) => r.supplierName ?? '—', header: 'Tedarikçi', width: 30 },
      { key: (r) => r.documentNo ?? '—', header: 'Belge No', width: 16 },
      { key: (r) => r.reason ?? '—', header: 'Sebep', width: 22 },
      { key: (r) => r.note ?? '—', header: 'Not', width: 30 },
      { key: (r) => r.performedBy ?? '—', header: 'Kullanıcı', width: 26 },
      { key: (r) => (r.reversedById ? '✓' : ''), header: 'Geri alındı', width: 12, align: 'center' },
      { key: (r) => (r.reversesId ? '✓' : ''), header: 'Geri alma', width: 12, align: 'center' },
    ],
    rows: movements,
  });
  return { name: '8-stok-hareketleri.xlsx', buf };
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const generators = [
    genUrunler,
    genSubeler,
    genTedarikciler,
    genAuditLog,
    genReportsDaily,
    genReportsTop,
    genStockMovements,
  ];
  const results: Array<{ name: string; sizeKB: number }> = [];
  for (const gen of generators) {
    const { name, buf } = await gen();
    const path = join(OUTPUT_DIR, name);
    await writeFile(path, buf);
    results.push({ name, sizeKB: Math.round(buf.byteLength / 1024 * 10) / 10 });
    console.log(`✓ ${name} — ${(buf.byteLength / 1024).toFixed(1)} KB`);
  }
  console.log(`\nToplam ${results.length} dosya üretildi: ${OUTPUT_DIR}`);
}

main().catch((e) => {
  console.error('HATA:', e);
  process.exit(1);
});

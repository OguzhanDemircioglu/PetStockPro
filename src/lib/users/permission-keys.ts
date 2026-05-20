/**
 * PERMISSION KEYS — STAFF (Çalışan) granular permission sistemi
 *
 * Faz 1 (2026-05-21) — Plan §C
 *
 * 15 key total:
 *   - 3 default ON (sale.create, variant.view, customer_ref.write) — STAFF
 *     davet edildiğinde otomatik aktif (Faz 2 applyStaffDefaults helper).
 *   - 12 default OFF — Bayi Admin /admin/settings/users yetki modal'ından
 *     tek tek açar.
 *
 * BAYI_SAHIBI + SUPERADMIN tüm yetkilere sahip (helper bypass eder).
 * OBSERVER hiçbir yetkiye sahip değil (read-only — assertNotObserver gate).
 *
 * Format: 'entity.action' — lowercase + nokta + snake_case (ASCII).
 */

export const PERMISSION_KEYS = {
  // ─── Default ON (STAFF davet edildiğinde otomatik aktif) ────────
  SALE_CREATE: 'sale.create',
  VARIANT_VIEW: 'variant.view',
  CUSTOMER_REF_WRITE: 'customer_ref.write',

  // ─── Default OFF (Bayi Admin tek tek açar) ──────────────────────
  STOCK_IN_CREATE: 'stock_in.create',
  STOCK_OUT_WASTE: 'stock_out.waste',
  STOCK_OUT_GIFT: 'stock_out.gift',
  STOCK_OUT_SAMPLE: 'stock_out.sample',
  STOCK_OUT_INTERNAL: 'stock_out.internal',
  STOCK_OUT_RETURN: 'stock_out.return',
  TRANSFER_CREATE: 'transfer.create',
  STOCKTAKE_CREATE: 'stocktake.create',
  DISCOUNT_APPLY: 'discount.apply',
  CREDIT_SALE_CREATE: 'credit_sale.create',
  VITRIN_MANAGE: 'vitrin.manage',
  PRICE_EDIT: 'price.edit',
} as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[keyof typeof PERMISSION_KEYS];

/** Tüm key'lerin tek yerden listesi — set/lookup için. */
export const ALL_PERMISSION_KEYS: readonly PermissionKey[] = Object.values(PERMISSION_KEYS);

/** STAFF davet edildiğinde otomatik ON kayıt açılan 3 yetki. */
export const STAFF_DEFAULT_ON: readonly PermissionKey[] = [
  PERMISSION_KEYS.SALE_CREATE,
  PERMISSION_KEYS.VARIANT_VIEW,
  PERMISSION_KEYS.CUSTOMER_REF_WRITE,
];

/** Default OFF — Bayi Admin tek tek açar (yetki modal'ında işaretli değil). */
export const STAFF_DEFAULT_OFF: readonly PermissionKey[] = ALL_PERMISSION_KEYS.filter(
  (k) => !STAFF_DEFAULT_ON.includes(k),
);

/** Türkçe label — yetki modal'ında ve audit log mesajlarında. */
export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  // Default ON
  'sale.create': 'Satış kaydet',
  'variant.view': 'Ürün ve fiyat görüntüle',
  'customer_ref.write': 'Müşteri referans yazma',
  // Default OFF
  'stock_in.create': 'Alım (stok-in)',
  'stock_out.waste': 'Fire kaydet',
  'stock_out.gift': 'Hediye olarak çıkış',
  'stock_out.sample': 'Numune çıkışı',
  'stock_out.internal': 'Dahili kullanım çıkışı',
  'stock_out.return': 'İade kaydet',
  'transfer.create': 'Şubeler arası transfer',
  'stocktake.create': 'Sayım başlat',
  'discount.apply': 'İndirim uygula',
  'credit_sale.create': 'Veresiye satış',
  'vitrin.manage': 'Vitrin yönetimi',
  'price.edit': 'Variant fiyat değiştirme',
};

/** Bir key'in PERMISSION_KEYS'de tanımlı olup olmadığını runtime check. */
export function isValidPermissionKey(value: string): value is PermissionKey {
  return (ALL_PERMISSION_KEYS as readonly string[]).includes(value);
}

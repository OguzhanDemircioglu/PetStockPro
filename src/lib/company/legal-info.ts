/**
 * Legal company info reader (lansman öncesi/sonrası conditional)
 *
 * 2026-05-22: /contact, /privacy-policy, /distance-sales-agreement, /terms-of-service
 * sayfalarında "Şirket bilgileri" section'ı placeholder yerine gizlemek için.
 *
 * Kullanım:
 *   const info = getLegalCompanyInfo();
 *   if (info.hasRealInfo) {
 *     // VKN/MERSİS/Unvan dolu — yasal sayfa satıcı kimlik bloku göster
 *   } else {
 *     // Lansman öncesi — "Şirket bilgileri yakında" yedek paragrafı
 *   }
 *
 * "Tam dolu" tanımı: name + vatNo + address üçü birden anlamlı değer.
 * "[PLACEHOLDER]" string veya boş string anlamsız sayılır.
 *
 * Lansman öncesi staging'de bu env'ler boştur → section gizlenir.
 * Şirket kuruluş tamamlanınca .env'e gerçek değer doldurulur → otomatik görünür.
 */

const PLACEHOLDER_MARKER = '[PLACEHOLDER]';

function readEnv(name: string): string | null {
  const v = process.env[name];
  if (!v) return null;
  const trimmed = v.trim();
  if (trimmed === '' || trimmed === PLACEHOLDER_MARKER) return null;
  return trimmed;
}

export interface LegalCompanyInfo {
  /** Tüm zorunlu yasal alanlar (unvan + VKN + adres) dolu mu? */
  hasRealInfo: boolean;
  /** Ticari unvan (ör. "PetStockPro Yazılım A.Ş.") */
  legalName: string | null;
  /** Marka adı — her zaman "PetStockPro" (sabit) */
  brandName: string;
  /** VKN (10 hane kurumlar) veya TC (11 hane şahıs) */
  vatNo: string | null;
  /** Vergi dairesi */
  taxOffice: string | null;
  /** MERSİS numarası (limited/anonim için 16 hane) */
  mersisNo: string | null;
  /** Ticaret sicil numarası */
  tradeRegistryNo: string | null;
  /** Ticaret sicil müdürlüğü */
  tradeRegistryOffice: string | null;
  /** Tam yasal adres */
  address: string | null;
  /** Resmi iletişim telefonu */
  phone: string | null;
  /** Müşteri destek e-posta — her zaman dolu (default) */
  supportEmail: string;
  /** KVKK veri sorumlusu e-posta — her zaman dolu */
  kvkkEmail: string;
  /** KEP adresi (kurumlar için zorunlu) */
  kepAddress: string | null;
  /** Yetkili mahkeme şehri */
  legalJurisdiction: string;
}

export function getLegalCompanyInfo(): LegalCompanyInfo {
  const legalName = readEnv('COMPANY_LEGAL_NAME');
  const vatNo = readEnv('COMPANY_VAT_NO');
  const address = readEnv('COMPANY_ADDRESS');

  return {
    hasRealInfo: !!(legalName && vatNo && address),
    legalName,
    brandName: readEnv('COMPANY_BRAND_NAME') ?? 'PetStockPro',
    vatNo,
    taxOffice: readEnv('COMPANY_TAX_OFFICE'),
    mersisNo: readEnv('COMPANY_MERSIS_NO'),
    tradeRegistryNo: readEnv('COMPANY_TRADE_REGISTRY_NO'),
    tradeRegistryOffice: readEnv('COMPANY_TRADE_REGISTRY_OFFICE'),
    address,
    phone: readEnv('COMPANY_PHONE'),
    supportEmail: readEnv('COMPANY_SUPPORT_EMAIL') ?? 'info@petstockpro.com',
    kvkkEmail: readEnv('COMPANY_KVKK_EMAIL') ?? 'info@petstockpro.com',
    kepAddress: readEnv('COMPANY_KEP_ADDRESS'),
    legalJurisdiction: readEnv('COMPANY_LEGAL_JURISDICTION') ?? 'İstanbul',
  };
}

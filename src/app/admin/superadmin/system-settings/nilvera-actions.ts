'use server';

import { requireSuperadmin } from '@/lib/superadmin/access';
import { getNilveraConfig } from '@/lib/nilvera/config';
import { getNilveraSellerCompany } from '@/lib/nilvera/lookup';

export interface NilveraTestResult {
  ok: boolean;
  baseUrl: string;
  /** NILVERA_SERIE env tanımlı mı (e-Arşiv/e-Fatura serisi — yoksa fatura kesilemez). */
  serieSet: boolean;
  /** NILVERA_SELLER_VKN env tanımlı mı. */
  sellerVknSet: boolean;
  /** /general/Company'den dönen satıcı (bizim) hesap profili. */
  account?: {
    name: string | null;
    taxNumber: string | null;
    taxOffice: string | null;
    city: string | null;
    isActive: boolean | null;
  };
  error?: string;
}

/**
 * "Nilvera Bağlantı Testi" — canlı anahtarla GET /general/Company çağırıp
 * satıcı hesabımızın bilgisini gösterir. Anahtarı paylaşmadan canlı kurulumu doğrular.
 */
export async function testNilveraConnectionAction(): Promise<NilveraTestResult> {
  await requireSuperadmin();

  let baseUrl = process.env.NILVERA_BASE_URL || 'https://api.nilvera.com';
  let serieSet = !!process.env.NILVERA_SERIE;
  let sellerVknSet = !!process.env.NILVERA_SELLER_VKN;

  try {
    const cfg = getNilveraConfig();
    baseUrl = cfg.NILVERA_BASE_URL;
    serieSet = !!cfg.NILVERA_SERIE;
    sellerVknSet = !!cfg.NILVERA_SELLER_VKN;
  } catch (e) {
    return {
      ok: false,
      baseUrl,
      serieSet,
      sellerVknSet,
      error: `Config geçersiz: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  try {
    const acc = await getNilveraSellerCompany();
    return {
      ok: true,
      baseUrl,
      serieSet,
      sellerVknSet,
      account: {
        name: acc.Name ?? null,
        taxNumber: acc.TaxNumber ?? null,
        taxOffice: acc.TaxOffice ?? null,
        city: acc.City ?? null,
        isActive: acc.IsActive ?? null,
      },
    };
  } catch (err) {
    return {
      ok: false,
      baseUrl,
      serieSet,
      sellerVknSet,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

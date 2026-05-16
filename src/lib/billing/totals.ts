/**
 * Billing helpers — KDV hesaplamaları + dönem matematiği.
 *
 * Pure functions, side-effect yok. Orchestrator + invoice helper'lar buradan
 * çağırır. Sprint 14 finale.
 *
 * KDV oranı: TR 2024 sonrası genel %20 (önceki %18). 2026-05-14 MANTIK-HATALARI
 * OT2-2 kararı: lib/constants/vat-rates.ts'te tek kaynak, burada o sabit kullanılır.
 *
 * Para birimi: TRY (TR-only, Paddle Faz 2). Hesaplamalar 2 ondalık precision.
 */

/** Subscription fiyatlandırması KDV dahil — TR yasal pratik (PRO 750₺ KDV dahil). */
export const SUBSCRIPTION_VAT_RATE = 20; // yüzde

export interface InvoiceTotals {
  /** KDV hariç matrah (₺) — 2 ondalık. */
  matrah: number;
  /** KDV tutarı (₺) — 2 ondalık. */
  vat: number;
  /** Toplam KDV dahil (₺) — 2 ondalık. */
  total: number;
}

/**
 * KDV dahil toplam tutardan matrah + KDV ayrıştır.
 *
 * Pet shop'a PRO 750₺ KDV dahil tahsil ediyoruz. Nilvera e-Arşiv için:
 *   matrah = 750 / 1.20 = 625.00
 *   vat    = 750 - 625  = 125.00
 *
 * Yuvarlama: matrah'ı 2 ondalığa yuvarla, vat'ı toplam-matrah olarak hesap.
 * Bu sayede vat + matrah = total tam eşit kalır (penny rounding bug yok).
 *
 * @param amountTotal — KDV dahil tutar (string veya number, decimal kabul)
 * @param vatRate — KDV oranı yüzde (default 20)
 * @returns matrah + vat + total — hepsi number, 2 ondalık
 *
 * @throws Error — amountTotal NaN, negatif veya sonsuz
 */
export function computeInvoiceTotals(
  amountTotal: number | string,
  vatRate: number = SUBSCRIPTION_VAT_RATE,
): InvoiceTotals {
  const total = typeof amountTotal === 'string' ? Number(amountTotal) : amountTotal;

  if (!Number.isFinite(total) || total < 0) {
    throw new Error(`Geçersiz toplam tutar: ${amountTotal}`);
  }
  if (!Number.isFinite(vatRate) || vatRate < 0) {
    throw new Error(`Geçersiz KDV oranı: ${vatRate}`);
  }

  // matrah = total / (1 + vatRate%) — 2 ondalığa yuvarla
  const matrah = Math.round((total / (1 + vatRate / 100)) * 100) / 100;
  // vat = total - matrah — penny-safe (toplam aynen korunur)
  const vat = Math.round((total - matrah) * 100) / 100;
  // total'ı da yuvarla (girdi 3 ondalıklıysa)
  const totalRounded = Math.round(total * 100) / 100;

  return { matrah, vat, total: totalRounded };
}

/**
 * Bir tarihe N ay ekle. Subscription period extension için.
 *
 * setMonth() ay-sonu durumlarını (örn. 31 Ocak + 1 ay) JS native şekilde handle eder:
 *   31 Ocak + 1 ay → 28/29 Şubat (otomatik clamp)
 *   28 Şubat + 1 ay → 28 Mart
 *
 * Bu MVP için yeterli — iyzico aylık abonelik fix gün senaryosu az.
 */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

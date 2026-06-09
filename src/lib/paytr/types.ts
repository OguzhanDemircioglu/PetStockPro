/**
 * PayTR tipleri — Zod şemaları + TS tipleri
 *
 * PayTR resmi SDK yok. İki yapı:
 *   1. get-token JSON yanıtı (Adım 1)
 *   2. Callback POST gövdesi (Adım 2) — application/x-www-form-urlencoded gelir,
 *      route handler form'u objeye çevirip bu şemayla doğrular.
 */

import { z } from 'zod';

/**
 * PayTR sepet kalemi: [ürün adı, birim fiyat (string ₺ ör. '120.00'), adet].
 * user_basket = base64(JSON.stringify(PaytrBasketItem[])).
 */
export type PaytrBasketItem = [name: string, price: string, count: number];

/**
 * get-token yanıtı: { status: 'success', token } veya { status: 'failed', reason }.
 */
export const paytrGetTokenResponseSchema = z.object({
  status: z.enum(['success', 'failed']),
  token: z.string().optional(),
  reason: z.string().optional(),
});
export type PaytrGetTokenResponse = z.infer<typeof paytrGetTokenResponseSchema>;

/**
 * PayTR callback (ödeme bildirimi) gövdesi. PayTR merchant callback URL'ine
 * form-urlencoded POST eder. hash, verifyPaytrCallbackHash ile doğrulanır.
 *
 * passthrough: PayTR ileride alan eklerse kaybolmasın (debug payload).
 */
export const paytrCallbackSchema = z
  .object({
    merchant_oid: z.string().min(1),
    status: z.enum(['success', 'failed']),
    total_amount: z.string(), // kuruş string (×100)
    hash: z.string().min(1),
    payment_type: z.string().optional(), // 'card' | 'eft'
    payment_amount: z.string().optional(),
    currency: z.string().optional(),
    test_mode: z.string().optional(),
    failed_reason_code: z.string().optional(),
    failed_reason_msg: z.string().optional(),
  })
  .passthrough();
export type PaytrCallback = z.infer<typeof paytrCallbackSchema>;

/**
 * Recurring (kayıtlı kart / Non3D) charge yanıtı.
 *   - 'success'       → tahsilat tamam
 *   - 'failed'        → reddedildi (dunning sinyali — exception DEĞİL)
 *   - 'wait_callback' → PayTR doğruluyor, sonuç callback ile gelecek
 */
export const paytrChargeResponseSchema = z
  .object({
    status: z.enum(['success', 'failed', 'wait_callback']),
    reason: z.string().optional(),
    err_no: z.union([z.string(), z.number()]).optional(),
    err_msg: z.string().optional(),
  })
  .passthrough();
export type PaytrChargeResponse = z.infer<typeof paytrChargeResponseSchema>;

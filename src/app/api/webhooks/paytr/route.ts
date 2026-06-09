/**
 * PayTR Ödeme Bildirimi (Callback) Route — POST /api/webhooks/paytr
 *
 * PayTR ödeme sonucunu buraya application/x-www-form-urlencoded POST eder.
 *
 * Güvenlik + güvenilirlik:
 *   - Hash doğrulanmazsa ASLA "OK" dönme (sahte istek) → 400.
 *   - Yapılandırma eksikse → 500 (webhook güvensiz).
 *   - İşlenen her outcome (processed/duplicate/not_found/mismatch) → "OK" 200
 *     (PayTR retry spam önleme; idempotency processed_webhooks ile zaten sağlanır).
 *   - processPaytrCallback THROW ederse (DB tx hatası) → 500 → PayTR retry → temiz reprocess
 *     (orchestrator transaction'lı: yarım kalan yazım rollback olur).
 *
 * PayTR yanıt olarak SADECE düz metin "OK" bekler.
 */

import { getPaytrConfig } from '@/lib/paytr/config';
import { verifyPaytrCallbackHash } from '@/lib/paytr/hash';
import { processPaytrCallback } from '@/lib/billing/orchestrator';
import { createNilveraInvoice } from '@/lib/nilvera/invoice';
import { isNilveraConfigured } from '@/lib/nilvera/config';
import { db } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const bodyText = await request.text();
  const params = new URLSearchParams(bodyText);

  const merchantOid = params.get('merchant_oid');
  const status = params.get('status');
  const totalAmount = params.get('total_amount');
  const receivedHash = params.get('hash');

  if (!merchantOid || !status || !totalAmount || !receivedHash) {
    return new Response('PAYTR notification failed: eksik alan', { status: 400 });
  }

  const cfg = getPaytrConfig();
  if (!cfg.merchantKey || !cfg.merchantSalt) {
    return new Response('PAYTR notification failed: yapılandırma eksik', { status: 500 });
  }

  // Hash doğrula — geçersizse ASLA "OK" dönme.
  const valid = verifyPaytrCallbackHash(
    { merchantOid, status, totalAmount, receivedHash },
    cfg.merchantKey,
    cfg.merchantSalt,
  );
  if (!valid) {
    return new Response('PAYTR notification failed: gecersiz hash', { status: 400 });
  }

  try {
    await processPaytrCallback(
      {
        merchantOid,
        status: status === 'success' ? 'success' : 'failed',
        totalAmount,
        paymentType: params.get('payment_type') ?? undefined,
        failedReason: params.get('failed_reason_msg') ?? params.get('failed_reason_code') ?? undefined,
        card: { utoken: params.get('utoken') ?? undefined },
        rawPayload: Object.fromEntries(params.entries()),
      },
      {
        db,
        nilvera: isNilveraConfigured() ? { createInvoice: createNilveraInvoice } : undefined,
        now: () => new Date(),
      },
    );
    return new Response('OK', { status: 200 });
  } catch {
    // DB transaction hatası — non-OK dön, PayTR retry etsin (orchestrator rollback yaptı).
    return new Response('PAYTR notification failed: islenemedi', { status: 500 });
  }
}

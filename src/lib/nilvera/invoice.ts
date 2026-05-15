/**
 * Nilvera Invoice Operations
 *
 * e-Arşiv fatura oluşturma + status sorgu + iptal.
 * Sprint 14'te iyzico subscription webhook'undan tetiklenir (renewal_success → invoice create).
 *
 * Tüm fonksiyonlar:
 * 1. Input'u Zod ile validate
 * 2. nilveraRequest ile API çağrısı (Bearer auth + retry built-in)
 * 3. Response'u Zod ile parse
 */

import { nilveraRequest } from './client';
import {
  nilveraInvoiceCreateRequestSchema,
  nilveraInvoiceResponseSchema,
  type NilveraInvoiceCreateRequest,
  type NilveraInvoiceResponse,
} from './types';

/**
 * Yeni e-Arşiv fatura oluştur.
 *
 * @param input — externalRef (idempotency için bizim subscription/invoice ID), müşteri, lines
 * @returns Nilvera invoiceId + initial status (genelde PENDING/PROCESSING)
 *
 * Webhook ile asenkron olarak status güncellenir (PENDING → ACCEPTED veya REJECTED).
 *
 * externalRef idempotency: Nilvera tarafında aynı externalRef ile ikinci çağrı yapılırsa
 * yeni fatura yaratmaz — mevcut'u döner. Webhook replay'lerinde çift fatura olmaz.
 */
export async function createNilveraInvoice(
  input: NilveraInvoiceCreateRequest,
): Promise<NilveraInvoiceResponse> {
  const validated = nilveraInvoiceCreateRequestSchema.parse(input);

  const raw = await nilveraRequest<unknown>({
    method: 'POST',
    path: '/api/v1/invoices',
    body: validated,
  });

  return nilveraInvoiceResponseSchema.parse(raw);
}

/**
 * Mevcut faturanın status'unu sorgula.
 *
 * Webhook bekleyemediğimiz veya geç gelmesi durumunda manuel reconciliation için.
 * Süperadmin paneli "Fatura durumu yeniden çek" butonundan da çağrılabilir.
 */
export async function retrieveNilveraInvoice(
  invoiceId: string,
): Promise<NilveraInvoiceResponse> {
  if (!invoiceId) {
    throw new Error('invoiceId zorunlu');
  }

  const raw = await nilveraRequest<unknown>({
    method: 'GET',
    path: `/api/v1/invoices/${encodeURIComponent(invoiceId)}`,
  });

  return nilveraInvoiceResponseSchema.parse(raw);
}

/**
 * e-Arşiv fatura iptali.
 *
 * Nilvera + GİB tarafında iptal işlemi başlatır. ACCEPTED status'taki bir faturanın
 * iptalini 3 gün içinde yapılabilir (TR yasal şart).
 *
 * Hatalı kesilen fatura için: iptal et + yenisini doğru içerikle kes.
 */
export async function cancelNilveraInvoice(
  invoiceId: string,
  reason?: string,
): Promise<NilveraInvoiceResponse> {
  if (!invoiceId) {
    throw new Error('invoiceId zorunlu');
  }

  const raw = await nilveraRequest<unknown>({
    method: 'POST',
    path: `/api/v1/invoices/${encodeURIComponent(invoiceId)}/cancel`,
    body: { reason: reason ?? 'Manual cancellation' },
  });

  return nilveraInvoiceResponseSchema.parse(raw);
}

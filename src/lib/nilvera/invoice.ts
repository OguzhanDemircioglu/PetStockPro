/**
 * Nilvera e-Arşiv Invoice Operations
 *
 * Gerçek Nilvera e-Arşiv API'sine karşı (apitest/api.nilvera.com/earchive):
 *   - createNilveraInvoice → POST /earchive/Send/Model   (fatura kes)
 *   - retrieveNilveraInvoice → GET /earchive/Invoices/{UUID}/Status
 *   - cancelNilveraInvoice → PUT /earchive/Invoices/{UUID}/Cancel
 *
 * PayTR ödeme callback'inden (orchestrator) başarılı ödeme → fatura kesilir.
 *
 * Yüksek seviye girdi ({ customer, lines, ... }) Nilvera ArchiveInvoice modeline
 * (InvoiceInfo + CompanyInfo + CustomerInfo + InvoiceLines) burada çevrilir.
 * Satıcı (CompanyInfo) Nilvera tarafında API anahtarının ait olduğu firmadan
 * otomatik gelir — gövdede göndermeye gerek yok.
 *
 * Docs: https://developer.nilvera.com/api/e-arsiv-api/e-fatura-goenderme/faturayi-model-olarak-gonderir
 */

import crypto from 'node:crypto';
import { nilveraRequest } from './client';
import { getNilveraConfig } from './config';
import {
  nilveraInvoiceCreateRequestSchema,
  nilveraSendResponseSchema,
  nilveraStatusResponseSchema,
  type NilveraInvoiceCreateRequest,
  type NilveraInvoiceResult,
  type NilveraStatusResponse,
} from './types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GİB UN/ECE Rec 20 birim kodu — "adet/one". */
const UNIT_TYPE = 'C62';
/** GİB vergi tip kodu — Hesaplanan KDV. */
const KDV_TAX_CODE = '0015';

/** KDV oranı → ArchiveInvoiceInfo'daki toplam alanı. */
const KDV_TOTAL_FIELD: Record<number, string> = {
  1: 'GeneralKDV1Total',
  8: 'GeneralKDV8Total',
  10: 'GeneralKDV10Total',
  18: 'GeneralKDV18Total',
  20: 'GeneralKDV20Total',
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * e-Arşiv CustomerInfo Address/District/City alanları GİB tarafında zorunlu (boş
 * olamaz). Firma profili eksikse (ör. onboarding'de konum girilmemiş) Nilvera 400
 * verir — bu yüzden boş/eksik/"—" değerler nötr placeholder'a çevrilir.
 */
function orPlaceholder(v: string | undefined): string {
  const t = (v ?? '').trim();
  return t && t !== '—' ? t : 'Belirtilmemiş';
}

/**
 * Yeni e-Arşiv fatura oluştur (POST /earchive/Send/Model).
 *
 * @param input — externalRef (bizim invoice.id; UUID ise Nilvera ETTN olarak kullanılır
 *   → idempotent retry), müşteri, kalemler, seri.
 * @returns Nilvera ETTN UUID + resmi fatura numarası.
 *
 * Seri: input.series ?? NILVERA_SERIE env. Yoksa hata (firmaya tanımlı 3-karakter seri şart).
 */
export async function createNilveraInvoice(
  input: NilveraInvoiceCreateRequest,
): Promise<NilveraInvoiceResult> {
  const validated = nilveraInvoiceCreateRequestSchema.parse(input);

  const series = validated.series ?? getNilveraConfig().NILVERA_SERIE;
  if (!series) {
    throw new Error(
      'Nilvera fatura serisi yok — input.series veya NILVERA_SERIE env gerekli (firmaya tanımlı 3-karakter seri).',
    );
  }

  // externalRef (invoice.id) zaten UUID ise ETTN olarak kullan → retry'da aynı UUID
  // (Nilvera 409 "daha önce gönderildi" ile çift fatura engellenir). Değilse üret.
  const uuid = UUID_RE.test(validated.externalRef) ? validated.externalRef : crypto.randomUUID();

  // Kalemler + KDV oranı bazında toplamlar
  const invoiceLines = validated.lines.map((l, i) => {
    const net = round2(l.unitPrice * l.quantity);
    const kdv = round2((net * l.vatRate) / 100);
    return {
      Index: String(i + 1),
      Name: l.name,
      Quantity: l.quantity,
      UnitType: UNIT_TYPE,
      Price: round2(l.unitPrice),
      KDVPercent: l.vatRate,
      KDVTotal: kdv,
      Taxes: [{ TaxCode: KDV_TAX_CODE, Total: kdv, Percent: l.vatRate }],
    };
  });

  const lineExtensionAmount = round2(invoiceLines.reduce((s, l) => s + l.Price * l.Quantity, 0));
  const kdvTotal = round2(invoiceLines.reduce((s, l) => s + l.KDVTotal, 0));
  const payableAmount = round2(lineExtensionAmount + kdvTotal);

  const kdvByRate: Record<string, number> = {};
  for (const l of invoiceLines) {
    const field = KDV_TOTAL_FIELD[l.KDVPercent];
    if (field) kdvByRate[field] = round2((kdvByRate[field] ?? 0) + l.KDVTotal);
  }

  const ArchiveInvoice = {
    InvoiceInfo: {
      UUID: uuid,
      InvoiceType: 'SATIS',
      InvoiceSerieOrNumber: series,
      IssueDate: validated.invoiceDate,
      CurrencyCode: validated.currency,
      SalesPlatform: 'NORMAL',
      SendType: 'ELEKTRONIK',
      LineExtensionAmount: lineExtensionAmount,
      KdvTotal: kdvTotal,
      PayableAmount: payableAmount,
      ...kdvByRate,
    },
    CustomerInfo: {
      TaxNumber: validated.customer.taxNumber,
      Name: validated.customer.title,
      Address: orPlaceholder(validated.customer.address),
      District: orPlaceholder(validated.customer.district),
      City: orPlaceholder(validated.customer.city),
      Country: validated.customer.country,
      ...(validated.customer.email ? { Mail: validated.customer.email } : {}),
      ...(validated.customer.phone ? { Phone: validated.customer.phone } : {}),
    },
    InvoiceLines: invoiceLines,
    ...(validated.notes && validated.notes.length > 0 ? { Notes: validated.notes } : {}),
  };

  const raw = await nilveraRequest<unknown>({
    method: 'POST',
    path: '/earchive/Send/Model',
    body: { ArchiveInvoice },
  });

  const resp = nilveraSendResponseSchema.parse(raw);
  return {
    invoiceId: resp.UUID,
    invoiceNumber: resp.InvoiceNumber ?? undefined,
    externalRef: validated.externalRef,
    pdfUrl: undefined, // Send/Model PDF dönmez; PDF ayrı endpoint'ten alınır (Faz 2)
  };
}

/**
 * Faturanın durum bilgisini sorgula (GET /earchive/Invoices/{UUID}/Status).
 *
 * Webhook bekleyemediğimiz veya geç gelmesi durumunda manuel reconciliation için.
 * StatusCode: unknown | waiting | succeed | error.
 */
export async function retrieveNilveraInvoice(
  uuid: string,
): Promise<NilveraStatusResponse> {
  if (!uuid) {
    throw new Error('uuid zorunlu');
  }

  const raw = await nilveraRequest<unknown>({
    method: 'GET',
    path: `/earchive/Invoices/${encodeURIComponent(uuid)}/Status`,
  });

  return nilveraStatusResponseSchema.parse(raw);
}

/**
 * e-Arşiv fatura iptali (PUT /earchive/Invoices/{UUID}/Cancel).
 *
 * Nilvera + GİB tarafında iptal işlemi başlatır. Gövde almaz.
 * Hatalı kesilen fatura için: iptal et + yenisini doğru içerikle kes.
 *
 * @returns Nilvera'nın döndüğü bilgi mesajları (string[]).
 */
export async function cancelNilveraInvoice(uuid: string): Promise<string[]> {
  if (!uuid) {
    throw new Error('uuid zorunlu');
  }

  const raw = await nilveraRequest<unknown>({
    method: 'PUT',
    path: `/earchive/Invoices/${encodeURIComponent(uuid)}/Cancel`,
  });

  return Array.isArray(raw) ? (raw as string[]) : [];
}

/**
 * Nilvera Fatura Operations — e-Arşiv + e-Fatura + nihai tüketici yönlendirme
 *
 * Gerçek Nilvera API'sine karşı (apitest/api.nilvera.com):
 *   - createNilveraInvoice  → POST /earchive/Send/Model     (e-Arşiv kes)
 *   - createEInvoice        → POST /einvoice/Send/Model      (e-Fatura kes — etikete/alias)
 *   - resolveAndIssueInvoice → mükellef sorgusuna göre yukarıdakilerden doğru olanı çağırır
 *   - retrieveNilveraInvoice → GET /earchive/Invoices/{UUID}/Status
 *   - cancelNilveraInvoice   → PUT /earchive/Invoices/{UUID}/Cancel
 *
 * Yönlendirme (kullanıcı kararı 2026-06-19 — bkz. [[project_nilvera_invoice_routing]]):
 *   - 10 hane VKN → checkTaxpayer → e-Fatura mükellefiyse e-Fatura, değilse e-Arşiv
 *   - 11 hane TCKN → e-Arşiv (şahıs/bireysel)
 *   - vergi no yok → e-Arşiv nihai tüketici (TaxNumber=11111111111, ad+adres yeterli)
 *
 * Satıcı (CompanyInfo) Nilvera tarafında API anahtarının ait olduğu firmadan otomatik
 * gelir — gövdede göndermeye gerek yok.
 *
 * Docs:
 *   https://developer.nilvera.com/api/e-arsiv-api/e-fatura-goenderme/faturayi-model-olarak-gonderir
 *   https://developer.nilvera.com/nilvera-model/einvoice/customeralias
 */

import crypto from 'node:crypto';
import { nilveraRequest } from './client';
import { getNilveraConfig } from './config';
import { checkTaxpayer, NIHAI_TUKETICI_TAX_NUMBER } from './lookup';
import {
  nilveraInvoiceCreateRequestSchema,
  nilveraSendResponseSchema,
  nilveraStatusResponseSchema,
  type NilveraInvoiceCreateRequest,
  type NilveraInvoiceLine,
  type NilveraInvoiceResult,
  type NilveraStatusResponse,
} from './types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GİB UN/ECE Rec 20 birim kodu — "adet/one". */
const UNIT_TYPE = 'C62';
/** GİB vergi tip kodu — Hesaplanan KDV. */
const KDV_TAX_CODE = '0015';

/** KDV oranı → InvoiceInfo'daki toplam alanı. */
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
 * CustomerInfo Address/District/City alanları GİB tarafında zorunlu (boş olamaz).
 * Firma profili eksikse (ör. konum girilmemiş) Nilvera 400 verir — bu yüzden
 * boş/eksik/"—" değerler nötr placeholder'a çevrilir.
 */
function orPlaceholder(v: string | undefined): string {
  const t = (v ?? '').trim();
  return t && t !== '—' ? t : 'Belirtilmemiş';
}

// ── Ortak model parçaları (e-Arşiv + e-Fatura paylaşır) ────────────────

interface BuiltInvoiceModel {
  InvoiceInfo: Record<string, unknown>;
  CustomerInfo: Record<string, unknown>;
  InvoiceLines: Array<Record<string, unknown>>;
  Notes?: string[];
}

/**
 * Yüksek seviye girdiyi (validate edilmiş) hem e-Arşiv hem e-Fatura için ortak
 * InvoiceInfo + CustomerInfo + InvoiceLines modeline çevirir. e-Arşiv'e özgü
 * (SalesPlatform/SendType) alanlar çağıran tarafından eklenir.
 */
function buildInvoiceModel(
  validated: NilveraInvoiceCreateRequest,
  series: string,
  uuid: string,
): BuiltInvoiceModel {
  const invoiceLines = validated.lines.map((l, i) => {
    const quantity = l.quantity ?? 1; // schema default(1) — parse sonrası dolu, tip güvenliği için
    const net = round2(l.unitPrice * quantity);
    const kdv = round2((net * l.vatRate) / 100);
    return {
      Index: String(i + 1),
      Name: l.name,
      Quantity: quantity,
      UnitType: UNIT_TYPE,
      Price: round2(l.unitPrice),
      KDVPercent: l.vatRate,
      KDVTotal: kdv,
      Taxes: [{ TaxCode: KDV_TAX_CODE, Total: kdv, Percent: l.vatRate }],
    };
  });

  const lineExtensionAmount = round2(
    invoiceLines.reduce((s, l) => s + l.Price * l.Quantity, 0),
  );
  const kdvTotal = round2(invoiceLines.reduce((s, l) => s + l.KDVTotal, 0));
  const payableAmount = round2(lineExtensionAmount + kdvTotal);

  const kdvByRate: Record<string, number> = {};
  for (const l of invoiceLines) {
    const field = KDV_TOTAL_FIELD[l.KDVPercent];
    if (field) kdvByRate[field] = round2((kdvByRate[field] ?? 0) + l.KDVTotal);
  }

  const InvoiceInfo: Record<string, unknown> = {
    UUID: uuid,
    InvoiceType: 'SATIS',
    InvoiceSerieOrNumber: series,
    IssueDate: validated.invoiceDate,
    CurrencyCode: validated.currency,
    LineExtensionAmount: lineExtensionAmount,
    KdvTotal: kdvTotal,
    PayableAmount: payableAmount,
    ...kdvByRate,
  };

  const CustomerInfo: Record<string, unknown> = {
    TaxNumber: validated.customer.taxNumber,
    Name: validated.customer.title,
    Address: orPlaceholder(validated.customer.address),
    District: orPlaceholder(validated.customer.district),
    City: orPlaceholder(validated.customer.city),
    Country: validated.customer.country,
    ...(validated.customer.email ? { Mail: validated.customer.email } : {}),
    ...(validated.customer.phone ? { Phone: validated.customer.phone } : {}),
  };

  return {
    InvoiceInfo,
    CustomerInfo,
    InvoiceLines: invoiceLines,
    ...(validated.notes && validated.notes.length > 0 ? { Notes: validated.notes } : {}),
  };
}

/** input.series ?? NILVERA_SERIE env. Yoksa hata. */
function resolveSeries(input: NilveraInvoiceCreateRequest): string {
  const series = input.series ?? getNilveraConfig().NILVERA_SERIE;
  if (!series) {
    throw new Error(
      'Nilvera fatura serisi yok — input.series veya NILVERA_SERIE env gerekli (firmaya tanımlı 3-karakter seri).',
    );
  }
  return series;
}

/** externalRef zaten UUID ise ETTN olarak kullan (idempotent retry), değilse üret. */
function resolveUuid(externalRef: string): string {
  return UUID_RE.test(externalRef) ? externalRef : crypto.randomUUID();
}

// ── e-Arşiv ────────────────────────────────────────────────────────────

/**
 * Yeni e-Arşiv fatura oluştur (POST /earchive/Send/Model).
 *
 * Nihai tüketici / e-Fatura mükellefi olmayan kurumsal / şahıs müşteriler için.
 * @returns Nilvera ETTN UUID + resmi fatura numarası.
 */
export async function createNilveraInvoice(
  input: NilveraInvoiceCreateRequest,
): Promise<NilveraInvoiceResult> {
  const validated = nilveraInvoiceCreateRequestSchema.parse(input);
  const series = resolveSeries(validated);
  const uuid = resolveUuid(validated.externalRef);

  const model = buildInvoiceModel(validated, series, uuid);

  const ArchiveInvoice = {
    InvoiceInfo: {
      ...model.InvoiceInfo,
      SalesPlatform: 'NORMAL',
      SendType: 'ELEKTRONIK',
    },
    CustomerInfo: model.CustomerInfo,
    InvoiceLines: model.InvoiceLines,
    ...(model.Notes ? { Notes: model.Notes } : {}),
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
    pdfUrl: undefined,
  };
}

// ── e-Fatura ───────────────────────────────────────────────────────────

/**
 * Yeni e-Fatura oluştur (POST /einvoice/Send/Model).
 *
 * Alıcı e-Fatura mükellefiyse kullanılır; fatura `customerAlias` etiketine gönderilir.
 * Gövde sarmalayıcısı e-Arşiv'den farklı: `{ EInvoice: {...}, CustomerAlias: "urn:mail:..." }`.
 *
 * @param input  yüksek seviye fatura girdisi (customer.taxNumber = 10 hane VKN)
 * @param customerAlias  GlobalCompany/Check'ten gelen e-Fatura etiketi (zorunlu)
 */
export async function createEInvoice(
  input: NilveraInvoiceCreateRequest,
  customerAlias: string,
): Promise<NilveraInvoiceResult> {
  if (!customerAlias) {
    throw new Error('e-Fatura için CustomerAlias (etiket) zorunlu.');
  }
  const validated = nilveraInvoiceCreateRequestSchema.parse(input);
  const series = resolveSeries(validated);
  const uuid = resolveUuid(validated.externalRef);

  const model = buildInvoiceModel(validated, series, uuid);

  const EInvoice = {
    InvoiceInfo: model.InvoiceInfo, // e-Fatura'da SalesPlatform/SendType yok
    CustomerInfo: model.CustomerInfo,
    InvoiceLines: model.InvoiceLines,
    ...(model.Notes ? { Notes: model.Notes } : {}),
  };

  const raw = await nilveraRequest<unknown>({
    method: 'POST',
    path: '/einvoice/Send/Model',
    body: { EInvoice, CustomerAlias: customerAlias },
  });

  const resp = nilveraSendResponseSchema.parse(raw);
  return {
    invoiceId: resp.UUID,
    invoiceNumber: resp.InvoiceNumber ?? undefined,
    externalRef: validated.externalRef,
    pdfUrl: undefined,
  };
}

// ── Yönlendirme (router) ───────────────────────────────────────────────

/** Müşteri vergi no opsiyonel — boş ise nihai tüketici e-Arşiv. */
export interface IssueInvoiceInput {
  externalRef: string;
  invoiceDate: string;
  series?: string;
  customer: {
    /** 10 hane VKN / 11 hane TCKN; boş/null → nihai tüketici. */
    taxNumber?: string | null;
    title: string;
    address?: string;
    district?: string;
    city?: string;
    country?: string;
    email?: string;
    phone?: string;
  };
  lines: NilveraInvoiceLine[];
  currency?: 'TRY' | 'USD' | 'EUR' | 'GBP';
  notes?: string[];
}

export interface IssueInvoiceResult extends NilveraInvoiceResult {
  /** Kesilen fatura tipi (invoices.invoice_kind'e yazılır). */
  kind: 'efatura' | 'earsiv';
  /** e-Fatura'da gönderilen etiket. */
  alias?: string;
}

export interface IssueInvoiceDeps {
  /** Test/override için mükellef sorgu enjeksiyonu. Default: checkTaxpayer (lookup.ts). */
  checkTaxpayer?: typeof checkTaxpayer;
}

/**
 * Müşteri vergi numarasına göre doğru fatura tipini çözüp keser.
 *
 *   - taxNumber boş → e-Arşiv nihai tüketici (TaxNumber=11111111111)
 *   - taxNumber dolu → checkTaxpayer:
 *       efatura → createEInvoice (etikete)
 *       earsiv  → createNilveraInvoice (e-Arşiv, gerçek VKN/TCKN)
 *       invalid → throw (fatura kesilmez, caller pending bırakır)
 *
 * Orchestrator + invoice-reconcile bunu çağırır.
 */
export async function resolveAndIssueInvoice(
  input: IssueInvoiceInput,
  deps: IssueInvoiceDeps = {},
): Promise<IssueInvoiceResult> {
  const check = deps.checkTaxpayer ?? checkTaxpayer;
  const tax = (input.customer.taxNumber ?? '').replace(/\D/g, '');

  // Vergi no yok → nihai tüketici e-Arşiv (ad + adres yeterli)
  if (!tax) {
    const res = await createNilveraInvoice(toCreateRequest(input, NIHAI_TUKETICI_TAX_NUMBER));
    return { ...res, kind: 'earsiv' };
  }

  const result = await check(tax);

  if (result.kind === 'invalid') {
    throw new Error(`Geçersiz müşteri VKN/TCKN (${tax}) — fatura kesilemedi`);
  }

  if (result.kind === 'efatura') {
    if (!result.alias) {
      throw new Error(`e-Fatura mükellefi ama e-Fatura etiketi (alias) bulunamadı (${tax})`);
    }
    const res = await createEInvoice(toCreateRequest(input, tax), result.alias);
    return { ...res, kind: 'efatura', alias: result.alias };
  }

  // earsiv — e-Fatura mükellefi olmayan kurumsal/şahıs
  const res = await createNilveraInvoice(toCreateRequest(input, tax));
  return { ...res, kind: 'earsiv' };
}

/** IssueInvoiceInput → NilveraInvoiceCreateRequest (taxNumber set edilmiş). */
function toCreateRequest(
  input: IssueInvoiceInput,
  taxNumber: string,
): NilveraInvoiceCreateRequest {
  return {
    externalRef: input.externalRef,
    invoiceDate: input.invoiceDate,
    series: input.series,
    customer: {
      taxNumber,
      title: input.customer.title,
      address: input.customer.address,
      district: input.customer.district,
      city: input.customer.city,
      country: input.customer.country,
      email: input.customer.email,
      phone: input.customer.phone,
    },
    lines: input.lines,
    currency: input.currency,
    notes: input.notes,
  };
}

// ── Durum sorgu + iptal (e-Arşiv) ──────────────────────────────────────

/**
 * Faturanın durum bilgisini sorgula (GET /earchive/Invoices/{UUID}/Status).
 * StatusCode: unknown | waiting | succeed | error.
 */
export async function retrieveNilveraInvoice(uuid: string): Promise<NilveraStatusResponse> {
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
 * Hatalı kesilen fatura için: iptal et + yenisini doğru içerikle kes.
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

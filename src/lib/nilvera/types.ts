/**
 * Nilvera Type Definitions (Zod schemas)
 *
 * Nilvera REST API request/response şemaları.
 * Resmi SDK olmadığı için HTTP client + Zod runtime validation pattern.
 *
 * Nilvera docs: https://api-docs.nilvera.com (gerçek endpoint adları lansman öncesi sandbox key alınınca confirm edilir)
 */

import { z } from 'zod';

// ══════════════════════════════════════════════════════════════
// Common
// ══════════════════════════════════════════════════════════════

export const nilveraCurrencySchema = z.enum(['TRY', 'USD', 'EUR', 'GBP']);

// e-Arşiv fatura status (Nilvera lifecycle)
export const nilveraInvoiceStatusSchema = z.enum([
  'PENDING',     // henüz GİB'e gönderilmedi
  'PROCESSING',  // GİB'e iletildi, onay bekleniyor
  'ACCEPTED',    // GİB onayladı, fatura geçerli
  'REJECTED',    // GİB reddetti — düzeltilmeli
  'CANCELLED',   // iptal edildi
  'FAILED',      // sistem hatası
]);

export type NilveraInvoiceStatus = z.infer<typeof nilveraInvoiceStatusSchema>;

// ══════════════════════════════════════════════════════════════
// Invoice Line Item
// ══════════════════════════════════════════════════════════════

export const nilveraInvoiceLineSchema = z.object({
  name: z.string().min(1).max(500),                  // ürün/hizmet adı (örn "PetStockPro PRO plan - 1 ay")
  quantity: z.number().positive().default(1),
  unitPrice: z.number().nonnegative(),                // KDV hariç birim fiyat (matrah)
  vatRate: z.number().int().nonnegative(),            // %20 / %10 / %8 / %1 / %0
});

// ══════════════════════════════════════════════════════════════
// Customer (alıcı = pet shop, PetStockPro'nun müşterisi)
// ══════════════════════════════════════════════════════════════

export const nilveraCustomerSchema = z.object({
  taxNumber: z.string().min(10).max(11),  // VKN (10) veya TC (11)
  title: z.string().min(1).max(500),       // şirket adı veya kişi adı
  address: z.string().max(1000).optional(),
  district: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).default('Türkiye'),
  email: z.string().email().optional(),    // e-fatura yerine e-arşiv için opsiyonel
  phone: z.string().optional(),
});

// ══════════════════════════════════════════════════════════════
// Invoice Create Request (yüksek seviye — orchestrator bunu geçer;
// invoice.ts gerçek Nilvera ArchiveInvoice modeline çevirir)
// ══════════════════════════════════════════════════════════════

export const nilveraInvoiceCreateRequestSchema = z.object({
  // Bizim invoice.id — idempotency + Nilvera UUID (ETTN) kaynağı.
  externalRef: z.string().min(1).max(100),

  // Fatura tarihi (ISO 8601)
  invoiceDate: z.string(),

  // e-Arşiv serisi (InvoiceSerieOrNumber). Yoksa NILVERA_SERIE env kullanılır.
  series: z.string().min(1).max(10).optional(),

  // Müşteri (faturaya alıcı taraf yazılacak pet shop bilgileri)
  customer: nilveraCustomerSchema,

  // Ürün/hizmet kalemleri
  lines: z.array(nilveraInvoiceLineSchema).min(1),

  // Para birimi (default TRY)
  currency: nilveraCurrencySchema.default('TRY'),

  // Notes (opsiyonel açıklama satırları)
  notes: z.array(z.string()).optional(),
});

// ══════════════════════════════════════════════════════════════
// Nilvera e-Arşiv Send/Model ham yanıtı (POST /earchive/Send/Model)
// ══════════════════════════════════════════════════════════════

export const nilveraSendResponseSchema = z.object({
  UUID: z.string(),                  // Nilvera ETTN UUID
  InvoiceNumber: z.string().nullish(), // Resmi fatura no (ör. "ABC2026000147")
});

// ══════════════════════════════════════════════════════════════
// Nilvera e-Arşiv durum yanıtı (GET /earchive/Invoices/{UUID}/Status)
// ══════════════════════════════════════════════════════════════

export const nilveraStatusCodeSchema = z.enum(['unknown', 'waiting', 'succeed', 'error']);

export const nilveraStatusResponseSchema = z
  .object({
    StatusDetail: z.string().nullish(),
    StatusCode: nilveraStatusCodeSchema,
    ReportStatus: z.enum(['NotReported', 'Reported']).nullish(),
    CancelStatus: z.boolean().optional(),
  })
  .passthrough();

// ══════════════════════════════════════════════════════════════
// App-facing fatura sonucu (orchestrator + invoice.ts kullanır)
// ══════════════════════════════════════════════════════════════

export interface NilveraInvoiceResult {
  invoiceId: string;       // Nilvera ETTN UUID
  invoiceNumber?: string;  // Resmi fatura no (ör. ABC2026000147)
  externalRef: string;     // bizim referans (echo)
  pdfUrl?: string;         // Send/Model PDF dönmez; ayrı PDF endpoint'inden alınır
}

// ══════════════════════════════════════════════════════════════
// Webhook Event
// ══════════════════════════════════════════════════════════════

/**
 * Nilvera webhook event tipleri.
 * https://docs.nilvera.com/webhooks (örnek — gerçek endpoint sandbox key alınınca confirm edilecek)
 */
export const nilveraWebhookEventTypeSchema = z.enum([
  'invoice.created',     // fatura oluşturuldu (henüz GİB'e gitmemiş)
  'invoice.accepted',    // GİB onayladı
  'invoice.rejected',    // GİB reddetti
  'invoice.cancelled',   // iptal edildi
  'invoice.failed',      // sistem hatası
]);

export type NilveraWebhookEventType = z.infer<typeof nilveraWebhookEventTypeSchema>;

export const nilveraWebhookPayloadSchema = z.object({
  eventType: nilveraWebhookEventTypeSchema,
  eventTime: z.number(),               // Unix timestamp ms
  invoiceId: z.string(),
  externalRef: z.string(),             // bizim referans (subscription_id veya invoice_id eşleştirme)
  status: nilveraInvoiceStatusSchema,
  invoiceNumber: z.string().optional(),
  pdfUrl: z.string().url().optional(),
  rejectionReason: z.string().optional(), // status=REJECTED'da
}).passthrough();

// ══════════════════════════════════════════════════════════════
// Type aliases
// ══════════════════════════════════════════════════════════════

export type NilveraInvoiceLine = z.input<typeof nilveraInvoiceLineSchema>;
export type NilveraCustomer = z.input<typeof nilveraCustomerSchema>;
export type NilveraInvoiceCreateRequest = z.input<typeof nilveraInvoiceCreateRequestSchema>;
export type NilveraSendResponse = z.infer<typeof nilveraSendResponseSchema>;
export type NilveraStatusResponse = z.infer<typeof nilveraStatusResponseSchema>;
export type NilveraWebhookPayload = z.infer<typeof nilveraWebhookPayloadSchema>;

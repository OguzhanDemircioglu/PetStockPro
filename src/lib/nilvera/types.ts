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
  unitPrice: z.number().nonnegative(),                // KDV hariç birim fiyat
  vatRate: z.number().int().nonnegative(),            // %20 / %10 / %8 / %0
  // Hesaplama field'ları (server-side hesaplanır ama caller verebilir):
  totalWithoutVat: z.number().nonnegative().optional(),
  vatAmount: z.number().nonnegative().optional(),
  totalWithVat: z.number().nonnegative().optional(),
});

// ══════════════════════════════════════════════════════════════
// Customer (alıcı = pet shop, PetStockPro'nun müşterisi)
// ══════════════════════════════════════════════════════════════

export const nilveraCustomerSchema = z.object({
  taxNumber: z.string().min(10).max(11),  // VKN (10) veya TC (11)
  title: z.string().min(1).max(500),       // şirket adı veya kişi adı
  address: z.string().min(1).max(1000),
  city: z.string().min(1).max(100),
  country: z.string().default('Türkiye'),
  email: z.string().email().optional(),    // e-fatura yerine e-arşiv için opsiyonel
  phone: z.string().optional(),
});

// ══════════════════════════════════════════════════════════════
// Invoice Create Request
// ══════════════════════════════════════════════════════════════

export const nilveraInvoiceCreateRequestSchema = z.object({
  // Bizim tarafımızdan üretilen unique fatura referansı (idempotency için)
  externalRef: z.string().min(1).max(100),

  // Fatura tarihi (ISO 8601)
  invoiceDate: z.string(),

  // Müşteri (faturaya alıcı taraf yazılacak pet shop bilgileri)
  customer: nilveraCustomerSchema,

  // Ürün/hizmet kalemleri
  lines: z.array(nilveraInvoiceLineSchema).min(1),

  // Para birimi (default TRY)
  currency: nilveraCurrencySchema.default('TRY'),

  // Notes (opsiyonel açıklama)
  notes: z.string().max(2000).optional(),
});

// ══════════════════════════════════════════════════════════════
// Invoice Response (Nilvera'dan dönen)
// ══════════════════════════════════════════════════════════════

export const nilveraInvoiceResponseSchema = z.object({
  invoiceId: z.string(),                  // Nilvera UUID
  invoiceNumber: z.string().optional(),   // Resmi fatura no (örn "PSP2026000147") — GİB onayından sonra
  externalRef: z.string(),                // bizim gönderdiğimiz referans (echo)
  status: nilveraInvoiceStatusSchema,
  pdfUrl: z.string().url().optional(),    // PDF indirme URL (Nilvera tarafında)
  xmlUrl: z.string().url().optional(),    // XML UBL (e-Arşiv format)
  createdAt: z.string(),
  issuedAt: z.string().optional(),        // GİB onay zamanı
  totalAmount: z.number().nonnegative(),
  vatTotal: z.number().nonnegative(),
});

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
export type NilveraInvoiceResponse = z.infer<typeof nilveraInvoiceResponseSchema>;
export type NilveraWebhookPayload = z.infer<typeof nilveraWebhookPayloadSchema>;

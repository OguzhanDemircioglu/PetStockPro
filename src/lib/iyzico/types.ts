/**
 * iyzico Type Definitions (Zod schemas)
 *
 * iyzipay paketinin tip eksikliğini Zod ile dolduruyoruz. Tüm request/response
 * şemaları burada — type-safe + runtime validation + auto-inference.
 *
 * Sprint 13 boyunca subscription/customer/webhook için gerekli olanlar.
 * iyzico API docs: https://dev.iyzipay.com/en/products/subscription
 */

import { z } from 'zod';

// ══════════════════════════════════════════════════════════════
// Subscription Status — iyzico tarafındaki state machine
// ══════════════════════════════════════════════════════════════

/**
 * iyzico subscription status'ları (sistemin döndürdüğü değerler).
 * Bizim petstockpro.subscription_status ile mapping:
 *   ACTIVE → 'active'
 *   PENDING → 'active' (henüz ilk ödeme yapılmadı ama subscription oluştu)
 *   UNPAID → 'past_due'
 *   UPGRADED → 'active' (plan değişti)
 *   CANCELED → 'cancelled'
 *   EXPIRED → 'expired'
 */
export const iyzicoSubscriptionStatusSchema = z.enum([
  'ACTIVE',
  'PENDING',
  'UNPAID',
  'UPGRADED',
  'CANCELED',
  'EXPIRED',
]);

export type IyzicoSubscriptionStatus = z.infer<typeof iyzicoSubscriptionStatusSchema>;

// ══════════════════════════════════════════════════════════════
// Locale + Currency
// ══════════════════════════════════════════════════════════════

export const iyzicoLocaleSchema = z.enum(['tr', 'en']);
export const iyzicoCurrencySchema = z.enum(['TRY', 'USD', 'EUR', 'GBP', 'NOK']);

// ══════════════════════════════════════════════════════════════
// Common response envelope (tüm iyzico response'ları için)
// ══════════════════════════════════════════════════════════════

export const iyzicoResponseStatusSchema = z.enum(['success', 'failure']);

export const iyzicoBaseResponseSchema = z.object({
  status: iyzicoResponseStatusSchema,
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  errorGroup: z.string().optional(),
  locale: iyzicoLocaleSchema.optional(),
  systemTime: z.number().optional(),
  conversationId: z.string().optional(),
});

// ══════════════════════════════════════════════════════════════
// Customer
// ══════════════════════════════════════════════════════════════

export const iyzicoAddressSchema = z.object({
  contactName: z.string().min(1).max(100),
  city: z.string().min(1).max(100),
  country: z.string().default('Turkey'),
  address: z.string().min(1).max(500),
  zipCode: z.string().min(1).max(20).optional(),
});

export const iyzicoCustomerCreateRequestSchema = z.object({
  locale: iyzicoLocaleSchema.default('tr'),
  conversationId: z.string().max(64).optional(),
  name: z.string().min(1).max(100),
  surname: z.string().min(1).max(100),
  identityNumber: z.string().min(10).max(11), // TC 11 veya VKN 10
  email: z.string().email(),
  gsmNumber: z.string().min(10).max(20), // +905XXXXXXXXX
  billingAddress: iyzicoAddressSchema,
  shippingAddress: iyzicoAddressSchema.optional(),
});

export const iyzicoCustomerResponseSchema = iyzicoBaseResponseSchema.extend({
  referenceCode: z.string().optional(), // başarılı ise iyzico'nun atadığı customer ref
  email: z.string().optional(),
});

// ══════════════════════════════════════════════════════════════
// Subscription Create
// ══════════════════════════════════════════════════════════════

export const iyzicoSubscriptionCreateRequestSchema = z.object({
  locale: iyzicoLocaleSchema.default('tr'),
  conversationId: z.string().max(64).optional(),
  pricingPlanReferenceCode: z.string(),         // PetStockPro PRO/PRO+ plan ref
  subscriptionInitialStatus: z.enum(['ACTIVE', 'PENDING']).default('ACTIVE'),
  customer: iyzicoCustomerCreateRequestSchema.optional(), // yeni customer oluşturuyorsa
  customerReferenceCode: z.string().optional(),           // mevcut customer
  paymentCard: z.object({
    cardHolderName: z.string(),
    cardNumber: z.string(),
    expireMonth: z.string(),
    expireYear: z.string(),
    cvc: z.string(),
    registerConsumerCard: z.boolean().default(true), // sonraki ödemeler için tokenize
  }),
});

export const iyzicoSubscriptionResponseSchema = iyzicoBaseResponseSchema.extend({
  referenceCode: z.string().optional(),                // iyzico subscription ref
  parentReferenceCode: z.string().optional(),
  pricingPlanReferenceCode: z.string().optional(),
  customerReferenceCode: z.string().optional(),
  subscriptionStatus: iyzicoSubscriptionStatusSchema.optional(),
  trialStartDate: z.string().optional(),
  trialEndDate: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  createdDate: z.string().optional(),
});

// ══════════════════════════════════════════════════════════════
// Subscription Cancel
// ══════════════════════════════════════════════════════════════

export const iyzicoSubscriptionCancelRequestSchema = z.object({
  locale: iyzicoLocaleSchema.default('tr'),
  conversationId: z.string().max(64).optional(),
  subscriptionReferenceCode: z.string(),
});

// ══════════════════════════════════════════════════════════════
// Webhook Events
// ══════════════════════════════════════════════════════════════

/**
 * iyzico subscription event tipleri (webhook payload eventType).
 * https://dev.iyzipay.com/en/products/subscription/webhooks
 */
export const iyzicoWebhookEventTypeSchema = z.enum([
  'SUBSCRIPTION_ORDER_SUCCESS',   // ilk ödeme başarılı
  'SUBSCRIPTION_RENEWAL_SUCCESS', // yenileme başarılı
  'SUBSCRIPTION_RENEWAL_FAILURE', // yenileme başarısız → past_due'ya geç
  'SUBSCRIPTION_UPGRADED',        // plan değişti
  'SUBSCRIPTION_CANCELED',        // iptal edildi
  'SUBSCRIPTION_EXPIRED',         // dönem bitti
]);

export type IyzicoWebhookEventType = z.infer<typeof iyzicoWebhookEventTypeSchema>;

/**
 * Webhook payload — iyzico'dan POST /api/webhooks/iyzico ile gelir.
 * Signature: X-IYZ-SIGNATURE header (HMAC-SHA256 base64).
 */
export const iyzicoWebhookPayloadSchema = z.object({
  eventType: iyzicoWebhookEventTypeSchema,
  eventTime: z.number(),               // Unix timestamp (ms)
  iyziEventType: z.string().optional(), // legacy field
  subscriptionReferenceCode: z.string(),
  customerReferenceCode: z.string().optional(),
  pricingPlanReferenceCode: z.string().optional(),
  paymentId: z.string().optional(),     // başarılı ödemelerde
  // iyzico'nun döndürdüğü ek field'lar — strict olmamak için passthrough
}).passthrough();

export type IyzicoWebhookPayload = z.infer<typeof iyzicoWebhookPayloadSchema>;

// ══════════════════════════════════════════════════════════════
// Type aliases (re-export için)
// ══════════════════════════════════════════════════════════════

// Request type'ları için z.input kullan — Zod `.default()` değerleri caller'a optional görünür.
// Function içinde `.parse(input)` çağrılınca default'lar doldurulur, output her zaman required.
export type IyzicoCustomerCreateRequest = z.input<typeof iyzicoCustomerCreateRequestSchema>;
export type IyzicoSubscriptionCreateRequest = z.input<typeof iyzicoSubscriptionCreateRequestSchema>;
export type IyzicoSubscriptionCancelRequest = z.input<typeof iyzicoSubscriptionCancelRequestSchema>;

// Response type'ları için z.infer — iyzico'dan dönen tüm field'lar required (Zod parse sonrası)
export type IyzicoCustomerResponse = z.infer<typeof iyzicoCustomerResponseSchema>;
export type IyzicoSubscriptionResponse = z.infer<typeof iyzicoSubscriptionResponseSchema>;

/**
 * PetStockPro — Drizzle Schema (petstockpro schema, Supabase)
 *
 * Sprint 0: temel iskelet — cities, districts, companies, branches, users
 * Sprint 1A: subscriptions, invoices, processed_webhooks, audit_logs (payment + audit foundation)
 * Sprint 1B+: products, variants, stok hareketleri, sayım, vitrin, ...
 *
 * Otoritatif: docs/DATABASE-SCHEMA.md (36 tablo MVP)
 */

import {
  pgSchema,
  uuid,
  text,
  varchar,
  integer,
  timestamp,
  boolean,
  decimal,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const petstockproSchema = pgSchema('petstockpro');

// ═══════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════

export const planEnum = petstockproSchema.enum('plan', ['FREE', 'PRO', 'PRO_PLUS']);

export const userRoleEnum = petstockproSchema.enum('user_role', [
  'SUPERADMIN',
  'BAYI_SAHIBI',
  'SUBE_MUDURU',
  'STAFF',
  'BAYI_ADMIN', // Faz 3 — multi-tenant viewer
]);

export const userInviteMethodEnum = petstockproSchema.enum('user_invite_method', ['email', 'link']);

export const storefrontStatusEnum = petstockproSchema.enum('storefront_status', [
  'disabled',
  'pending',
  'approved',
  'rejected',
  'auto_suspended',
]);

// Sprint 1A — Subscription state machine (PAYMENT-INTEGRATION §5.3)
export const subscriptionStatusEnum = petstockproSchema.enum('subscription_status', [
  'active',     // ödeme aktif, dönem içinde
  'past_due',   // ödeme başarısız, 3-7 gün retry (iyzico)
  'suspended',  // past_due 7 gün geçti, askıda — ödeme yapınca active'e döner
  'cancelled',  // tenant iptal etti, dönem sonuna kadar aktif
  'expired',    // dönem bitti, FREE'ye düştü
  'trialing',   // deneme süresi (Faz 2 — şu an kullanılmıyor)
]);

// Sprint 1A — Invoice lifecycle (Nilvera e-Arşiv)
export const invoiceStatusEnum = petstockproSchema.enum('invoice_status', [
  'pending',    // henüz Nilvera'ya gönderilmedi
  'issued',     // Nilvera'da kesildi (GİB'e iletildi)
  'delivered',  // tenant'a e-posta ile iletildi
  'cancelled',  // iptal edildi (3 gün içinde)
  'failed',     // Nilvera/GİB ret — manuel müdahale gerekli
]);

// Sprint 1A — Süperadmin override audit kategorisi
export const superadminActionTypeEnum = petstockproSchema.enum('superadmin_action_type', [
  'impersonation', // tenant'a giriş
  'bypass',        // sistem kuralı bypass (24h, hard delete, plan limit)
  'dbfix',         // DB Inspector ile veri düzeltme
  'system',        // sistem config değişikliği
  'user',          // uzak kullanıcı yönetimi (şifre/2FA/oturum/kilit)
]);

// ═══════════════════════════════════════════════════════════════
// TABLES — Sprint 0 iskelet
// ═══════════════════════════════════════════════════════════════

// 81 il — Sprint 1B'de seed (Pet/'ten dönüşüm)
export const cities = petstockproSchema.table('cities', {
  id: integer('id').primaryKey(), // plaka kodu (1-81)
  name: text('name').notNull(),
  slug: varchar('slug', { length: 50 }).notNull().unique(),
});

// ~970 ilçe — Sprint 1B'de seed
export const districts = petstockproSchema.table('districts', {
  id: uuid('id').defaultRandom().primaryKey(),
  cityId: integer('city_id').notNull().references(() => cities.id),
  name: text('name').notNull(),
  slug: varchar('slug', { length: 50 }).notNull(),
}, (t) => [
  index('idx_districts_city').on(t.cityId),
]);

// Pet shop sahipleri (tenant)
export const companies = petstockproSchema.table('companies', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  plan: planEnum('plan').notNull().default('FREE'),
  vatNo: varchar('vat_no', { length: 11 }), // 10 (VKN) veya 11 (TC) — opsiyonel
  vatRequiredAt: timestamp('vat_required_at', { withTimezone: true }),
  whatsappPhone: varchar('whatsapp_phone', { length: 20 }),
  cityId: integer('city_id').references(() => cities.id),
  districtId: uuid('district_id').references(() => districts.id),
  storefrontStatus: storefrontStatusEnum('storefront_status').notNull().default('disabled'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Pet shop personeli (multi-role)
export const users = petstockproSchema.table('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').references(() => companies.id),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash'),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  name: text('name'),
  role: userRoleEnum('role').notNull().default('STAFF'),
  inviteMethod: userInviteMethodEnum('invite_method'),
  invitedById: uuid('invited_by_id'),
  twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  failedLoginCount: integer('failed_login_count').notNull().default(0),
  // KVKK consents (Sprint 2.2'de aktif)
  kvkkConsentedAt: timestamp('kvkk_consented_at', { withTimezone: true }),
  dataLocationConsentedAt: timestamp('data_location_consented_at', { withTimezone: true }),
  onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
  // Email verification (Sprint 2.3 — EKRAN-AUTH §4)
  emailVerificationToken: varchar('email_verification_token', { length: 100 }),
  emailVerificationExpiresAt: timestamp('email_verification_expires_at', { withTimezone: true }),
  emailVerificationResendCount: integer('email_verification_resend_count').notNull().default(0),
  emailVerificationLastSentAt: timestamp('email_verification_last_sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_users_company').on(t.companyId),
  index('idx_users_verification_token').on(t.emailVerificationToken),
]);

// Şubeler (multi-location)
export const branches = petstockproSchema.table('branches', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id),
  name: text('name').notNull(),
  cityId: integer('city_id').references(() => cities.id),
  districtId: uuid('district_id').references(() => districts.id),
  address: text('address'),
  lat: text('lat'),
  lng: text('lng'),
  whatsappPhone: varchar('whatsapp_phone', { length: 20 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_branches_company').on(t.companyId),
]);

// ═══════════════════════════════════════════════════════════════
// TABLES — Sprint 1A (Payment + Audit Foundation)
// ═══════════════════════════════════════════════════════════════
// Otoritatif: DATABASE-SCHEMA.md §3.5 (audit_logs), §3.10 (subscriptions+invoices+processed_webhooks)
// PAYMENT-INTEGRATION.md §5 (subscription state machine)

/**
 * SUBSCRIPTIONS — iyzico abonelik kayıtları
 *
 * FREE plan için subscription kaydı YOK (subscription = aktif para akışı).
 * PRO 750₺ + PRO+ 1750₺ aboneleri için iyzico subscription ref'i tutulur.
 *
 * Tek aktif abonelik per tenant (partial unique index: status='active' satırlarda).
 * Cancelled/expired kayıtlar geçmiş için saklanır (KVKK 5 yıl, vergi 10 yıl).
 *
 * RLS: tenant kendi abonelik kaydını SELECT eder, INSERT/UPDATE backend (service_role).
 */
export const subscriptions = petstockproSchema.table('subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  plan: planEnum('plan').notNull(), // PRO veya PRO_PLUS (FREE için kayıt yok)
  status: subscriptionStatusEnum('status').notNull().default('active'),

  // iyzico referansları (TR-only)
  iyzicoSubscriptionRef: varchar('iyzico_subscription_ref', { length: 100 }).unique(),
  iyzicoCustomerRef: varchar('iyzico_customer_ref', { length: 100 }),

  // Ödeme döngüsü
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).notNull(),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),

  // Fiyat snapshot — lifetime guarantee + audit için (fiyat değişimi olursa eski tenant korunur)
  amountTry: decimal('amount_try', { precision: 10, scale: 2 }).notNull(), // KDV dahil

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_subscriptions_company_status').on(t.companyId, t.status),
  // Tek aktif abonelik per tenant — partial unique index
  uniqueIndex('one_active_subscription_per_tenant')
    .on(t.companyId)
    .where(sql`${t.status} = 'active'`),
]);

/**
 * PROCESSED_WEBHOOKS — Idempotency guard (iyzico + Nilvera)
 *
 * Webhook'lar tekrar geldiğinde (network retry, manual replay) çift işleme YOK.
 * event_id PRIMARY KEY → aynı event_id ikinci kez INSERT edilirse hata = işlem skip.
 *
 * 90 gün sonra pg_cron cleanup (audit history audit_logs'ta zaten var).
 *
 * RLS: SADECE süperadmin SELECT, INSERT backend (service_role).
 */
export const processedWebhooks = petstockproSchema.table('processed_webhooks', {
  eventId: varchar('event_id', { length: 200 }).primaryKey(), // iyzico/nilvera unique event ID
  source: varchar('source', { length: 30 }).notNull(),         // 'iyzico' | 'nilvera'
  eventType: varchar('event_type', { length: 100 }).notNull(), // örn 'subscription.payment_succeeded'
  payload: jsonb('payload').notNull(),                          // tam event payload (debug için)
  processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
  errorMessage: text('error_message'),                          // başarısız işlemler için
}, (t) => [
  index('idx_processed_webhooks_processed_at').on(t.processedAt),
  index('idx_processed_webhooks_source_type').on(t.source, t.eventType),
]);

/**
 * INVOICES — Nilvera e-Arşiv fatura kayıtları
 *
 * Her başarılı subscription ödemesinde bir invoice. TR yasal zorunluluk.
 * onDelete: 'restrict' — tenant kapatsa fatura silinemez (KVKK 5 yıl + vergi 10 yıl saklama).
 *
 * RLS: tenant kendi faturalarını SELECT eder, INSERT/UPDATE backend.
 */
export const invoices = petstockproSchema.table('invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
  subscriptionId: uuid('subscription_id').notNull().references(() => subscriptions.id, { onDelete: 'restrict' }),

  // Fatura dönemi
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),

  // Tutar (2026 %20 KDV)
  amountMatrah: decimal('amount_matrah', { precision: 10, scale: 2 }).notNull(),    // KDV hariç (PRO için 625₺)
  vatAmount: decimal('vat_amount', { precision: 10, scale: 2 }).notNull(),          // KDV (125₺)
  amountTotal: decimal('amount_total', { precision: 10, scale: 2 }).notNull(),      // KDV dahil (750₺)

  // Nilvera e-Arşiv referansları
  nilveraInvoiceId: varchar('nilvera_invoice_id', { length: 100 }),
  nilveraInvoiceNumber: varchar('nilvera_invoice_number', { length: 50 }), // PSP-2026-000147
  pdfUrl: text('pdf_url'),                                                  // Supabase Storage URL

  status: invoiceStatusEnum('status').notNull().default('pending'),
  issuedAt: timestamp('issued_at', { withTimezone: true }),                 // Nilvera kesilme zamanı

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_invoices_company_period').on(t.companyId, t.periodEnd),
  index('idx_invoices_subscription').on(t.subscriptionId),
  index('idx_invoices_status').on(t.status),
  uniqueIndex('idx_invoices_nilvera_id').on(t.nilveraInvoiceId).where(sql`${t.nilveraInvoiceId} IS NOT NULL`),
]);

/**
 * AUDIT_LOGS — Immutable audit trail (her tenant + sistem aksiyonu)
 *
 * INSERT-only (trigger ile UPDATE/DELETE engellenir — Sprint 1A sonunda).
 * R3 basit: action varchar(100) — esnek pattern (entity.action), enum yerine string.
 * Süperadmin override aksiyonları ayrı flag + actionType ile kategorize.
 *
 * RLS: tenant kendi audit'ini SELECT eder, INSERT backend (her zaman).
 */
export const auditLogs = petstockproSchema.table('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }), // SUPERADMIN sistem aksiyonu için NULL
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),

  action: varchar('action', { length: 100 }).notNull(), // entity.action pattern: 'product.created', 'subscription.cancelled'
  entityType: varchar('entity_type', { length: 50 }),
  entityId: uuid('entity_id'),

  beforeState: jsonb('before_state'),
  afterState: jsonb('after_state'),

  ipAddress: varchar('ip_address', { length: 50 }),
  userAgent: text('user_agent'),

  // Süperadmin override izi
  performedAsSuperadmin: boolean('performed_as_superadmin').notNull().default(false),
  superadminSessionId: uuid('superadmin_session_id'),
  superadminActionType: superadminActionTypeEnum('superadmin_action_type'),
  superadminReason: text('superadmin_reason'),
  superadminSilent: boolean('superadmin_silent'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  // updatedAt YOK — immutable
}, (t) => [
  index('idx_audit_company_date').on(t.companyId, t.createdAt),
  index('idx_audit_user').on(t.userId),
  index('idx_audit_action').on(t.action),
  index('idx_audit_superadmin_session').on(t.superadminSessionId),
]);

// ═══════════════════════════════════════════════════════════════
// TODO Sprint 1B+ (sırayla eklenecek)
// ═══════════════════════════════════════════════════════════════
// products, product_variants, branch_inventory, stock_movements,
// suppliers, categories, brands, stocktakes, stocktake_items, sessions,
// vitrin_events, vitrin_reports, vitrin_whatsapp_feedback,
// storefront_settings, product_images, notifications, telegram_bindings,
// system_settings, system_broadcasts, system_errors, ...

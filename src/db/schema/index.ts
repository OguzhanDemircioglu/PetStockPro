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
  date,
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

// Sprint 1B.1 — Katalog + stok enum'ları
export const animalTypeEnum = petstockproSchema.enum('animal_type', [
  'cat', 'dog', 'bird', 'fish', 'rabbit', 'reptile', 'other',
]);

export const movementTypeEnum = petstockproSchema.enum('movement_type', [
  'stock_in',          // tedarikçiden giriş
  'stock_out',         // satış, fire, hediye, iade, vs (subtype'a göre)
  'transfer',          // şubeler arası
  'stocktake',         // sayım sırasında düzeltme
  'stocktake_initial', // sayım başlangıç snapshot'ı
]);

export const movementSubtypeEnum = petstockproSchema.enum('movement_subtype', [
  'sale', 'waste', 'gift', 'sample', 'return', 'internal_use', 'other',
]);

// 'credit' = veresiye — payment_method='credit' → customer_ref NULL OLAMAZ (DB CHECK Sprint 4)
export const paymentMethodEnum = petstockproSchema.enum('payment_method', [
  'cash', 'card', 'bank_transfer', 'credit',
]);

export const supplierPaymentTermsEnum = petstockproSchema.enum('supplier_payment_terms', [
  'cash', 'net_30', 'net_60', 'other',
]);

// Sprint 1B.2 — Guided stocktake (sayım oturumu)
export const stocktakeStatusEnum = petstockproSchema.enum('stocktake_status', [
  'in_progress', 'waiting', 'completed', 'cancelled',
]);

export const stocktakeModeEnum = petstockproSchema.enum('stocktake_mode', [
  'full',     // tüm aktif variant'lar
  'category', // tek kategori
  'manual',   // elle seçim
]);

export const stocktakeReasonEnum = petstockproSchema.enum('stocktake_reason', [
  'loss', 'overage', 'wrong_entry', 'expired', 'damage', 'theft', 'other',
]);

// Sprint 15 — Notification türleri (admin bildirim feed)
// Çoğu trigger Sprint 12+ tarafından üretilir; MVP'de stocktake/low-stock/auto-unpublish kullanılır.
export const notificationTypeEnum = petstockproSchema.enum('notification_type', [
  'low_stock_critical',
  'out_of_stock',
  'high_sale',
  'new_user',
  'plan_limit_warning',
  'daily_summary',
  'weekly_summary',
  'transfer_received',
  'stocktake_completed',
  'superadmin_session',
  'subscription_payment_failed',
  'subscription_renewed',
  'invoice_issued',
  'vitrin_approved',
  'vitrin_report_received',
  'vitrin_auto_unpublished',
]);

// Sprint 1B.2 — Vitrin etkinlik tipleri (Sprint 12 storefront analytics)
// 2026-05-14 revize: profile_view + listing_impression eklendi (DEVAM-REHBERI §3)
// 2026-05-15 revize: feedback_* 4 değer eklendi (WhatsApp Geri Bildirim Balonu)
export const vitrinEventTypeEnum = petstockproSchema.enum('vitrin_event_type', [
  'home_view',
  'profile_view',
  'product_view',
  'listing_impression',
  'category_view',
  'whatsapp_click',
  'phone_click',
  'telegram_click',
  'directions_click',
  'search',
  'feedback_balloon_shown',
  'feedback_submitted',
  'feedback_closed_manually',
  'feedback_dismissed',
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
  lockedReason: varchar('locked_reason', { length: 50 }), // 'BRUTE_FORCE_1H' | 'BRUTE_FORCE_24H' | 'EMAIL_UNVERIFIED' | 'SUPERADMIN'
  failedLoginCount: integer('failed_login_count').notNull().default(0),
  recentLockCount: integer('recent_lock_count').notNull().default(0), // 24h içinde art arda lock (3+ = kalıcı 24h)
  lastLockedAt: timestamp('last_locked_at', { withTimezone: true }), // pg_cron 24h+ olunca recentLockCount reset
  // KVKK consents (Sprint 2.2'de aktif)
  kvkkConsentedAt: timestamp('kvkk_consented_at', { withTimezone: true }),
  dataLocationConsentedAt: timestamp('data_location_consented_at', { withTimezone: true }),
  onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
  // Email verification (Sprint 2.3 — EKRAN-AUTH §4)
  emailVerificationToken: varchar('email_verification_token', { length: 100 }),
  emailVerificationExpiresAt: timestamp('email_verification_expires_at', { withTimezone: true }),
  emailVerificationResendCount: integer('email_verification_resend_count').notNull().default(0),
  emailVerificationLastSentAt: timestamp('email_verification_last_sent_at', { withTimezone: true }),
  // Password reset (Sprint 2.4 — EKRAN-AUTH §5)
  passwordResetToken: varchar('password_reset_token', { length: 100 }),
  passwordResetExpiresAt: timestamp('password_reset_expires_at', { withTimezone: true }),
  // Email change (Sprint 2.9 — EKRAN-AUTH §6)
  pendingEmail: varchar('pending_email', { length: 255 }), // doğrulama bekliyor
  pendingEmailToken: varchar('pending_email_token', { length: 100 }),
  pendingEmailExpiresAt: timestamp('pending_email_expires_at', { withTimezone: true }),
  // 2FA TOTP (Sprint 2.5 — EKRAN-AUTH §7)
  // twoFactorEnabled (yukarıda mevcut) — 2FA aktif mi?
  twoFactorSecret: text('two_factor_secret'),                                       // base32 secret (Faz 2'de at-rest encrypted)
  twoFactorRecoveryCodes: jsonb('two_factor_recovery_codes').$type<RecoveryCode[]>(), // 8 adet, SHA-256 hash + usedAt
  twoFactorEnabledAt: timestamp('two_factor_enabled_at', { withTimezone: true }),
  twoFactorSetupSecret: text('two_factor_setup_secret'),                            // setup wizard'da geçici (10 dk TTL)
  twoFactorSetupExpiresAt: timestamp('two_factor_setup_expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_users_company').on(t.companyId),
  index('idx_users_verification_token').on(t.emailVerificationToken),
  index('idx_users_password_reset_token').on(t.passwordResetToken),
  index('idx_users_pending_email_token').on(t.pendingEmailToken),
]);

/** 2FA recovery code shape — hashed (SHA-256), tek kullanımlık. */
export interface RecoveryCode {
  hash: string;
  usedAt: string | null; // ISO date string (jsonb içinde Date serialize edilmez)
}

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
// TABLES — Sprint 1B.1 (Katalog + Stok foundation, UI Sprint 3+)
// ═══════════════════════════════════════════════════════════════
// Otoritatif: DATABASE-SCHEMA.md §3.2 (branchInventory) + §3.3 (katalog) + §3.4 (operasyon)

/**
 * CATEGORIES — Ürün kategorileri (tenant başına)
 *
 * Hierarchical: parentId nullable self-reference. MVP'de 1-2 derinlik kullanılır.
 * vatRate: %1 (özel) / %10 (gıda - pet mama) / %20 (genel). lib/constants/vat-rates.ts ile uyum.
 * sktRequired: true ise stok_movements'da expiryDate zorunlu (Sprint 4 trigger).
 *
 * RLS: tenant SELECT/INSERT/UPDATE/DELETE kendi categories'lerini, super_admin all access.
 */
export const categories = petstockproSchema.table('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id'), // self-reference (FK constraint Drizzle relations.ts'te)
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  emoji: varchar('emoji', { length: 10 }),
  displayOrder: integer('display_order').notNull().default(0),
  vatRate: decimal('vat_rate', { precision: 5, scale: 2 }), // 1.00 / 10.00 / 20.00
  sktRequired: boolean('skt_required').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('idx_categories_company_slug').on(t.companyId, t.slug),
  index('idx_categories_parent').on(t.parentId),
]);

/**
 * BRANDS — Ürün markaları (tenant başına)
 */
export const brands = petstockproSchema.table('brands', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  logoUrl: text('logo_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('idx_brands_company_slug').on(t.companyId, t.slug),
]);

/**
 * SUPPLIERS — Tedarikçiler (tenant başına)
 *
 * Stock-in movement'larında supplierId FK. Soft delete: isActive.
 */
export const suppliers = petstockproSchema.table('suppliers', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  vatNo: varchar('vat_no', { length: 20 }),
  vatOffice: varchar('vat_office', { length: 100 }),

  contactName: varchar('contact_name', { length: 100 }),
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 255 }),

  city: varchar('city', { length: 100 }),
  district: varchar('district', { length: 100 }),
  addressLine: text('address_line'),

  leadTimeDays: integer('lead_time_days').notNull().default(7),
  paymentTerms: supplierPaymentTermsEnum('payment_terms').notNull().default('net_30'),
  iban: varchar('iban', { length: 34 }),

  isActive: boolean('is_active').notNull().default(true),
  note: text('note'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_suppliers_company').on(t.companyId),
]);

/**
 * PRODUCTS — Ürün parent (variant'larla 1-N)
 *
 * vitrinPublished PARENT-LEVEL. Variant bazlı vitrin toggle YOK (Faz 2).
 * isActive: soft delete. isPublished: taslak/yayın.
 *
 * Stok 0 → otomatik vitrin'den çekme (Sprint 4 trigger). Manuel "Satışa Aç" ile geri açılır.
 */
export const products = petstockproSchema.table('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  description: text('description'),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'set null' }),
  animalTypes: jsonb('animal_types').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  tags: jsonb('tags').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  isActive: boolean('is_active').notNull().default(true),
  isPublished: boolean('is_published').notNull().default(true),
  isFeatured: boolean('is_featured').notNull().default(false),
  adminNote: text('admin_note'),

  // Vitrin toggle (parent-level)
  vitrinPublished: boolean('vitrin_published').notNull().default(false),
  vitrinPublishedAt: timestamp('vitrin_published_at', { withTimezone: true }),
  vitrinPublishedById: uuid('vitrin_published_by_id').references(() => users.id, { onDelete: 'set null' }),
  vitrinAutoUnpublishedAt: timestamp('vitrin_auto_unpublished_at', { withTimezone: true }),
  vitrinAutoUnpublishedReason: varchar('vitrin_auto_unpublished_reason', { length: 50 }),

  // Denormalized stats (background job — Sprint 4)
  totalStockQty: integer('total_stock_qty').notNull().default(0),
  lastSupplierId: uuid('last_supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('idx_products_company_slug').on(t.companyId, t.slug),
  index('idx_products_company_active').on(t.companyId, t.isActive),
  index('idx_products_category').on(t.categoryId),
  index('idx_products_brand').on(t.brandId),
  index('idx_products_vitrin').on(t.companyId, t.vitrinPublished).where(sql`${t.vitrinPublished} = true`),
]);

/**
 * PRODUCT_VARIANTS — Boyut/Ambalaj varyantı (MVP'de tek axis)
 *
 * SKU per-tenant unique. Fiyat + threshold variant bazlı.
 * isDefault: varyantsız ürünler için tek "default" variant (UX kolaylığı).
 */
export const productVariants = petstockproSchema.table('product_variants', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),

  axisLabel: varchar('axis_label', { length: 50 }).notNull().default('Boyut'),
  valueLabel: varchar('value_label', { length: 50 }).notNull(),

  sku: varchar('sku', { length: 100 }).notNull(),
  barcode: varchar('barcode', { length: 13 }), // EAN-13

  costPrice: decimal('cost_price', { precision: 10, scale: 2 }).notNull().default('0'),
  salePrice: decimal('sale_price', { precision: 10, scale: 2 }).notNull().default('0'),

  threshold: integer('threshold').notNull().default(5), // genel düşük stok eşiği
  branchThresholds: jsonb('branch_thresholds').$type<Record<string, number>>(), // { branchId: number }

  isActive: boolean('is_active').notNull().default(true),
  isDefault: boolean('is_default').notNull().default(false),
  displayOrder: integer('display_order').notNull().default(0),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('idx_variants_company_sku').on(t.companyId, t.sku),
  index('idx_variants_product').on(t.productId),
  index('idx_variants_barcode').on(t.barcode),
]);

/**
 * PRODUCT_IMAGES — Ürün görselleri
 *
 * isPrimary: ana görsel (vitrin thumbnail). displayOrder: gallery sıralama.
 */
export const productImages = petstockproSchema.table('product_images', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  isPrimary: boolean('is_primary').notNull().default(false),
  displayOrder: integer('display_order').notNull().default(0),
  altText: varchar('alt_text', { length: 200 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_product_images_product').on(t.productId, t.displayOrder),
]);

/**
 * BRANCH_INVENTORY — Şube bazlı stok sayısı (per-branch + per-variant)
 *
 * Tek satır per (branch, variant). stockQty güncel toplam.
 * Stok hareketi yapılınca trigger ile güncellenir (Sprint 4).
 *
 * unique (branchId, variantId) — aynı şubede aynı variant için tek satır.
 */
export const branchInventory = petstockproSchema.table('branch_inventory', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').notNull().references(() => branches.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').notNull().references(() => productVariants.id, { onDelete: 'cascade' }),

  stockQty: integer('stock_qty').notNull().default(0),
  expiryDate: date('expiry_date'), // SKT — sktRequired kategoriler için zorunlu (Sprint 4 trigger)
  lotNumber: varchar('lot_number', { length: 100 }),

  // Background job stats
  lastSoldAt: timestamp('last_sold_at', { withTimezone: true }),
  lastReceivedAt: timestamp('last_received_at', { withTimezone: true }),
  totalSoldQty: integer('total_sold_qty').notNull().default(0),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('idx_branch_inventory_unique').on(t.branchId, t.variantId),
  index('idx_branch_inventory_company').on(t.companyId),
  index('idx_branch_inventory_low').on(t.branchId, t.stockQty),
]);

/**
 * STOCK_MOVEMENTS — Immutable ledger (her stok değişimi)
 *
 * UPDATE/DELETE bloklanır (Sprint 4 trigger). Sadece INSERT.
 * type+subtype: stock_in/stock_out (sale/waste/gift/sample/return/internal_use/other)/transfer/stocktake/stocktake_initial.
 *
 * reversesId / reversedById: geri alma (R1 — 24 saat içinde herkes, süresiz SUPERADMIN).
 * transferGroupId: kaynak + hedef entry'leri eşleştirir.
 *
 * RLS: tenant SELECT kendi movement'larını, INSERT backend (service_role).
 */
export const stockMovements = petstockproSchema.table('stock_movements', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
  branchId: uuid('branch_id').notNull().references(() => branches.id, { onDelete: 'restrict' }),
  variantId: uuid('variant_id').notNull().references(() => productVariants.id, { onDelete: 'restrict' }),

  type: movementTypeEnum('type').notNull(),
  subtype: movementSubtypeEnum('subtype'), // sadece stock_out için

  quantity: integer('quantity').notNull(), // + giriş, - çıkış
  beforeQty: integer('before_qty').notNull(),
  afterQty: integer('after_qty').notNull(),

  unitCost: decimal('unit_cost', { precision: 10, scale: 2 }),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }),
  discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }),

  // Bağlam (tipe göre dolar)
  supplierId: uuid('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }), // stock_in
  customerRef: varchar('customer_ref', { length: 100 }), // sale — "Misafir alıcı" / telefon / ad
  paymentMethod: paymentMethodEnum('payment_method'), // sale (credit ise customer_ref zorunlu — Sprint 4 CHECK)
  creditPaidAt: timestamp('credit_paid_at', { withTimezone: true }), // veresiye kapama
  documentNo: varchar('document_no', { length: 100 }), // irsaliye
  lotNumber: varchar('lot_number', { length: 100 }),
  expiryDate: date('expiry_date'),

  reason: text('reason'), // serbest metin (waste sebebi vs)
  note: text('note'),

  // Transfer
  transferGroupId: uuid('transfer_group_id'),
  transferTargetBranchId: uuid('transfer_target_branch_id').references(() => branches.id, { onDelete: 'set null' }),

  // Reversal
  reversesId: uuid('reverses_id'),
  reversedById: uuid('reversed_by_id'),

  // Audit
  createdById: uuid('created_by_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  performedAsSuperadmin: boolean('performed_as_superadmin').notNull().default(false),
  superadminSessionId: uuid('superadmin_session_id'),
  ipAddress: varchar('ip_address', { length: 50 }),
  userAgent: text('user_agent'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  // updatedAt YOK — immutable
}, (t) => [
  index('idx_stock_movements_company_date').on(t.companyId, t.createdAt),
  index('idx_stock_movements_branch_date').on(t.branchId, t.createdAt),
  index('idx_stock_movements_variant').on(t.variantId),
  index('idx_stock_movements_transfer_group').on(t.transferGroupId),
  index('idx_stock_movements_supplier').on(t.supplierId),
  index('idx_stock_movements_type').on(t.type, t.subtype),
]);

// ═══════════════════════════════════════════════════════════════
// TABLES — Sprint 1B.2 (Sessions + Sayım Oturumları + Vitrin Events)
// ═══════════════════════════════════════════════════════════════
// Otoritatif: DATABASE-SCHEMA.md §3.1 (sessions), §3.4 (stocktakes/stocktake_items), §3.8 (vitrin_events)

/**
 * SESSIONS — Auth.js + cihaz takibi
 *
 * MVP: Auth.js JWT strategy aktif (lib/auth/auth.ts:30) — bu tablo şu an boş.
 * Hazırlık: "Aktif Oturumlar" UX'i (EKRAN-KULLANICILAR — kullanıcı kendi cihazlarını görüp logout
 * edebilir) ve Auth.js Drizzle adapter geçişi için schema önden hazır. Faz 2 aktivasyonu:
 * auth.ts'te `session: { strategy: 'database' }` + DrizzleAdapter wiring.
 *
 * RLS: kullanıcı kendi session'ını SELECT/DELETE eder, INSERT backend (service_role).
 */
export const sessions = petstockproSchema.table('sessions', {
  sessionToken: varchar('session_token', { length: 255 }).primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),

  // Cihaz takibi (Auth.js standart shape üstüne custom)
  ipAddress: varchar('ip_address', { length: 50 }),
  userAgent: text('user_agent'),
  deviceLabel: varchar('device_label', { length: 100 }), // "Chrome on Windows" — UA parse
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_sessions_user').on(t.userId),
  index('idx_sessions_expires').on(t.expires),
]);

/**
 * STOCKTAKES — Sayım oturumu (header)
 *
 * Bir sayım: branch + mode (full/category/manual). categoryId category modunda dolar.
 * status: in_progress (sayım sürerken) → waiting (kayıt için bekliyor) → completed.
 * cancelled = iptal (item'lar saklanır audit için).
 * softLock=true iken trigger Sprint 4+ aynı şubede stok hareketi engelleyebilir (Faz 2).
 *
 * Tamamlandığında her diff != 0 item için stock_movements (type='stocktake') üretilir.
 *
 * RLS: tenant SELECT/INSERT/UPDATE kendi sayımlarını, super_admin all access.
 */
export const stocktakes = petstockproSchema.table('stocktakes', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').notNull().references(() => branches.id, { onDelete: 'restrict' }),
  mode: stocktakeModeEnum('mode').notNull(),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  softLock: boolean('soft_lock').notNull().default(true),
  status: stocktakeStatusEnum('status').notNull().default('in_progress'),

  // Sayım istatistikleri (background — Sprint 4+)
  totalItems: integer('total_items').notNull().default(0),
  countedItems: integer('counted_items').notNull().default(0),
  diffItems: integer('diff_items').notNull().default(0),
  valueImpact: decimal('value_impact', { precision: 12, scale: 2 }), // cost-bazlı parasal etki

  note: text('note'),
  startedById: uuid('started_by_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
}, (t) => [
  index('idx_stocktakes_company_status').on(t.companyId, t.status),
  index('idx_stocktakes_branch').on(t.branchId),
]);

/**
 * STOCKTAKE_ITEMS — Sayım kalemleri (variant × oturum)
 *
 * Sayım başlangıcında her aktif variant için satır açılır (systemQty snapshot).
 * Kullanıcı countedQty girer → diff = counted - system (trigger ile veya app-side).
 * isSkipped: bu variant sayılmayacak (depo dışı, vs).
 *
 * Tamamlandığında diff != 0 olan satırlar için stock_movements oluşturulur, stocktakeId FK ile.
 */
export const stocktakeItems = petstockproSchema.table('stocktake_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  stocktakeId: uuid('stocktake_id').notNull().references(() => stocktakes.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').notNull().references(() => productVariants.id, { onDelete: 'restrict' }),

  systemQty: integer('system_qty').notNull(),
  countedQty: integer('counted_qty'),
  diff: integer('diff'),
  reason: stocktakeReasonEnum('reason'),
  customReason: text('custom_reason'), // 'other' reason için
  isSkipped: boolean('is_skipped').notNull().default(false),

  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('idx_stocktake_items_unique').on(t.stocktakeId, t.variantId),
  index('idx_stocktake_items_variant').on(t.variantId),
]);

/**
 * VITRIN_EVENTS — Storefront analytics (Sprint 12 tüketici)
 *
 * Her vitrin etkileşimi (profil ziyaret + ürün görüntüleme + WhatsApp tıklama + feedback balonu).
 * KVKK uyumlu: visitorIpHash = SHA256(IP + daily_salt) — kişisel veri YOK.
 * 90 gün retention (pg_cron — DEPLOYMENT §8.3).
 * Aylık partition (pg_partman) Faz 2'de büyük tenant'lar için.
 *
 * RLS: tenant kendi event'lerini SELECT (analytics), INSERT anonim (public vitrin via service_role).
 */
export const vitrinEvents = petstockproSchema.table('vitrin_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'cascade' }),

  eventType: vitrinEventTypeEnum('event_type').notNull(),

  // Ziyaretçi (anonim, KVKK uyumlu)
  visitorIpHash: varchar('visitor_ip_hash', { length: 64 }), // SHA256(IP + daily_salt)
  visitorCityId: integer('visitor_city_id').references(() => cities.id),
  visitorCountry: varchar('visitor_country', { length: 2 }), // ISO 3166-1
  userAgent: text('user_agent'),
  referrerUrl: text('referrer_url'),
  searchQuery: text('search_query'), // event_type='search' için

  // UTM (Faz 2 reklam ölçümü)
  utmSource: varchar('utm_source', { length: 50 }),
  utmMedium: varchar('utm_medium', { length: 50 }),
  utmCampaign: varchar('utm_campaign', { length: 50 }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_vitrin_events_company_date').on(t.companyId, t.createdAt),
  index('idx_vitrin_events_type_date').on(t.companyId, t.eventType, t.createdAt),
  index('idx_vitrin_events_product').on(t.productId, t.createdAt).where(sql`${t.productId} IS NOT NULL`),
]);

// ═══════════════════════════════════════════════════════════════
// TABLES — Sprint 15 (Notifications scaffold)
// ═══════════════════════════════════════════════════════════════
// Otoritatif: DATABASE-SCHEMA.md §3.5 (notifications/telegram_bindings)

/**
 * NOTIFICATIONS — Admin bildirim feed
 *
 * Tenant + opsiyonel user-specific bildirim. content jsonb { title, body, link }.
 * channel: 'screen' (admin UI feed), 'telegram' (Telegram bot — Faz 2 binding),
 * 'email' (Brevo transactional — Faz 2 daily summary).
 *
 * MVP: sadece 'screen' channel — /admin/notifications sayfası okur.
 * Stocktake completion + low_stock auto-detect + vitrin_auto_unpublished tetikler.
 *
 * RLS: tenant SELECT kendi notifications (userId NULL veya kendi userId),
 * INSERT backend (service_role).
 */
export const notifications = petstockproSchema.table('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }), // NULL = tüm tenant'a
  type: notificationTypeEnum('type').notNull(),
  channel: varchar('channel', { length: 20 }).notNull().default('screen'), // 'screen' | 'telegram' | 'email'
  content: jsonb('content').$type<NotificationContent>().notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_notifications_company_user').on(t.companyId, t.userId, t.createdAt),
  index('idx_notifications_unread').on(t.companyId, t.userId).where(sql`${t.readAt} IS NULL`),
]);

/** content jsonb shape — UI bunları renderlar. */
export interface NotificationContent {
  title: string;
  body?: string;
  link?: string;     // /admin/stocktake/{id} gibi
  emoji?: string;    // ✅ ⚠ 🔒 vs
}

// ═══════════════════════════════════════════════════════════════
// TABLES — Sprint 12 partial (Storefront settings)
// ═══════════════════════════════════════════════════════════════
// Otoritatif: DATABASE-SCHEMA.md §3.6 (storefront_settings).
// MVP: text-only alanlar (hakkında + iletişim + sosyal medya + SEO).
// Image upload (hero/about/og) Faz 2 — SUPABASE_SERVICE_ROLE_KEY gelince.

/**
 * STOREFRONT_SETTINGS — Pet shop vitrin profili (admin yönetir, public okur).
 *
 * companyId PK (1:1 ile companies). Tenant kendi profilini düzenler.
 * isEnabled: vitrin yayınlanmış mı (admin toggle). companies.storefrontStatus ile birlikte.
 *
 * RLS: tenant kendi profilini SELECT/UPDATE/INSERT, anon SELECT WHERE isEnabled=true (Sprint 12 public).
 */
export const storefrontSettings = petstockproSchema.table('storefront_settings', {
  companyId: uuid('company_id').primaryKey().references(() => companies.id, { onDelete: 'cascade' }),

  isEnabled: boolean('is_enabled').notNull().default(false),
  aboutContent: text('about_content'), // markdown — short bio + working hours

  // İletişim — companies.whatsappPhone'u override edebilir
  contactPhone: varchar('contact_phone', { length: 20 }),
  contactWhatsapp: varchar('contact_whatsapp', { length: 20 }),
  contactTelegram: varchar('contact_telegram', { length: 100 }),
  contactEmail: varchar('contact_email', { length: 255 }),

  // Sosyal medya (sadece kullanıcı adı, URL prefix UI tarafında eklenir)
  socialInstagram: varchar('social_instagram', { length: 100 }),
  socialFacebook: varchar('social_facebook', { length: 100 }),
  socialTwitter: varchar('social_twitter', { length: 100 }),
  socialTiktok: varchar('social_tiktok', { length: 100 }),

  // SEO
  metaDescription: text('meta_description'), // <meta name="description"> içeriği

  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ═══════════════════════════════════════════════════════════════
// TODO Sprint 1B.3+ (sırayla eklenecek)
// ═══════════════════════════════════════════════════════════════
// vitrin_reports, vitrin_whatsapp_feedback,
// telegram_bindings (Faz 2 binding flow), system_settings, system_broadcasts,
// system_errors, bayi_admin_relations (Faz 3), storefront_messages, ...
// storefront_settings image alanları (hero/about/og) — Faz 2 (service-role key)

/**
 * PetStockPro — Drizzle Schema (petstockpro schema, Supabase)
 *
 * Sprint 0: temel iskelet — cities, districts, companies, branches, users
 * Sprint 1+: ürünler, variants, stok hareketleri, sayım, vitrin, ...
 *
 * Otoritatif: docs/DATABASE-SCHEMA.md (36 tablo MVP)
 */

import { pgSchema, uuid, text, varchar, integer, timestamp, boolean } from 'drizzle-orm/pg-core';

export const petstockproSchema = pgSchema('petstockpro');

/**
 * ====== ENUMS — Sprint 0 iskelet ======
 */
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

/**
 * ====== TABLES — Sprint 0 iskelet ======
 *
 * NOT: Bu Sprint 0 temel iskelet. Sprint 1'de DATABASE-SCHEMA.md'deki 36 tablo
 * tamamen implement edilecek (products, variants, branch_inventory, stock_movements,
 * stocktakes, vitrin_events, vitrin_reports, vitrin_whatsapp_feedback, subscriptions,
 * invoices, audit_logs, system_errors, ...).
 */

// 81 il — Sprint 0 seed
export const cities = petstockproSchema.table('cities', {
  id: integer('id').primaryKey(), // plaka kodu (1-81)
  name: text('name').notNull(),
  slug: varchar('slug', { length: 50 }).notNull().unique(),
});

// ~970 ilçe — Sprint 0 seed
export const districts = petstockproSchema.table('districts', {
  id: uuid('id').defaultRandom().primaryKey(),
  cityId: integer('city_id').notNull().references(() => cities.id),
  name: text('name').notNull(),
  slug: varchar('slug', { length: 50 }).notNull(),
});

// Companies — pet shop sahipleri (tenant)
export const companies = petstockproSchema.table('companies', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  plan: planEnum('plan').notNull().default('FREE'),
  vatNo: varchar('vat_no', { length: 11 }), // 10 (VKN) veya 11 (TC) — opsiyonel (kayıtta sorulmaz)
  vatRequiredAt: timestamp('vat_required_at', { withTimezone: true }),
  whatsappPhone: varchar('whatsapp_phone', { length: 20 }),
  cityId: integer('city_id').references(() => cities.id),
  districtId: uuid('district_id').references(() => districts.id),
  storefrontStatus: storefrontStatusEnum('storefront_status').notNull().default('disabled'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Users — pet shop personeli (multi-role)
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
  // KVKK consents (Sprint 2'de detaylanır)
  kvkkConsentedAt: timestamp('kvkk_consented_at', { withTimezone: true }),
  dataLocationConsentedAt: timestamp('data_location_consented_at', { withTimezone: true }),
  onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Branches — şubeler (multi-location)
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
});

// TODO Sprint 1: products, product_variants, branch_inventory, stock_movements,
// suppliers, categories, stocktakes, stocktake_items, audit_logs, sessions,
// vitrin_events, vitrin_reports, vitrin_whatsapp_feedback, subscriptions,
// invoices, processed_webhooks, system_errors, ...

# PetStockPro — Database Schema

**Tarih:** 2026-05-12
**Stack:** Supabase Postgres + Drizzle ORM + RLS politikaları
**Migration:** Drizzle Kit (`drizzle-kit push` dev, `drizzle-kit migrate` prod)
**Type gen:** `supabase gen types typescript --project-id ... > types/supabase.ts`

> Bu doküman tüm tablolar, ilişkiler, RLS politikaları, index'ler, trigger'lar ve seed data'yı tanımlar. Drizzle TypeScript schema kod örnekleriyle.

---

## 1. Genel Mimari

```
Multi-tenant SaaS — Tek DB, Row-Level Security
┌────────────────────────────────────────────┐
│ companies (tenant root)                    │
│   ↓                                          │
│ users · branches · products · ...          │
│   ↓ (her tablo company_id FK)              │
│ Tüm queries RLS ile company_id filtresi    │
│ (Auth.js JWT claim'inden gelir)            │
└────────────────────────────────────────────┘
```

**Felsefe:**
- Tek schema (Postgres default `public`)
- Tenant izolasyonu RLS politikalarıyla DB seviyesinde
- Şube müdürü ek RLS koşulu (`branch_id`)
- INSERT-only tablolar (`stock_movements`, `audit_logs`) trigger ile korunur

---

## 2. Tablo Kategorileri

```
1. Tenant & Auth
   ├── companies
   ├── plans
   ├── users
   ├── sessions (Auth.js)
   ├── accounts (Auth.js OAuth)
   └── verification_tokens (Auth.js)

2. Şube & Stok
   ├── branches
   ├── branch_inventory
   └── currency_rates (cache)

3. Katalog
   ├── categories
   ├── brands
   ├── products (parent)
   ├── product_variants
   └── product_images

4. Operasyon
   ├── stock_movements (immutable ledger)
   ├── stocktakes
   ├── stocktake_items
   └── suppliers

5. Sistem
   ├── audit_logs (immutable)
   ├── notifications
   ├── telegram_bindings
   ├── plan_approval_requests
   └── data_export_jobs

6. Public Vitrin
   ├── storefront_settings
   └── storefront_messages

7. Konum (Türkiye il/ilçe — vitrin keşif ve adres seed)
   ├── cities (81 kayıt seed)
   └── districts (~970 kayıt seed)

8. Vitrin Metrikler
   └── vitrin_events (görüntüleme + tıklama + WhatsApp tıklama)

9. Bayi Admin (Faz 3 — multi-tenant read-only viewer)
   └── bayi_admin_relations (iki taraflı onay ile bağlantı)
```

---

## 3. Drizzle Schema (TypeScript)

### 3.1 Tenant & Auth

```ts
// db/schema/tenant.ts
import { pgTable, uuid, varchar, text, integer, boolean, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';

// 2026-05-14 KARAR REVİZYONU: 3-tier (FREE + PRO + PRO_PLUS) geri açıldı, TR-only.
// 2026-05-21 pricing son revize: 1.000/2.000 (önceki 750/1.750 → 1.250/2.250 → 1.000/2.000).
//   FREE 50 ürün (0₺) / PRO 500 ürün (1.000₺/ay KDV dahil) / PRO+ Sınırsız (2.000₺/ay KDV dahil)
//   Tek farklılaşma stok limiti — diğer tüm özellikler tüm planlarda açık.
//   Detay: PLAN-KADEMELERI.md (3-tier B onaylandı)
//   Önceki 2026-05-13 "2-tier, PRO+ rafa" kararı iptal edildi.
export const planEnum = pgEnum('plan_tier', ['FREE', 'PRO', 'PRO_PLUS']);

// TR-only kararı (2026-05-14): billingCurrency sadece TRY. USD/EUR enum'da tutuldu
// (Paddle yurt dışı Faz 2'de açılırsa hazır) ama default + tek değer TRY.
export const billingCurrencyEnum = pgEnum('billing_currency', ['TRY', 'USD', 'EUR']);
export const companyStatusEnum = pgEnum('company_status', ['active', 'suspended', 'deleted', 'pending_deletion']);

// Vitrin yayın durumu (MANTIK-HATALARI-2026-05-14 K1 düzeltmesi):
//   disabled         — tenant kapalı tutmuş (vitrin'den gizli)
//   pending          — validation eksik VEYA süperadmin manuel inceleme bekliyor (otomatik onay default)
//   approved         — vitrin'de aktif (validation pass = anında, sahibinden modeli)
//   rejected         — otomatik filtre (sahte içerik/küfür/çakışan slug) — süperadmin manuel inceler
//   auto_suspended   — stok 0 / KVKK ihlal / mali yükümlülük → otomatik trigger
// Felsefe: 1K pet shop'a manuel onay imkansız (CLAUDE.md #1 kural). Default akış: otomatik onay.
export const storefrontStatusEnum = pgEnum('storefront_status', ['disabled', 'pending', 'approved', 'rejected', 'auto_suspended']);

export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  legalName: varchar('legal_name', { length: 255 }),
  slug: varchar('slug', { length: 100 }).unique().notNull(),  // vitrin için
  // Vergi bilgileri (kayıtta opsiyonel, "Satışa Aç" toggle tıklandığında zorunlu — 2026-05-13 kararı)
  // Pet shop sahibi sadece stok takip için kullanıyorsa vergi mükellefi olmasına gerek yok
  // Format: 10 hane (şirket VKN) VEYA 11 hane (şahıs şirketi TC kimlik no) — checksum doğrulamalı
  vatNo: varchar('vat_no', { length: 20 }),         // NULL → kayıt aşamasında, dolu → vergi mükellefi
  vatOffice: varchar('vat_office', { length: 100 }),  // şahıs şirketi için boş bırakılabilir
  vatRequiredAt: timestamp('vat_required_at', { withTimezone: true }),  // ilk "Satışa Aç" tetikleyici tarihi (audit için)
  country: varchar('country', { length: 2 }).default('TR').notNull(),
  billingCurrency: billingCurrencyEnum('billing_currency').default('TRY').notNull(),
  plan: planEnum('plan').default('FREE').notNull(),
  planLimit: integer('plan_limit').default(50).notNull(),  // FREE: 50 / PRO: 500 / PRO+: NULL (sınırsız) — 3-tier B (2026-05-14)
  status: companyStatusEnum('status').default('active').notNull(),

  // Adres — il/ilçe FK ile lookup (seed: cities + districts tabloları, Bölüm 3.7)
  cityId: integer('city_id').references(() => cities.id),         // 81 il enum
  districtId: integer('district_id').references(() => districts.id),  // ~970 ilçe
  addressLine: text('address_line'),
  postalCode: varchar('postal_code', { length: 10 }),

  // İletişim
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 255 }),
  website: varchar('website', { length: 255 }),

  // WhatsApp deep link (vitrin "Satıcıya Sor" butonu için)
  // Biz WhatsApp Business API kullanmıyoruz — sadece wa.me/... deep link açıyoruz,
  // kullanıcı mesajı kendisi gönderiyor (2026-05-13 netleştirme)
  whatsappPhone: varchar('whatsapp_phone', { length: 20 }),

  // Locale
  locale: varchar('locale', { length: 5 }).default('tr-TR').notNull(),
  timezone: varchar('timezone', { length: 50 }).default('Europe/Istanbul').notNull(),
  dateFormat: varchar('date_format', { length: 20 }).default('DD.MM.YYYY').notNull(),

  // Vitrin (MANTIK-HATALARI-2026-05-14 K1: tek field, 5 state enum)
  // Default 'pending' — validation pass sonrası otomatik 'approved'. Stok 0 / şikayet / kapatma → state değişir.
  storefrontStatus: storefrontStatusEnum('storefront_status').default('pending').notNull(),
  storefrontStatusReason: text('storefront_status_reason'),                                          // audit için (rejected/auto_suspended sebebi)
  storefrontStatusChangedAt: timestamp('storefront_status_changed_at', { withTimezone: true }),
  storefrontTheme: varchar('storefront_theme', { length: 50 }).default('classic-pet').notNull(),

  // Süperadmin geçici plan limit override (SUPERADMIN-YETKILERI §1.5)
  temporaryLimitOverride: integer('temporary_limit_override'),                   // ek limit (örn FREE 50 + 10 override = 60)
  temporaryLimitOverrideUntil: timestamp('temporary_limit_override_until', { withTimezone: true }),  // NULL = kalıcı, datetime = otomatik bitiş

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// Plan master tablosu (sadece referans, hard-coded değil)
export const plans = pgTable('plans', {
  tier: planEnum('tier').primaryKey(),
  productLimit: integer('product_limit'),  // NULL = sınırsız
  priceTryMonthly: integer('price_try_monthly').notNull(),  // KDV dahil tutar (₺)
  priceUsdMonthly: integer('price_usd_monthly').notNull(),  // TR-only: 0 (Faz 2 yurt dışı için)
  features: jsonb('features').notNull(),  // tüm planlarda aynı (FAZ1 R kararı)
});
// Seed (2026-05-14 — 3-tier B onaylandı):
//   FREE     | productLimit: 50    | priceTryMonthly: 0     | priceUsdMonthly: 0
//   PRO      | productLimit: 500   | priceTryMonthly: 1000  | priceUsdMonthly: 0
//   PRO_PLUS | productLimit: NULL  | priceTryMonthly: 2000  | priceUsdMonthly: 0
// TR-only kararı: priceUsdMonthly = 0 (Faz 2 yurt dışı açılışında doldurulur).

// 2026-05-21 — Migration 0021 (Observer + Yetki + Şube state refactor):
//   SUBE_MUDURU → OBSERVER rename. Yeni enum:
//   SUPERADMIN:  sistem yöneticisi (sen)
//   BAYI_SAHIBI: pet shop sahibi (branchId=NULL, tenant geneli, tüm yetkiler bypass)
//   OBSERVER:    "İzleyici" — read-only multi-branch viewer; hiçbir mutation yapamaz
//                (assertNotObserver gate ile mutation reddedilir)
//   STAFF:       "Çalışan" — granular permission (user_permissions tablosu).
//                3 default ON (sale.create / variant.view / customer_ref.write),
//                12 default OFF (Bayi Admin tek tek açar yetki modal'ından)
//   BAYI_ADMIN:  legacy — UI'da yok, schema'da kaldı (Postgres enum drop limited)
// Yetki matrisi: EKRAN-KULLANICILAR.md §12.5
export const userRoleEnum = pgEnum('user_role', ['SUPERADMIN', 'BAYI_SAHIBI', 'OBSERVER', 'STAFF', 'BAYI_ADMIN']);

// 2026-05-21 Migration 0021 — Şube 3-state:
//   active:   normal — vitrin'de görünür, tüm aksiyonlar açık
//   holiday:  tatilde — vitrin "🏖" rozet + WhatsApp disabled, admin operasyonu devam edebilir
//   inactive: pasif  — vitrin'den çekilir + admin read-only
// branches.is_active sync: active/holiday=true, inactive=false (geri uyumluluk)
export const branchStatusEnum = pgEnum('branch_status', ['active', 'holiday', 'inactive']);

// 2026-05-21 Migration 0021 — STAFF granular permission (Plan §C):
//   id, user_id, permission_key (60 char), enabled, granted_by_id, granted_at
//   UNIQUE(user_id, permission_key). 15 key whitelist (lib/users/permission-keys.ts).
//   BAYI_SAHIBI + SUPERADMIN bypass eder, OBSERVER her zaman reject.
//   RLS enabled (postgres bypass, anon REST default-deny).
export const userStatusEnum = pgEnum('user_status', ['active', 'invited', 'inactive', 'expired_invite']);

// 2026-05-14 davet hibrit akışı — admin email veya link iki yöntem seçer (kullanıcı kararı):
//   email: Brevo SMTP ile otomatik gönderim (7 gün TTL) — şube müdürü, email aktif personel
//   link:  Admin "Davet linki üret" tıklar, token + URL kopyalar, WhatsApp/SMS ile elden gönderir (24 saat TTL, tek kullanımlık) — STAFF kasiyer
// Audit log: 'user.invited' event'inde metadata.method = 'email' | 'link'
export const userInviteMethodEnum = pgEnum('user_invite_method', ['email', 'link']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),  // SUPERADMIN için NULL
  email: varchar('email', { length: 255 }).unique().notNull(),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  passwordHash: varchar('password_hash', { length: 255 }),  // bcrypt
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  avatarUrl: text('avatar_url'),

  role: userRoleEnum('role').default('ADMIN').notNull(),  // 2026-05-14 MANTIK-HATALARI O6: tek kaynak gerçeklik. SUPERADMIN ayrı role değeri (isSuperadmin boolean kaldırıldı).
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),  // NULL=bayi sahibi, X=şube müdürü
  // isSuperadmin: KALDIRILDI (2026-05-14 O6) — role='SUPERADMIN' tek kaynak. RLS + JWT claim sadece `role` okur.

  status: userStatusEnum('status').default('active').notNull(),
  // 2026-05-14 davet hibrit akışı — iki yöntem (email Brevo otomatik / link admin elden)
  inviteToken: varchar('invite_token', { length: 100 }),                      // crypto.randomUUID() veya 12-haneli base32
  inviteMethod: userInviteMethodEnum('invite_method'),                          // NULL = davet edilmemiş
  inviteExpiresAt: timestamp('invite_expires_at', { withTimezone: true }),      // email: 7 gün, link: 24 saat
  invitedById: uuid('invited_by_id').references(() => users.id, { onDelete: 'set null' }),  // hangi admin davet etti (audit + "Yeniden Davet")

  // 2FA (TOTP — RFC 6238)
  twoFaEnabled: boolean('two_fa_enabled').default(false).notNull(),
  twoFaSecret: varchar('two_fa_secret', { length: 100 }),       // TOTP secret (column-level encryption Faz 2)
  twoFaRecoveryCodes: jsonb('two_fa_recovery_codes'),           // [{ hash: SHA256(code), usedAt: null | datetime }] × 8
  twoFaEnabledAt: timestamp('two_fa_enabled_at', { withTimezone: true }),

  // Şifre güvenliği (2026-05-14 — DEVAM-REHBERI mantık hatası #9)
  passwordChangedAt: timestamp('password_changed_at', { withTimezone: true }),
  passwordHistory: jsonb('password_history').default('[]').notNull(),  // son 3 bcrypt hash (reuse engelleme)
  passwordResetToken: varchar('password_reset_token', { length: 100 }),  // JWT jti (tek kullanımlık blacklist için)
  passwordResetExpiresAt: timestamp('password_reset_expires_at', { withTimezone: true }),

  // Brute-force koruma (2026-05-15 sıkı policy — kullanıcı kararı):
  //   5 başarısız → lockedUntil = NOW + 1 SAAT (önceki 10/15dk yetersiz görüldü)
  //   3 art arda lock → 24 SAAT kalıcı lock + acil email + 🚨 süperadmin Telegram alert
  //   2+ başarısız sonra response'da remainingAttempts döner → frontend "X hakkın kaldı" banner
  //   TOTP yanlışı sayılmaz (şifre doğru, sadece 2FA hatalı)
  //   Şifre sıfırlama tamamlandığında counter sıfırlanır + lockedUntil=NULL (kullanıcı anında giriş)
  //   pg_cron weekly: 7 gün lock olmadıysa consecutiveLockCount=0 reset
  failedLoginAttempts: integer('failed_login_attempts').default(0).notNull(),     // 0-5 arası counter
  failedLoginResetAt: timestamp('failed_login_reset_at', { withTimezone: true }),  // ⚠ deprecated (sliding window kaldırıldı, lock geçince counter sıfır)
  consecutiveLockCount: integer('consecutive_lock_count').default(0).notNull(),    // 3 art arda lock → 24h kalıcı

  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  lastLoginIp: varchar('last_login_ip', { length: 50 }),
  lastLoginUa: text('last_login_ua'),

  // Hesap kilidi — iki kaynak: brute-force AUTO, süperadmin MANUAL
  // (SUPERADMIN-YETKILERI §4.4 + EKRAN-AYARLAR §2.5.2)
  lockedUntil: timestamp('locked_until', { withTimezone: true }),  // NULL = açık, datetime = kilitli
  lockedReason: text('locked_reason'),                              // 'BRUTE_FORCE_15M', 'BRUTE_FORCE_24H', 'SUPERADMIN_MANUAL', ...

  // 2026-05-15 EKRAN-AUTH §4 Email Doğrulama akışı
  emailVerificationToken: varchar('email_verification_token', { length: 100 }),    // crypto.randomUUID()
  emailVerificationExpiresAt: timestamp('email_verification_expires_at', { withTimezone: true }),  // 24h TTL
  emailVerificationResendCount: integer('email_verification_resend_count').default(0).notNull(),   // 24h içinde max 5
  emailVerificationLastSentAt: timestamp('email_verification_last_sent_at', { withTimezone: true }), // 60sn cooldown

  // 2026-05-15 EKRAN-AUTH §6 Email Değiştirme (çift doğrulama)
  pendingEmail: varchar('pending_email', { length: 255 }),                          // yeni email, doğrulanmamış
  pendingEmailToken: varchar('pending_email_token', { length: 100 }),               // yeni email tıklama hedefi
  pendingEmailExpiresAt: timestamp('pending_email_expires_at', { withTimezone: true }), // 24h

  // 2026-05-15 EKRAN-AUTH §12 KVKK Çift Açık Rıza (zorunlu kayıt anında)
  kvkkConsentedAt: timestamp('kvkk_consented_at', { withTimezone: true }),          // Aydınlatma metni onayı (Md.10)
  dataLocationConsentedAt: timestamp('data_location_consented_at', { withTimezone: true }), // Frankfurt veri lokasyonu açık rıza (Md.9)

  // 2026-05-15 EKRAN-AUTH §8 Onboarding 3 adım wizard tamamlama
  onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }), // NULL = ilk girişte /onboarding redirect

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Auth.js v5 — Drizzle adapter standard tablolar
export const accounts = pgTable('accounts', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(),
  provider: varchar('provider', { length: 50 }).notNull(),
  providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
  refreshToken: text('refresh_token'),
  accessToken: text('access_token'),
  expiresAt: integer('expires_at'),
  tokenType: varchar('token_type', { length: 50 }),
  scope: text('scope'),
  idToken: text('id_token'),
  sessionState: text('session_state'),
}, (t) => ({
  pk: { columns: [t.provider, t.providerAccountId], name: 'accounts_pk' }
}));

export const sessions = pgTable('sessions', {
  sessionToken: varchar('session_token', { length: 255 }).primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),

  // Custom: device tracking
  ipAddress: varchar('ip_address', { length: 50 }),
  userAgent: text('user_agent'),
  deviceLabel: varchar('device_label', { length: 100 }),  // "Chrome on Windows"
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).defaultNow(),
});

export const verificationTokens = pgTable('verification_tokens', {
  identifier: varchar('identifier', { length: 255 }).notNull(),
  token: varchar('token', { length: 255 }).notNull(),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
}, (t) => ({
  pk: { columns: [t.identifier, t.token], name: 'vt_pk' }
}));
```

### 3.2 Şube & Stok

```ts
// db/schema/branch.ts
export const branchTypeEnum = pgEnum('branch_type', ['MAIN', 'BRANCH']);

export const branches = pgTable('branches', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  type: branchTypeEnum('type').default('BRANCH').notNull(),
  managerId: uuid('manager_id').references(() => users.id, { onDelete: 'set null' }),
  isActive: boolean('is_active').default(true).notNull(),

  // Adres — FK ile il/ilçe (cities + districts seed, Bölüm 3.7)
  cityId: integer('city_id').references(() => cities.id),
  districtId: integer('district_id').references(() => districts.id),
  addressLine: text('address_line'),
  postalCode: varchar('postal_code', { length: 10 }),

  // Konum (vitrin haritası ve "en yakın pet shop" sıralama için — PostGIS)
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),

  // İletişim
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 255 }),
  workingHours: jsonb('working_hours'),  // { mon: '09:00-19:00', ... }

  // Şube başına WhatsApp opsiyonel (default tenant seviyesindeki kullanılır — 2026-05-13)
  whatsappPhone: varchar('whatsapp_phone', { length: 20 }),

  description: text('description'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const branchInventory = pgTable('branch_inventory', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').notNull().references(() => branches.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').notNull().references(() => productVariants.id, { onDelete: 'cascade' }),

  stockQty: integer('stock_qty').default(0).notNull(),
  expiryDate: date('expiry_date'),  // SKT
  lotNumber: varchar('lot_number', { length: 100 }),

  // Stats (background job ile güncellenir)
  lastSoldAt: timestamp('last_sold_at', { withTimezone: true }),
  lastReceivedAt: timestamp('last_received_at', { withTimezone: true }),
  totalSoldQty: integer('total_sold_qty').default(0).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  unique: { columns: [t.branchId, t.variantId], name: 'branch_inventory_unique' },
}));

// Currency rate cache (Frankfurter API)
// MANTIK-HATALARI-2026-05-14 O5: TR-only kararı sonrası Frankfurter API kaldırıldı.
// Bu tablo MVP migration'da OLUŞTURULMAZ — drizzle-kit migration generate edilirken atla.
// Faz 2'de yurt dışı + multi-currency açılışında ayrı migration eklenir.
// Schema dosyasında tutuyoruz ki type referansı (currencyRates type'ı kullanılan yerler hâlâ derlensin)
// ve schema diff temiz görünsün — sadece DB'ye gitmiyor.
// drizzle.config.ts: `schemaFilter: (tableName) => tableName !== 'currency_rates'`
export const currencyRates = pgTable('currency_rates', {
  base: varchar('base', { length: 3 }).notNull(),    // TRY
  target: varchar('target', { length: 3 }).notNull(), // USD, EUR
  rate: decimal('rate', { precision: 10, scale: 6 }).notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  pk: { columns: [t.base, t.target] },
}));
```

### 3.3 Katalog

```ts
// db/schema/catalog.ts
export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id').references(() => categories.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  emoji: varchar('emoji', { length: 10 }),
  displayOrder: integer('display_order').default(0).notNull(),
  vatRate: decimal('vat_rate', { precision: 5, scale: 2 }),  // 2026-05-14 OT2-2: %1 (özel), %10 (gıda), %20 (genel — TR 2024 sonrası). Tek kaynak: lib/constants/vat-rates.ts
  sktRequired: boolean('skt_required').default(false).notNull(),  // mama/ilaç → true
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  unique: { columns: [t.companyId, t.slug] },
}));

export const brands = pgTable('brands', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  logoUrl: text('logo_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  unique: { columns: [t.companyId, t.slug] },
}));

export const animalTypeEnum = pgEnum('animal_type', ['cat', 'dog', 'bird', 'fish', 'rabbit', 'reptile', 'other']);

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),  // vitrin URL için
  description: text('description'),  // markdown
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'set null' }),
  animalTypes: jsonb('animal_types').default('[]').notNull(),  // ['cat', 'dog']
  tags: jsonb('tags').default('[]').notNull(),  // ['yetişkin', 'kuru-mama']
  isActive: boolean('is_active').default(true).notNull(),
  isPublished: boolean('is_published').default(true).notNull(),  // taslak için
  isFeatured: boolean('is_featured').default(false).notNull(),  // vitrin öne çıkan
  adminNote: text('admin_note'),  // sadece admin görür

  // Satışa Aç toggle + Doğrula validation gate (2026-05-13 kararı)
  // Pet shop sahibi sadece stok takip için kullanıyorsa vitrin'e açma zorunlu değil.
  // "Satışa Aç" toggle açıldığında backend validation çalışır:
  //   - En az 1 görsel
  //   - Satış fiyatı > 0 ve makul aralık (1₺-50000₺)
  //   - Ad min 3 karakter
  //   - Kategori atanmış
  //   - Tenant vergi no'su dolu (yoksa vergi no modal'ı açılır)
  // Validation pass → "Doğrula" butonu enable → vitrinPublished = true
  //
  // KAPSAM (2026-05-14 — DEVAM-REHBERI mantık hatası #4 düzeltmesi):
  //   vitrinPublished PARENT-LEVEL'dır (productVariants'ta YOK).
  //   Parent on → tüm AKTİF (productVariants.isActive=true) variant'lar vitrin'de.
  //   Bir variant'ı vitrin'den çıkarmak istiyorsan productVariants.isActive=false yap.
  //   Variant bazlı vitrin toggle'ı YOK (Faz 2'ye saklandı — 150 toggle UX riski yüksek).
  //   Senaryo: "Royal Canin 400g'ı satmak istemiyorum, sadece 2kg ve 10kg" →
  //            productVariants(400g).isActive = false → vitrin'de 2kg + 10kg gösterilir.
  vitrinPublished: boolean('vitrin_published').default(false).notNull(),
  vitrinPublishedAt: timestamp('vitrin_published_at', { withTimezone: true }),
  vitrinPublishedById: uuid('vitrin_published_by_id').references(() => users.id, { onDelete: 'set null' }),

  // Stok 0 → otomatik vitrin'den çekme (2026-05-13 kararı)
  // Trigger: branchInventory toplam stok = 0 olduğunda
  //   - vitrinPublished = false
  //   - vitrinAutoUnpublishedAt = now
  //   - vitrinAutoUnpublishedReason = 'STOCK_OUT'
  //   - Telegram + ekran bildirim gönderilir
  //   - Manuel "Satışa Aç" toggle ile geri açılır (otomatik açılmaz, kontrol kullanıcıda)
  vitrinAutoUnpublishedAt: timestamp('vitrin_auto_unpublished_at', { withTimezone: true }),
  vitrinAutoUnpublishedReason: varchar('vitrin_auto_unpublished_reason', { length: 50 }),  // 'STOCK_OUT', 'POLICY_VIOLATION', ...

  // Stats (denormalize, background job)
  totalStockQty: integer('total_stock_qty').default(0).notNull(),  // tüm şube + variant toplam
  lastSupplierId: uuid('last_supplier_id'),  // son alımdaki tedarikçi (öneri için)

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  unique: { columns: [t.companyId, t.slug] },
}));

export const productVariants = pgTable('product_variants', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),

  axisLabel: varchar('axis_label', { length: 50 }).default('Boyut').notNull(),  // MVP'de tek axis: "Boyut/Ambalaj"
  valueLabel: varchar('value_label', { length: 50 }).notNull(),  // "2kg", "400g"

  sku: varchar('sku', { length: 100 }).notNull(),  // global UNIQUE (per tenant)
  barcode: varchar('barcode', { length: 13 }),  // EAN-13

  costPrice: decimal('cost_price', { precision: 10, scale: 2 }).default('0').notNull(),
  salePrice: decimal('sale_price', { precision: 10, scale: 2 }).default('0').notNull(),

  threshold: integer('threshold').default(5).notNull(),  // genel eşik
  branchThresholds: jsonb('branch_thresholds'),  // { branchId: number } şube bazlı override

  isActive: boolean('is_active').default(true).notNull(),
  isDefault: boolean('is_default').default(false).notNull(),  // varyantsız ürünler için tek default variant
  displayOrder: integer('display_order').default(0).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniqueSku: { columns: [t.companyId, t.sku] },
}));

export const productImages = pgTable('product_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  isPrimary: boolean('is_primary').default(false).notNull(),
  displayOrder: integer('display_order').default(0).notNull(),
  altText: varchar('alt_text', { length: 200 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### 3.4 Operasyon

```ts
// db/schema/operations.ts
export const movementTypeEnum = pgEnum('movement_type', ['stock_in', 'stock_out', 'transfer', 'stocktake', 'stocktake_initial']);
export const movementSubtypeEnum = pgEnum('movement_subtype', ['sale', 'waste', 'gift', 'sample', 'return', 'internal_use', 'other']);
// 2026-05-14 MANTIK-HATALARI S2: 'credit' = veresiye (vadeli satış). MVP'de aktif ama customer_ref zorunlu.
//   payment_method='credit' → customer_ref NULL OLAMAZ (DB CHECK).
//   "Açık Krediler" raporu (EKRAN-RAPORLAR §) müşteri başına bekleyen borç toplamı.
//   Faz 3'te müşteri DB (customers tablosu) eklenince customer_ref → customer_id FK olarak refactor.
export const paymentMethodEnum = pgEnum('payment_method', ['cash', 'card', 'bank_transfer', 'credit']);
export const stocktakeReasonEnum = pgEnum('stocktake_reason', ['loss', 'overage', 'wrong_entry', 'expired', 'damage', 'theft', 'other']);
export const transferStatusEnum = pgEnum('transfer_status', ['in_transit', 'received']);

export const stockMovements = pgTable('stock_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),
  branchId: uuid('branch_id').notNull().references(() => branches.id, { onDelete: 'restrict' }),
  variantId: uuid('variant_id').notNull().references(() => productVariants.id, { onDelete: 'restrict' }),

  type: movementTypeEnum('type').notNull(),
  subtype: movementSubtypeEnum('subtype'),  // sadece stock_out için

  quantity: integer('quantity').notNull(),  // + giriş, - çıkış
  beforeQty: integer('before_qty').notNull(),
  afterQty: integer('after_qty').notNull(),

  unitCost: decimal('unit_cost', { precision: 10, scale: 2 }),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }),
  discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }),

  // Bağlam (tipe göre dolar)
  supplierId: uuid('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),  // stock_in
  customerRef: varchar('customer_ref', { length: 100 }),  // sale - "Misafir alıcı" veya telefon/ad (credit ise ZORUNLU - S2)
  paymentMethod: paymentMethodEnum('payment_method'),    // sale
  // CHECK constraint: payment_method = 'credit' → customer_ref IS NOT NULL (Sprint 4 migration'da)
  creditPaidAt: timestamp('credit_paid_at', { withTimezone: true }),  // 2026-05-14 S2: veresiye kapama zamanı (NULL = açık kredi)
  documentNo: varchar('document_no', { length: 100 }),  // irsaliye no
  lotNumber: varchar('lot_number', { length: 100 }),
  expiryDate: date('expiry_date'),

  reason: text('reason'),  // serbest metin (waste/sebepleri)
  stocktakeReason: stocktakeReasonEnum('stocktake_reason'),  // sayım için
  note: text('note'),

  // Transfer için
  transferGroupId: uuid('transfer_group_id'),  // kaynak + hedef entry'leri bağlamak
  transferTargetBranchId: uuid('transfer_target_branch_id').references(() => branches.id, { onDelete: 'set null' }),
  transferStatus: transferStatusEnum('transfer_status'),

  // Sayım için
  stocktakeId: uuid('stocktake_id').references(() => stocktakes.id, { onDelete: 'restrict' }),

  // Geri alma (reversal)
  reversesId: uuid('reverses_id'),  // başka entry'yi geri alıyorsa
  reversedById: uuid('reversed_by_id'),  // bu entry geri alındıysa hangi entry geri aldı

  // Audit
  createdById: uuid('created_by_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  performedAsSuperadmin: boolean('performed_as_superadmin').default(false).notNull(),
  superadminSessionId: uuid('superadmin_session_id'),
  ipAddress: varchar('ip_address', { length: 50 }),
  userAgent: text('user_agent'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  // updatedAt YOK — immutable
});

// stock_movements UPDATE/DELETE bloklanır (trigger ile §6.1)

export const stocktakeStatusEnum = pgEnum('stocktake_status', ['in_progress', 'waiting', 'completed', 'cancelled']);
export const stocktakeModeEnum = pgEnum('stocktake_mode', ['full', 'category', 'manual']);

export const stocktakes = pgTable('stocktakes', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').notNull().references(() => branches.id, { onDelete: 'restrict' }),
  mode: stocktakeModeEnum('mode').notNull(),
  categoryId: uuid('category_id'),  // kategori modunda
  softLock: boolean('soft_lock').default(true).notNull(),
  status: stocktakeStatusEnum('status').default('in_progress').notNull(),

  totalItems: integer('total_items').default(0).notNull(),
  countedItems: integer('counted_items').default(0).notNull(),
  diffItems: integer('diff_items').default(0).notNull(),
  valueImpact: decimal('value_impact', { precision: 12, scale: 2 }),  // cost-based

  note: text('note'),
  startedById: uuid('started_by_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
});

export const stocktakeItems = pgTable('stocktake_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  stocktakeId: uuid('stocktake_id').notNull().references(() => stocktakes.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').notNull().references(() => productVariants.id, { onDelete: 'restrict' }),

  systemQty: integer('system_qty').notNull(),  // sayım başlangıcında snapshot
  countedQty: integer('counted_qty'),  // kullanıcı girer
  diff: integer('diff'),  // counted - system
  reason: stocktakeReasonEnum('reason'),
  customReason: text('custom_reason'),  // "Diğer" için
  isSkipped: boolean('is_skipped').default(false).notNull(),

  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const supplierPaymentTermsEnum = pgEnum('supplier_payment_terms', ['cash', 'net_30', 'net_60', 'other']);

export const suppliers = pgTable('suppliers', {
  id: uuid('id').primaryKey().defaultRandom(),
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

  leadTimeDays: integer('lead_time_days').default(7).notNull(),
  paymentTerms: supplierPaymentTermsEnum('payment_terms').default('net_30').notNull(),
  iban: varchar('iban', { length: 34 }),

  isActive: boolean('is_active').default(true).notNull(),
  note: text('note'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### 3.5 Sistem

```ts
// db/schema/system.ts
// 2026-05-14 MANTIK-HATALARI S3: auditAction artık varchar(100) string — enum yerine.
//   Yeni özellik eklenince migration gerekmez (esneklik).
//   Pattern: `<entity>.<action>` (örn. 'product.create', 'superadmin.bypass.hard_delete', 'sale.credit_settled')
//   Performans kaybı ihmal (idx_audit_logs_action B-tree çalışır).
//   Aşağıda **kullanılan action listesi referans** olarak — derleme zorunluluğu YOK, sadece dokümantasyon.
// const KNOWN_AUDIT_ACTIONS = [
//   'user.login', 'user.logout', 'user.create', 'user.update', 'user.delete',
//   'user.role_change', 'user.password_reset', 'user.2fa_enable', 'user.2fa_disable',
//   'company.create', 'company.update', 'company.suspend', 'company.delete',
//   'plan.upgrade', 'plan.downgrade', 'plan.cancel',
//   'product.create', 'product.update', 'product.archive', 'product.restore',
//   'branch.create', 'branch.update', 'branch.deactivate',
//   'stock_movement.create', 'stock_movement.reverse',
//   'stocktake.start', 'stocktake.complete', 'stocktake.cancel',
//   'supplier.create', 'supplier.update', 'supplier.deactivate',
//   'storefront.publish', 'storefront.theme_change', 'storefront.auto_approved',
//   'superadmin.impersonate_start', 'superadmin.impersonate_end',
//   'superadmin.bypass.hard_delete', 'superadmin.bypass.expired_reversal',
//   'superadmin.bypass.plan_limit_override', 'superadmin.bypass.negative_stock',
//   'superadmin.bypass.stocktake_undo',
//   'sale.credit_settled', 'data.export', 'account.delete_request',
// ] as const;
// type AuditAction = typeof KNOWN_AUDIT_ACTIONS[number] | (string & {});  // bilinen + serbest string

// Süperadmin override action type (SUPERADMIN-YETKILERI.md §4)
export const superadminActionTypeEnum = pgEnum('superadmin_action_type', [
  'impersonation',  // sıradan tenant'a giriş
  'bypass',         // sistem kuralı bypass (24h, hard delete, eksi stok, plan limit)
  'dbfix',          // DB Inspector ile veri düzeltme
  'system',         // sistem-level config değişikliği
  'user',           // uzak kullanıcı yönetimi (şifre/2FA/oturum/kilit)
]);

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),  // SUPERADMIN sistem aksiyonu için NULL
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),

  action: varchar('action', { length: 100 }).notNull(),  // 2026-05-14 S3: enum yerine string (esneklik için, yukarıdaki referans listesini takip et)
  entityType: varchar('entity_type', { length: 50 }),
  entityId: uuid('entity_id'),

  beforeState: jsonb('before_state'),
  afterState: jsonb('after_state'),

  ipAddress: varchar('ip_address', { length: 50 }),
  userAgent: text('user_agent'),

  performedAsSuperadmin: boolean('performed_as_superadmin').default(false).notNull(),
  superadminSessionId: uuid('superadmin_session_id'),
  superadminActionType: superadminActionTypeEnum('superadmin_action_type'),  // YENİ
  superadminReason: text('superadmin_reason'),
  superadminSilent: boolean('superadmin_silent'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  // updatedAt YOK — immutable (R3 basit log + override audit kapsamı)
});

// Sistem-level konfigurasyon (süperadmin sistem ayarları)
export const systemSettings = pgTable('system_settings', {
  key: varchar('key', { length: 100 }).primaryKey(),    // örn 'plan.free.product_limit', 'feature.realtime'
  value: jsonb('value').notNull(),                        // primitive veya object
  category: varchar('category', { length: 50 }).notNull(),// 'plan' | 'feature' | 'email' | 'telegram' | 'broadcast'
  description: text('description'),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Sistem broadcast mesajları (tüm tenant'lara)
export const systemBroadcasts = pgTable('system_broadcasts', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 200 }).notNull(),
  body: text('body').notNull(),                            // markdown
  targetType: varchar('target_type', { length: 30 }).notNull(),  // 'all' | 'plan' | 'tenant_list'
  targetFilter: jsonb('target_filter'),                    // { plans: ['PRO'] } veya { tenantIds: [...] }
  channels: jsonb('channels').notNull(),                    // ['banner', 'telegram', 'email']
  validFrom: timestamp('valid_from', { withTimezone: true }).defaultNow().notNull(),
  validUntil: timestamp('valid_until', { withTimezone: true }),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const notificationTypeEnum = pgEnum('notification_type', [
  'low_stock_critical', 'out_of_stock', 'high_sale', 'new_user',
  'plan_limit_warning', 'daily_summary', 'weekly_summary',
  'transfer_received', 'stocktake_completed', 'superadmin_session',
  // 2026-05-14 MANTIK-HATALARI OT2-1 — abonelik/vitrin/şikayet/fatura event'leri eklendi:
  'subscription_payment_failed',  // iyzico past_due → tenant'a Telegram + e-posta
  'subscription_renewed',         // başarılı tahsilat → tenant'a teşekkür mesajı
  'invoice_issued',               // Nilvera e-Arşiv kesildi → tenant'a fatura linki
  'vitrin_approved',              // otomatik onay sonrası → "✓ Vitrin'in yayında" Telegram
  'vitrin_report_received',       // müşteri şikayeti → süperadmin'e Telegram (anomali tespiti)
  'vitrin_auto_unpublished',      // stok 0 → tenant'a "Vitrin'den çekildi, satışa aç toggle ile geri aç" Telegram
]);

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),  // NULL = tüm tenant'a
  type: notificationTypeEnum('type').notNull(),
  channel: varchar('channel', { length: 20 }).notNull(),  // 'screen', 'telegram', 'email'
  content: jsonb('content').notNull(),  // { title, body, link, ... }
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const telegramBindings = pgTable('telegram_bindings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  chatId: varchar('chat_id', { length: 50 }).notNull(),
  telegramUsername: varchar('telegram_username', { length: 100 }),
  bindingCode: varchar('binding_code', { length: 10 }),  // 6-haneli kod, expire eder
  bindingExpiresAt: timestamp('binding_expires_at', { withTimezone: true }),
  boundAt: timestamp('bound_at', { withTimezone: true }),
  testedAt: timestamp('tested_at', { withTimezone: true }),
});

// ─────────────────────────────────────────────────────────────────────
// SYSTEM ERRORS — 2026-05-15 Monitoring & Observability Stratejisi
// ─────────────────────────────────────────────────────────────────────
// DEPLOYMENT.md §8.5 hata izleme pattern + EKRAN-SUPERADMIN §1.1 KPI dashboard
// hata feed kaynağı. Workers Logs + Edge Function exception'ları yapısal kayıt.
// Sentry'ye alternatif (TECH-STACK §6 + DEPLOYMENT §8.7 — Grafana/Sentry neden yok).
// Retention: pg_cron 90 gün cleanup (kritik hatalar için yeterli — eski hatalar audit_logs'ta zaten var).

export const systemErrorSeverityEnum = pgEnum('system_error_severity', [
  'info',       // Bilgi (deprecation uyarısı, slow query >1sn vb.)
  'warning',    // Uyarı (rate-limit, validation fail, retry success)
  'error',      // Hata (5xx, exception caught + handled)
  'critical'    // Kritik (DB connection lost, payment fail, security breach attempt)
]);

export const systemErrors = pgTable('system_errors', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Konum
  route: varchar('route', { length: 500 }).notNull(),           // örn: "POST /api/admin/users/invite"
  workerRequestId: varchar('worker_request_id', { length: 100 }), // CF Workers Ray ID — log korelasyonu
  environment: varchar('environment', { length: 20 }).default('production').notNull(),  // production/staging

  // Hata içeriği
  severity: systemErrorSeverityEnum('severity').default('error').notNull(),
  errorName: varchar('error_name', { length: 200 }).notNull(),   // örn: "DatabaseError" / "RateLimitExceeded"
  errorMessage: text('error_message').notNull(),
  stack: text('stack'),                                            // opsiyonel — büyük stack trace

  // Bağlam (forensics + tenant izolasyonu için)
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),  // anonim hata varsa NULL
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),

  // İstek metadata
  userAgent: text('user_agent'),
  ipHash: varchar('ip_hash', { length: 64 }),                    // SHA256 hash (KVKK — IP doğrudan tutulmaz)
  countryCode: varchar('country_code', { length: 2 }),           // CF geo header'dan

  // Ek metadata (esnek)
  metadata: jsonb('metadata'),                                     // { requestBody?, query?, headers? }

  // Süperadmin müdahale
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  acknowledgedById: uuid('acknowledged_by_id').references(() => users.id, { onDelete: 'set null' }),
  resolutionNote: text('resolution_note'),                        // süperadmin "şu sebepten oldu, çözüldü" notu

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Index'ler (KPI dashboard sorgu performansı)
//   CREATE INDEX idx_system_errors_severity_date ON system_errors(severity, created_at DESC);  -- süperadmin filter
//   CREATE INDEX idx_system_errors_company ON system_errors(company_id, created_at DESC) WHERE company_id IS NOT NULL;  -- tenant bazlı debug
//   CREATE INDEX idx_system_errors_unacknowledged ON system_errors(created_at DESC) WHERE acknowledged_at IS NULL;  -- "okunmamış" hata feed

// RLS: §4.3'te POLICY tanımlı — sadece SUPERADMIN okur+yazar. Tenant kendi hatalarını GÖREMEZ
// (forensics — kullanıcı hatalı request gönderirse stack trace görmemeli, güvenlik).

// Retention (90 gün) — PLAN-BETA-PERFORMANCE.md Faz 2.A ile aktive olur.
// Workers cron 04:00 UTC `/api/cron/cleanup-old-logs` endpoint günlük tetiklenir.
// Implementation: `src/lib/cleanup/retention.ts` RETENTION_RULES tablosu:
//   { table: 'system_errors', ageDays: 90, description: 'Hata izleme retention' }
// Test: `retention.test.ts` audit_logs / invoices ASLA bu listede olmaması doğrulanır.
//
// Error tracking helper: `src/lib/errors/track.ts` — `trackError(err, context, db)` PII strip + INSERT
// Threshold burst alert: 60dk içinde 5+ aynı errorType → critical Telegram (`buildErrorBurstAlert`)
// 6h dedup penceresi (anti-spam). Detay: PLAN-BETA Faz 2.B.

// Plan onay (manuel havale)
export const planApprovalStatusEnum = pgEnum('plan_approval_status', ['pending', 'approved', 'rejected']);

export const planApprovalRequests = pgTable('plan_approval_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  fromPlan: planEnum('from_plan').notNull(),
  toPlan: planEnum('to_plan').notNull(),
  requestedById: uuid('requested_by_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  requestMessage: text('request_message'),
  receiptUrl: text('receipt_url'),  // dekont PDF/image URL
  status: planApprovalStatusEnum('status').default('pending').notNull(),
  reviewedById: uuid('reviewed_by_id').references(() => users.id, { onDelete: 'set null' }),  // SUPERADMIN
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// KVKK veri export async job
// MANTIK-HATALARI-2026-05-14 K4 — DDoS koruma politikası (sıkı):
//   1. UI'da min 1 checkbox zorunlu (HTML form validation)
//   2. Backend: tables.length === 0 → 400 Bad Request (Server Action validate)
//   3. Rate-limit (Cloudflare Workers KV):
//      - max 3 export request / tenant / gün
//      - max 1 request / tenant / saat (cooldown)
//   4. Max output size 10MB (Edge Function streaming + size check)
//   5. Queue priority: FREE tier düşük, PRO orta, PRO+ yüksek (Supabase Edge Function pg-boss veya pg_cron)
//   6. Aynı anda max 3 aktif job (status='queued' OR 'processing') — 4. talep 400 Bad Request
//   7. expiresAt = createdAt + 24 saat (download link 24 saat aktif, sonra Storage'dan silinir)
export const dataExportJobs = pgTable('data_export_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  requestedById: uuid('requested_by_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  tables: jsonb('tables').notNull(),  // ['products', 'movements', ...] — boş array DB CHECK ile yasak (aşağı bak)
  status: varchar('status', { length: 20 }).default('queued').notNull(),  // queued/processing/ready/expired/failed
  fileSizeBytes: integer('file_size_bytes'),                                // tamamlanma sonrası — 10MB üstü reddedilir
  downloadUrl: text('download_url'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),               // 24 saat
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  errorMessage: text('error_message'),                                      // status='failed' detayı
}, (t) => ({
  // DB-level minimum güvence (UI/backend validation eksilirse bile çalışır)
  tablesNotEmpty: { check: `jsonb_array_length(${t.tables}) > 0`, name: 'data_export_tables_not_empty' },
}));

// Index — rate-limit sorgusu için (her tenant'ın son 24h job sayısı)
// CREATE INDEX idx_export_jobs_company_created ON data_export_jobs(company_id, created_at DESC);
```

### 3.6 Public Vitrin

```ts
// db/schema/storefront.ts
export const storefrontSettings = pgTable('storefront_settings', {
  companyId: uuid('company_id').primaryKey().references(() => companies.id, { onDelete: 'cascade' }),

  isEnabled: boolean('is_enabled').default(true).notNull(),
  theme: varchar('theme', { length: 50 }).default('classic-pet').notNull(),

  heroSlogan: varchar('hero_slogan', { length: 200 }),
  heroBannerUrl: text('hero_banner_url'),

  infoBoxes: jsonb('info_boxes'),  // [{icon, title, desc}, ...] max 3

  aboutContent: text('about_content'),  // markdown
  aboutImageUrl: text('about_image_url'),

  stockVisibility: varchar('stock_visibility', { length: 20 }).default('level').notNull(),  // 'level', 'exact', 'hidden'

  // İletişim
  contactPhone: varchar('contact_phone', { length: 20 }),
  contactWhatsapp: varchar('contact_whatsapp', { length: 20 }),
  contactTelegram: varchar('contact_telegram', { length: 100 }),
  contactEmail: varchar('contact_email', { length: 255 }),

  // Sosyal medya
  socialInstagram: varchar('social_instagram', { length: 100 }),
  socialFacebook: varchar('social_facebook', { length: 100 }),
  socialTwitter: varchar('social_twitter', { length: 100 }),
  socialTiktok: varchar('social_tiktok', { length: 100 }),

  // SEO
  metaDescription: text('meta_description'),
  ogImageUrl: text('og_image_url'),

  // Custom domain — KALDIRILDI (2026-05-13, PRO+ rafa kararı)

  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const storefrontMessages = pgTable('storefront_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  subject: varchar('subject', { length: 100 }),
  message: text('message').notNull(),
  ipAddress: varchar('ip_address', { length: 50 }),
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### 3.7 Konum (Cities + Districts) — 2026-05-13 eklendi

Türkiye il/ilçe lookup tabloları. Frontend mevcut `client/src/data/turkeyDistricts.ts` (eski Pet/ projesinden) backend'e seed edilir. SEO URL'leri (`/vitrin/[il]/[ilce]`) ve "en yakın pet shop" sıralaması için temel.

```ts
// db/schema/location.ts
import { pgTable, integer, smallint, varchar } from 'drizzle-orm/pg-core';

export const cities = pgTable('cities', {
  id: integer('id').primaryKey(),                            // 1-81 (plaka değil, sıralı id)
  name: varchar('name', { length: 50 }).notNull(),           // "İstanbul"
  slug: varchar('slug', { length: 50 }).unique().notNull(),  // "istanbul" (SEO URL)
  plateCode: smallint('plate_code').unique(),                // 34, 06, 35 (Türkiye plaka)
});

export const districts = pgTable('districts', {
  id: integer('id').primaryKey(),
  cityId: integer('city_id').notNull().references(() => cities.id),
  name: varchar('name', { length: 50 }).notNull(),           // "Üsküdar"
  slug: varchar('slug', { length: 60 }).notNull(),           // "uskudar"
}, (t) => ({
  uniqueCitySlug: { columns: [t.cityId, t.slug], name: 'districts_city_slug_unique' },
}));
```

**Seed migration (`drizzle/seed/cities_districts.sql`):** 81 il + ~970 ilçe `turkeyDistricts.ts` formatından dönüştürülür. Mahalle TUTULMUYOR (vitrin için ilçe yeter, ürün miktarı az pet shop sektöründe).

**Index:**
```sql
CREATE INDEX idx_districts_city ON districts(city_id);
CREATE INDEX idx_cities_slug ON cities(slug);
CREATE INDEX idx_districts_slug ON districts(city_id, slug);
```

**Konum tespiti stratejisi (vitrin tarafı):**
1. URL'den (en kesin) — `/vitrin/istanbul/uskudar`
2. Browser Geolocation API (kullanıcı izniyle) — kesin koordinat
3. IP-based fallback (MaxMind GeoLite2, ücretsiz) — şehir seviyesi
4. Reddedilirse: il/ilçe centroid varsayılan (`postgis` ile lat/lng hesaplanır)

**PostGIS extension:** Aiven yerine **Supabase'te aktive edilir** (SUPABASE-SETUP.md). Yakınlık sorgusu (`ST_Distance`, `ST_DWithin`) için. Branch lat/lng zaten var (Bölüm 3.2), pet shop yakınlık sıralaması için yeterli.

### 3.8 Vitrin Metrikleri (Vitrin Events) — 2026-05-13 eklendi, 2026-05-14 4-etiket revize

Pet shop sahibinin "vitrin işime yarıyor mu?" sorusunun cevabı için event tracking. **DEVAM-REHBERI mantık hatası #3 düzeltmesi:** Tek "view" event yetersiz — profil/ürün/listede gösterilme/WhatsApp ayrı ölçülmeli yoksa "47 görüntüleme" anlamsız.

**4 ana etiket (pet shop admin'inin göreceği):**

| Event | UI etiketi | Anlam | Conversion değeri |
|---|---|---|---|
| `profile_view` | 👁 Profil görüntüleme | `/vitrin/magaza/[slug]` ziyareti — müşteri pet shop'u açtı | Orta |
| `product_view` | 🛍 Ürün görüntüleme | Pet shop'un bir ürünü detayda açıldı | Yüksek |
| `listing_impression` | 🔍 Listede gösterilme | Aramada/kategoride/yakınımda listelendi (görüntülenmedi, sadece exposure) | Düşük (top-of-funnel) |
| `whatsapp_click` | 📞 WhatsApp tıklama | `wa.me/...` deep link tıklandı — **en kıymetli conversion metric** | Çok yüksek |

```ts
// db/schema/vitrin-metrics.ts
export const vitrinEventTypeEnum = pgEnum('vitrin_event_type', [
  'home_view',           // vitrin anasayfası (petstockpro.com/vitrin) — tenant'a atfedilmez
  'profile_view',        // pet shop profili (/vitrin/magaza/[slug]) ziyareti — 2026-05-14 eklendi
  'product_view',        // ürün detay sayfası görüntüleme
  'listing_impression',  // pet shop ürünü aramada/kategoride listelendi — 2026-05-14 eklendi
  'category_view',       // kategori sayfası genel ziyareti (tenant'a atfedilmez)
  'whatsapp_click',      // 📞 WhatsApp deep link tıklama — BEST CONVERSION METRIC
  'phone_click',         // telefon tıklama
  'telegram_click',      // Telegram tıklama (admin paneline bildirim — müşteri tarafında görünmez)
  'directions_click',    // Google Maps "Yol tarifi al" deep link tıklama
  'search',              // vitrin'de arama yapılması (tenant'a atfedilmez)
  // 2026-05-15 WhatsApp Geri Bildirim Balonu (EKRAN-PUBLIC-VITRIN §17 + DEPLOYMENT §8.3)
  'feedback_balloon_shown',     // Sticky balon WhatsApp tıklamadan 5 sn sonra slide-up oldu
  'feedback_submitted',         // Radio tıklandı → vitrin_whatsapp_feedback INSERT (single tap)
  'feedback_closed_manually',   // Müşteri × ile balonu kapattı (rating yok, "ilgilenmiyorum" sinyali)
  'feedback_dismissed',         // Müşteri sayfayı kapadı, balon görmezden gelindi (beforeunload sendBeacon)
]);

export const vitrinEvents = pgTable('vitrin_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'cascade' }),

  eventType: vitrinEventTypeEnum('event_type').notNull(),

  // Ziyaretçi bilgisi (anonim — KVKK uyumlu IP hash)
  visitorIpHash: varchar('visitor_ip_hash', { length: 64 }),       // SHA256(IP + daily_salt)
  visitorCityId: integer('visitor_city_id').references(() => cities.id),
  visitorCountry: varchar('visitor_country', { length: 2 }),       // ISO 3166-1
  userAgent: text('user_agent'),
  referrerUrl: text('referrer_url'),
  searchQuery: text('search_query'),                                // event_type='search' için

  // UTM tracking (Faz 2 reklam kampanyası ölçümü için)
  utmSource: varchar('utm_source', { length: 50 }),
  utmMedium: varchar('utm_medium', { length: 50 }),
  utmCampaign: varchar('utm_campaign', { length: 50 }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

**Index (yüksek hacim için kritik):**
```sql
CREATE INDEX idx_vitrin_events_company_date ON vitrin_events(company_id, created_at DESC);
CREATE INDEX idx_vitrin_events_company_type_date ON vitrin_events(company_id, event_type, created_at DESC);
CREATE INDEX idx_vitrin_events_product ON vitrin_events(product_id, created_at DESC) WHERE product_id IS NOT NULL;
```

**Partitioning (Faz 2):** Aylık partition (`pg_partman`) — büyük tenant'larda performans için. `created_at` PARTITION BY RANGE.

**Realtime aggregation:** Pet shop admin'i Vitrin Metrikleri ekranında bugünkü görüntüleme + WhatsApp tıklama görmek ister. Materialized view + 5dk refresh:

```sql
CREATE MATERIALIZED VIEW mv_vitrin_daily_metrics AS
SELECT
  company_id,
  product_id,
  DATE_TRUNC('day', created_at) AS day,
  -- 4 ana etiket (2026-05-14 revize)
  COUNT(*) FILTER (WHERE event_type = 'profile_view')        AS profile_views,
  COUNT(*) FILTER (WHERE event_type = 'product_view')        AS product_views,
  COUNT(*) FILTER (WHERE event_type = 'listing_impression')  AS listing_impressions,
  COUNT(*) FILTER (WHERE event_type = 'whatsapp_click')      AS whatsapp_clicks,
  -- Ek (telefon/yol tarifi)
  COUNT(*) FILTER (WHERE event_type = 'phone_click')         AS phone_clicks,
  COUNT(*) FILTER (WHERE event_type = 'directions_click')    AS directions_clicks
FROM vitrin_events
WHERE created_at > NOW() - INTERVAL '90 days'
GROUP BY company_id, product_id, DATE_TRUNC('day', created_at);

-- pg_cron ile 5 dakikada bir refresh
SELECT cron.schedule('refresh_vitrin_metrics', '*/5 * * * *',
  $$ REFRESH MATERIALIZED VIEW CONCURRENTLY mv_vitrin_daily_metrics; $$);
```

### 3.8.1 WhatsApp Geri Bildirim Balonu — 2026-05-15

> **Karar (2026-05-15):** Müşteri vitrin'de WhatsApp tıkladıktan sonra sağ alt sticky balon belirir, **5 emoji seçenek** sunar, müşteri **tek tıklama** ile rating verir, balon yavaşça kapanır. Submit butonu YOK, dış tıklama dismiss etmez (manuel × veya rating). Yorum opsiyonu MVP'de YOK (Faz 2'ye saklı). Detay UX: `EKRAN-PUBLIC-VITRIN.md §17`.

```ts
// db/schema/vitrin-feedback.ts

// 5 emoji seçenek (Q1 "görüşme yapıldı mı" + Q2 "kalite" birleşik)
export const feedbackRatingEnum = pgEnum('feedback_rating', [
  'very_good',   // 😊 Çok iyi (hızlı ulaştı + ilgilendi)
  'good',        // 🙂 İyi (cevap aldım, sorum çözüldü)
  'neutral',     // 😐 Orta (yarım kaldı, eksik kaldı)
  'bad',         // 😕 Kötü (geç cevap veya ilgilenmediler)
  'unreached',   // 😞 Hiç ulaşamadım (cevap hızı sorunu sinyali)
]);

// Counter felsefesi: rating verilmese bile dismiss/closed_manually değerli sinyal
export const feedbackStatusEnum = pgEnum('feedback_status', [
  'submitted',           // ✅ Radio tıklandı, rating kayıt (en değerli)
  'closed_manually',     // ✖ Manuel × ile kapatıldı (rating NULL, "ilgilenmiyorum" sinyali)
  'dismissed',           // 👻 Sayfa kapatıldı, hiç etkileşim yok (beforeunload sendBeacon)
  'flagged',             // 🚩 Süperadmin spam/kötü niyet işaretledi
]);

export const vitrinWhatsappFeedback = pgTable('vitrin_whatsapp_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),

  // İlişki — hangi tıklamaya bağlı (forensics + funnel analiz için)
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  vitrinEventId: uuid('vitrin_event_id').references(() => vitrinEvents.id, { onDelete: 'set null' }),  // whatsapp_click event

  // Anket verisi (tek field, tek tıklama)
  rating: feedbackRatingEnum('rating'),                              // NULL = closed_manually veya dismissed

  // Faz 2 yorum akışı için yer tutucu (MVP'de doldurulmaz)
  // commentText: text('comment_text'),                              // Faz 2'de eklenir, 500 char limit

  // Anti-spam + KVKK uyum (anonim — IP hash bir yönlü, kişisel veri değil)
  reporterIpHash: varchar('reporter_ip_hash', { length: 64 }).notNull(),  // SHA256(IP + daily_salt)
  countryCode: varchar('country_code', { length: 2 }),
  userAgent: text('user_agent'),

  // Durum
  status: feedbackStatusEnum('status').notNull(),                    // explicit set zorunlu (default yok)
  flaggedById: uuid('flagged_by_id').references(() => users.id, { onDelete: 'set null' }),
  flagReason: text('flag_reason'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

**Index'ler:**
```sql
-- Anti-spam: 1 IP × 1 company × 24 saat = 1 feedback
CREATE UNIQUE INDEX uq_feedback_ip_company_day
  ON vitrin_whatsapp_feedback(reporter_ip_hash, company_id, (date_trunc('day', created_at)));

-- Pet shop dashboard funnel sorgusu
CREATE INDEX idx_feedback_company_date
  ON vitrin_whatsapp_feedback(company_id, created_at DESC);

-- Rating dağılımı sorgusu (sadece submit edilenler)
CREATE INDEX idx_feedback_rating_company
  ON vitrin_whatsapp_feedback(company_id, rating)
  WHERE rating IS NOT NULL;

-- Süperadmin moderation
CREATE INDEX idx_feedback_flagged
  ON vitrin_whatsapp_feedback(status, created_at DESC)
  WHERE status = 'flagged';
```

**RLS politikası (§4.3'te SQL bloğunda):**
- Public unauthenticated INSERT (müşteri rating verir, rate-limit Cloudflare KV'de)
- Tenant kendi feedback'ini SELECT (ADMIN — vitrin metrikleri sayfasında görür, anonim)
- SUPERADMIN tüm SELECT + UPDATE (moderation için flag)
- DELETE yasak (KVKK 1 yıl + spam analizi)

**pg_cron retention:** 1 yıl (rating trend için yeterli, KVKK için makul):
```sql
SELECT cron.schedule('cleanup_vitrin_feedback', '0 4 * * 0',  -- haftalık, Pazar 04:00
  $$ DELETE FROM petstockpro.vitrin_whatsapp_feedback
     WHERE created_at < NOW() - INTERVAL '1 year' AND status != 'flagged' $$);
-- flagged kayıtlar süresiz tutulur (spam pattern analizi için)
```

**Türetilen metric'ler (pet shop dashboard — `EKRAN-AYARLAR §2.4` görüntüleme):**
```sql
-- Funnel: balloon_shown → submitted/closed_manually/dismissed
SELECT
  COUNT(*) FILTER (WHERE event_type = 'whatsapp_click') AS whatsapp_clicks,
  COUNT(*) FILTER (WHERE event_type = 'feedback_balloon_shown') AS balloon_shown,
  COUNT(*) FILTER (WHERE event_type = 'feedback_submitted') AS submitted,
  COUNT(*) FILTER (WHERE event_type = 'feedback_closed_manually') AS closed_manually,
  COUNT(*) FILTER (WHERE event_type = 'feedback_dismissed') AS dismissed
FROM vitrin_events WHERE company_id = $1 AND created_at > NOW() - INTERVAL '30 days';

-- Rating dağılımı + türetilen oran'lar
SELECT
  rating,
  COUNT(*) AS count
FROM vitrin_whatsapp_feedback
WHERE company_id = $1 AND status = 'submitted' AND created_at > NOW() - INTERVAL '30 days'
GROUP BY rating;

-- Ulaşma oranı = (very_good + good + neutral + bad) / total
-- Memnuniyet oranı = (very_good + good) / (toplam - unreached)
-- Ortalama puan = SUM(rating_value × count) / SUM(count) where rating_value 5/4/3/2/1
```

### 3.9 Bayi Admin (Faz 3) — 2026-05-13 eklendi

**Faz 3'e saklandı, ama schema hazırlığı Sprint 1'de.** Aynı kişinin birden fazla bağımsız pet shop'u (her biri ayrı PetStockPro tenant'ı) varsa, ya da iki farklı pet shop sahibi koordinasyon istiyorsa "Bayi Admin" rolü read-only viewer olarak iki tenant'ı tek dashboard'da izler.

```ts
// db/schema/bayi-admin.ts
export const bayiAdminStatusEnum = pgEnum('bayi_admin_status', ['pending', 'accepted', 'rejected', 'revoked']);

export const bayiAdminRelations = pgTable('bayi_admin_relations', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Bayi admin hesabı — NORMAL ADMİN HESABIYLA KARIŞMAZ, kesinlikle ayrı user
  bayiAdminUserId: uuid('bayi_admin_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // Davet eden (kendi pet shop'unun bayi admin'ini oluşturan tenant)
  invitedByCompanyId: uuid('invited_by_company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),

  // İzlenecek pet shop (davete cevap veren tenant)
  watchedCompanyId: uuid('watched_company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),

  status: bayiAdminStatusEnum('status').default('pending').notNull(),
  invitationMessage: text('invitation_message'),

  invitedAt: timestamp('invited_at', { withTimezone: true }).defaultNow().notNull(),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedById: uuid('revoked_by_id').references(() => users.id, { onDelete: 'set null' }),
}, (t) => ({
  unique: { columns: [t.bayiAdminUserId, t.watchedCompanyId], name: 'bayi_admin_unique' },
}));
```

**İş kuralları:**
- Bayi Admin rolü `users.role = 'BAYI_ADMIN'` (yeni enum değeri — Faz 3'te eklenir, MVP'de kullanılmaz)
- Bayi Admin hesabı **ayrı user record** — normal ADMIN hesabıyla aynı kişi olabilir ama farklı user_id, farklı login
- **READ-ONLY:** Bayi admin hiçbir veriyi değiştiremez (edit/delete/insert YOK). Sadece dashboard, raporlar, stok görüntüler
- **İki taraflı onay:** Pet shop A "Bayi admin'imin pet shop B'yi de izlemesini istiyorum" → B'ye davet gönderir → B kabul/reddeder → kabul edilirse `bayi_admin_relations` aktif olur
- **RLS politikası:** Bayi admin user için ek `auth.bayi_admin_company_ids()` helper fonksiyonu — JWT'den okur, izlediği tüm tenant'ları listeler
- **Tenant izolasyonu zaten korunur:** Bayi admin pet shop A'da iken pet shop B'nin verisini göremez (UI'da tenant switcher)

**Faz 3'te eklenecek:**
- `/admin/bayi-admin/invite` Server Action (davet gönder)
- `/admin/bayi-admin/respond/[id]` (davete cevap ver)
- `/bayi-admin/*` ayrı dashboard rotası (tenant switcher)
- Süperadmin Vitrin Modlama sekmesi'ne "Bayi Admin İlişkileri" alt-sekmesi

**MVP'de:** Tablo + enum hazır (Sprint 1 migration), ama UI/Server Action YOK. Plan kademeleri etkilemez (hem Bayi Admin hesabı hem izlenen tenant'lar kendi planlarında).

### 3.9.1 Bayi Admin RLS Stratejisi (Faz 3)

Mevcut RLS politikaları tek `auth.company_id()` claim'i kullanıyor (tek tenant izolasyon). Bayi Admin için **multi-tenant viewer** desteklenmeli:

```sql
-- Faz 3'te eklenecek helper function
CREATE OR REPLACE FUNCTION auth.bayi_admin_company_ids() RETURNS UUID[] AS $$
  SELECT array_agg(watched_company_id)
  FROM bayi_admin_relations
  WHERE bayi_admin_user_id = auth.uid()
    AND status = 'accepted'
    AND revoked_at IS NULL;
$$ LANGUAGE SQL STABLE;

-- Mevcut politikalara OR koşulu ekle (read-only)
CREATE POLICY "Bayi admin reads watched tenants" ON products
  FOR SELECT USING (
    company_id = ANY(auth.bayi_admin_company_ids())
    AND auth.jwt() ->> 'role' = 'BAYI_ADMIN'
  );

-- Bayi admin INSERT/UPDATE/DELETE asla yok — sadece SELECT
-- Diğer tablolar (branches, branch_inventory, stock_movements, ...) aynı pattern
```

**JWT yapısı (Faz 3):**
```ts
{
  sub: "user-id",
  role: "BAYI_ADMIN",
  email: "...",
  company_id: null,  // bayi admin'in kendi tenant'ı yok
  bayi_admin: {
    accessible_company_ids: ["tenant-1", "tenant-2"]
  }
}
```

**UI tarafında:** Tenant switcher dropdown — bayi admin hangi tenant'ı izlediğini seçer. Switching'te frontend `accessible_company_ids` listesinden seçilen tenant ID'yi `x-active-company-id` header'da backend'e gönderir; backend RLS policy bu header'ı `auth.bayi_admin_company_ids()` listesinden doğrular.

```

### 3.9.5 Vitrin Şikayet Sistemi (2026-05-14 eklendi — MANTIK-HATALARI K5 düzeltmesi)

> Müşteri vitrin'de "🚩 Bildir" butonuyla pet shop veya ürün şikayet eder. Süperadmin Vitrin Modlama > Bildirimler alt-sekmesinde inceler. Önceden EKRAN-PUBLIC-VITRIN §14 ve EKRAN-SUPERADMIN §2.5.3'te referans verilen `vitrin_reports` tablosu eksikti — eklendi.

```ts
// db/schema/vitrin-moderation.ts
export const vitrinReportTypeEnum = pgEnum('vitrin_report_type', [
  'fake_product',        // sahte / var olmayan ürün
  'copyright',           // telif hakkı ihlali (görsel, marka)
  'spam',                // tekrarlanan ilan / reklam spam
  'offensive_content',   // küfür / hakaret / uygunsuz
  'wrong_info',          // yanlış bilgi (stok yok ama "var" yazıyor, fiyat yanlış, adres yanlış)
  'wrong_photo',         // 2026-05-14 YT-1: alakasız/yanıltıcı görsel (kullanıcı: pet shop "Royal Canin" listeleyip kedi yerine ot foto koymuş)
  'other',               // serbest açıklama
]);

export const vitrinReportTargetEnum = pgEnum('vitrin_report_target', [
  'company',             // pet shop tenant'ı şikayet
  'product',             // belirli bir ürün
]);

export const vitrinReportStatusEnum = pgEnum('vitrin_report_status', [
  'open',                // henüz incelenmedi
  'resolved',            // süperadmin aksiyon aldı (pet shop uyarıldı, içerik kaldırıldı, vb.)
  'dismissed',           // süperadmin "haksız şikayet" diye reddetti
]);

export const vitrinReports = pgTable('vitrin_reports', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Hedef
  targetType: vitrinReportTargetEnum('target_type').notNull(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),  // hangi pet shop
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }),            // hangi ürün (targetType='product' ise)

  // Şikayet içeriği
  reportType: vitrinReportTypeEnum('report_type').notNull(),
  description: text('description'),                                    // serbest açıklama (max 500 char UI'da)

  // Şikayetçi (anonim — KVKK)
  reporterIpHash: varchar('reporter_ip_hash', { length: 64 }).notNull(),  // SHA256(IP + daily_salt) — aynı IP spam tespiti için
  reporterUa: text('reporter_ua'),                                        // User-Agent
  reporterCountry: varchar('reporter_country', { length: 2 }),            // GeoLite IP→ülke (anomali tespiti)

  // İnceleme
  status: vitrinReportStatusEnum('status').default('open').notNull(),
  resolvedById: uuid('resolved_by_id').references(() => users.id, { onDelete: 'set null' }),  // süperadmin
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolutionNote: text('resolution_note'),                                // süperadmin'in not'u (audit)

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

**Index:**
```sql
CREATE INDEX idx_vitrin_reports_status_created ON vitrin_reports(status, created_at DESC);    -- süperadmin "open" raporları görür
CREATE INDEX idx_vitrin_reports_company ON vitrin_reports(company_id, status);                 -- pet shop başına kaç şikayet (cluster tespiti)
CREATE INDEX idx_vitrin_reports_ip ON vitrin_reports(reporter_ip_hash, created_at DESC);       -- IP spam tespiti (aynı IP saatte >5 rapor → otomatik dismissed)
```

**RLS:** Sadece süperadmin okur+yazar. Tenant kendi şikayetlerini **göremez** (taraflı davranışı önle). Public "Bildir" formu unauthenticated INSERT izniyle çalışır (rate-limit IP başına saatte 5 rapor, Cloudflare Workers KV).

**Otomatik moderation (1K tenant'ta scale için):**
- Aynı IP saatte >5 rapor → tümü `dismissed` (spam koruma)
- Aynı company'ye 24 saatte >10 rapor farklı IP'lerden → süperadmin Telegram bildirim (gerçek sorun olabilir)
- 30 gün eski `open` raporlar → otomatik `dismissed` (incelenmemiş, eski şikayet)

---

### 3.10 Abonelik & Fatura (2026-05-14 eklendi — MANTIK-HATALARI K2 düzeltmesi)

> Sprint 13 (iyzico) + Sprint 14 (Nilvera) lansman öncesi gerekli tablolar. **Önceki "Faz 2'de eklenecek" notu iptal edildi** — MVP'ye taşındı.
>
> **TR-only:** Sadece iyzico (TR) + Nilvera (TR e-Arşiv). Paddle yurt dışı tabloları Faz 2'ye saklandı.

```ts
// db/schema/billing.ts
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',          // ödeme aktif, dönem içinde
  'past_due',        // ödeme başarısız, 3-7 gün retry sürecinde (iyzico)
  'suspended',       // 2026-05-14 KT2-3 eklendi — past_due 7 gün geçti, abonelik askıda. Tenant FREE limit'e düşmedi henüz, ödeme yapınca yeniden active'e döner. PAYMENT-INTEGRATION §5.3 state machine.
  'cancelled',       // tenant iptal etti, dönem sonuna kadar aktif
  'expired',         // dönem bitti, plan FREE'ye düştü
  'trialing',        // deneme süresi (Faz 2 — şu an kullanılmıyor)
]);

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'pending',         // henüz Nilvera'ya gönderilmedi
  'issued',          // Nilvera'da kesildi (GİB'e iletildi)
  'delivered',       // tenant'a e-posta ile iletildi
  'cancelled',       // iptal edildi (3 gün içinde)
  'failed',          // Nilvera/GİB ret — manuel müdahale gerekli
]);

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  plan: planEnum('plan').notNull(),               // PRO veya PRO_PLUS (FREE için subscription kaydı yok)
  status: subscriptionStatusEnum('status').default('active').notNull(),

  // iyzico subscription (TR-only şu an — Faz 2'de paddle_subscription_ref eklenebilir)
  iyzicoSubscriptionRef: varchar('iyzico_subscription_ref', { length: 100 }).unique(),
  iyzicoCustomerRef: varchar('iyzico_customer_ref', { length: 100 }),

  // Ödeme döngüsü
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).notNull(),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),

  // Fiyat snapshot — fiyat değişimi olursa eski tenant'ın korunan fiyatı (lifetime guarantee için audit)
  amountTry: decimal('amount_try', { precision: 10, scale: 2 }).notNull(),  // KDV dahil tutar

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniqueActive: { columns: [t.companyId, t.status], name: 'one_active_subscription_per_tenant' },  // tek aktif abonelik (partial unique index — RLS politikası altında)
}));

// Webhook idempotency — iyzico ve Nilvera'dan gelen event'ler tekrar geldiğinde çift işleme YOK
export const processedWebhooks = pgTable('processed_webhooks', {
  eventId: varchar('event_id', { length: 200 }).primaryKey(),     // iyzico/nilvera benzersiz event ID
  source: varchar('source', { length: 30 }).notNull(),            // 'iyzico' | 'nilvera'
  eventType: varchar('event_type', { length: 100 }).notNull(),    // 'subscription.payment_succeeded', 'invoice.issued', vs.
  payload: jsonb('payload').notNull(),                            // tam event payload (debug için)
  processedAt: timestamp('processed_at', { withTimezone: true }).defaultNow().notNull(),
  errorMessage: text('error_message'),                            // başarısız işlemler için
});

// e-Arşiv fatura (Nilvera entegrasyonu — TR yasal zorunluluk)
export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'restrict' }),       // tenant kapatsa fatura silinemez (KVKK 5 yıl + vergi 10 yıl saklama)
  subscriptionId: uuid('subscription_id').notNull().references(() => subscriptions.id, { onDelete: 'restrict' }),

  // Fatura dönemi
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),

  // Tutar (2026 %20 KDV)
  amountMatrah: decimal('amount_matrah', { precision: 10, scale: 2 }).notNull(),    // KDV hariç (örn. 833 ₺ PRO için)
  vatAmount: decimal('vat_amount', { precision: 10, scale: 2 }).notNull(),          // KDV (örn. 167 ₺)
  amountTotal: decimal('amount_total', { precision: 10, scale: 2 }).notNull(),      // KDV dahil (örn. 1.000 ₺)

  // Nilvera e-Arşiv referansları
  nilveraInvoiceId: varchar('nilvera_invoice_id', { length: 100 }),       // Nilvera UUID
  nilveraInvoiceNumber: varchar('nilvera_invoice_number', { length: 50 }),// Resmi fatura no (örn. PSP-2026-000147)
  pdfUrl: text('pdf_url'),                                                 // Supabase Storage URL (tenant indirebilir)

  status: invoiceStatusEnum('status').default('pending').notNull(),
  issuedAt: timestamp('issued_at', { withTimezone: true }),                // Nilvera'da kesilme zamanı

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

**Index:**
```sql
CREATE INDEX idx_subscriptions_company_status ON subscriptions(company_id, status);
CREATE INDEX idx_invoices_company_period ON invoices(company_id, period_end DESC);
CREATE INDEX idx_processed_webhooks_processed_at ON processed_webhooks(processed_at DESC);
-- processed_webhooks 90 gün sonra silinebilir (pg_cron + cleanup)
```

**RLS politikaları:**
- `subscriptions`: tenant kendi abonelik kaydını görür, süperadmin hepsini
- `invoices`: tenant kendi faturalarını görür (read-only), süperadmin hepsini
- `processed_webhooks`: **sadece süperadmin** — tenant'a kapalı (operasyonel debug için)

---

## 4. RLS Politikaları

Tüm tablolarda RLS aktif. Politikalar JWT'den gelen `company_id` ve `branch_id` claim'lerini okur.

### 4.1 JWT Custom Claims (Auth.js callback)

```ts
// auth.ts (Auth.js v5)
export const { auth, handlers } = NextAuth({
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.companyId = user.companyId;
        token.branchId = user.branchId;
        token.role = user.role;  // 2026-05-14 O6: tek kaynak — 'SUPERADMIN' | 'ADMIN' | 'STAFF' | 'BAYI_ADMIN'
      }
      return token;
    },
    session: async ({ session, token }) => {
      session.user.companyId = token.companyId;
      session.user.branchId = token.branchId;
      session.user.role = token.role;

      // Supabase için JWT'yi sign et (Supabase verify edebilsin)
      // 2026-05-14 KT2-1: app role'ümüz `user_role` claim'i olarak yazılır
      // (PostgREST `role` claim'i Supabase auth seviyesi için ayrı: 'authenticated'/'service_role')
      const supabaseToken = await signSupabaseJwt({
        sub: token.sub,
        company_id: token.companyId,
        branch_id: token.branchId,
        role: token.role,  // signSupabaseJwt içinde `user_role` claim'ine map'lenir
      });
      session.supabaseAccessToken = supabaseToken;

      return session;
    },
  },
});
```

### 4.2 Supabase Client (RLS Otomatik)

```ts
// supabase-client.ts
import { createClient } from '@supabase/supabase-js';

export async function getSupabaseForUser(supabaseToken: string) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${supabaseToken}` } },
  });
  return client;
}
```

### 4.3 Politika Örnekleri

```sql
-- ENABLE RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
-- ... tüm tablolar

-- Helper functions
CREATE OR REPLACE FUNCTION auth.company_id() RETURNS UUID AS $$
  SELECT (auth.jwt() ->> 'company_id')::UUID;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION auth.branch_id() RETURNS UUID AS $$
  SELECT (auth.jwt() ->> 'branch_id')::UUID;
$$ LANGUAGE SQL STABLE;

-- 2026-05-14 MANTIK-HATALARI O6 + KT2-1: tek kaynak gerçeklik = JWT `user_role` claim
-- (PostgREST `role` claim Supabase auth seviyesi 'authenticated'/'service_role' bekler — bizim app role'ümüz ayrı claim)
CREATE OR REPLACE FUNCTION auth.is_superadmin() RETURNS BOOLEAN AS $$
  SELECT (auth.jwt() ->> 'user_role') = 'SUPERADMIN';
$$ LANGUAGE SQL STABLE;

-- COMPANIES: Sadece kendi şirketini gör
CREATE POLICY "Users see own company" ON companies
  FOR SELECT USING (
    id = auth.company_id() OR auth.is_superadmin()
  );

CREATE POLICY "Only admin updates own company" ON companies
  FOR UPDATE USING (
    id = auth.company_id() AND auth.branch_id() IS NULL  -- sadece bayi sahibi
  );

-- BRANCHES: Tenant izolasyon + branch_id zorla
CREATE POLICY "Tenant branches" ON branches
  FOR SELECT USING (
    company_id = auth.company_id() OR auth.is_superadmin()
  );

CREATE POLICY "Owner only creates branches" ON branches
  FOR INSERT WITH CHECK (
    company_id = auth.company_id() AND auth.branch_id() IS NULL
  );

-- BRANCH_INVENTORY: Tenant + şube müdürü kendi şubesi
CREATE POLICY "Tenant + branch isolation" ON branch_inventory
  FOR SELECT USING (
    company_id = auth.company_id()
    AND (
      auth.branch_id() IS NULL  -- bayi sahibi tüm şubeler
      OR branch_id = auth.branch_id()  -- şube müdürü sadece kendi şubesi
    )
  );

-- PRODUCTS: Tenant izolasyon (şube ile bağ yok, products parent)
CREATE POLICY "Tenant products" ON products
  FOR ALL USING (
    company_id = auth.company_id() OR auth.is_superadmin()
  );

-- STOCK_MOVEMENTS: Multi-tenant + branch + IMMUTABLE
CREATE POLICY "Read tenant movements" ON stock_movements
  FOR SELECT USING (
    company_id = auth.company_id()
    AND (auth.branch_id() IS NULL OR branch_id = auth.branch_id())
  );

CREATE POLICY "Insert with tenant check" ON stock_movements
  FOR INSERT WITH CHECK (
    company_id = auth.company_id()
    AND (auth.branch_id() IS NULL OR branch_id = auth.branch_id())
  );

-- UPDATE/DELETE engelle (immutable)
-- Politika YOK → default deny

-- USERS: Tenant + kendi profilini güncelle
CREATE POLICY "Tenant users" ON users
  FOR SELECT USING (
    company_id = auth.company_id() OR auth.is_superadmin()
  );

CREATE POLICY "User updates own profile" ON users
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Owner manages tenant users" ON users
  FOR ALL USING (
    auth.is_superadmin()
    OR (company_id = auth.company_id() AND auth.branch_id() IS NULL)
  );

-- AUDIT_LOGS: Tenant okuma + INSERT-only
CREATE POLICY "Read tenant audit" ON audit_logs
  FOR SELECT USING (
    company_id = auth.company_id() OR auth.is_superadmin()
  );

CREATE POLICY "Insert audit" ON audit_logs
  FOR INSERT WITH CHECK (true);  -- backend yazıyor, RLS bypass

-- UPDATE/DELETE engelle

-- STOREFRONT_SETTINGS: Tenant + public read
CREATE POLICY "Tenant manages storefront" ON storefront_settings
  FOR ALL USING (
    company_id = auth.company_id() AND auth.branch_id() IS NULL
  );

CREATE POLICY "Public reads enabled storefront" ON storefront_settings
  FOR SELECT USING (is_enabled = true);

-- PUBLIC erişimi: anon role için ek politika
GRANT SELECT ON storefront_settings TO anon;
GRANT SELECT ON products TO anon;  -- vitrin için
GRANT SELECT ON product_variants TO anon;
GRANT SELECT ON product_images TO anon;
GRANT SELECT ON categories TO anon;
GRANT SELECT ON brands TO anon;
GRANT SELECT ON branches TO anon;  -- şubeler vitrin'de
GRANT SELECT ON branch_inventory TO anon;  -- stok visibility

CREATE POLICY "Public sees products of enabled storefront" ON products
  FOR SELECT USING (
    is_active = true AND is_published = true
    AND company_id IN (SELECT company_id FROM storefront_settings WHERE is_enabled = true)
  );

-- ============================================================
-- 2026-05-14 MANTIK-HATALARI KT2-2: 4 yeni tablo için RLS POLICY
-- ============================================================

-- SUBSCRIPTIONS: Tenant kendi aboneliğini okur. Süperadmin hepsini.
-- INSERT/UPDATE backend (Server Action) tarafından — RLS bypass servisi (service_role JWT).
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant reads own subscription" ON subscriptions
  FOR SELECT USING (
    company_id = auth.company_id() OR auth.is_superadmin()
  );
-- INSERT/UPDATE: SADECE backend (service_role) — Auth.js callback'inde signSupabaseJwt service_role atar
CREATE POLICY "Backend writes subscription" ON subscriptions
  FOR INSERT WITH CHECK (auth.is_superadmin());  -- service_role = SUPERADMIN view
CREATE POLICY "Backend updates subscription" ON subscriptions
  FOR UPDATE USING (auth.is_superadmin()) WITH CHECK (auth.is_superadmin());
-- DELETE: yasak (KVKK + vergi saklama 10 yıl)

-- INVOICES: Tenant okur (kendi faturaları), kimse silemez (yasal saklama)
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant reads own invoices" ON invoices
  FOR SELECT USING (
    company_id = auth.company_id() OR auth.is_superadmin()
  );
CREATE POLICY "Backend issues invoice" ON invoices
  FOR INSERT WITH CHECK (auth.is_superadmin());
CREATE POLICY "Backend updates invoice status" ON invoices
  FOR UPDATE USING (auth.is_superadmin()) WITH CHECK (auth.is_superadmin());
-- DELETE: yasak

-- PROCESSED_WEBHOOKS: SADECE süperadmin (operasyonel debug, idempotency)
ALTER TABLE processed_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmin reads webhooks" ON processed_webhooks
  FOR SELECT USING (auth.is_superadmin());
CREATE POLICY "Backend writes webhook" ON processed_webhooks
  FOR INSERT WITH CHECK (auth.is_superadmin());
-- UPDATE/DELETE: 90 gün sonra pg_cron cleanup (audit kalıntısı, manuel silinmez)

-- VITRIN_REPORTS: Public unauthenticated INSERT (şikayet butonu) + süperadmin SELECT
-- Tenant kendi şikayetlerini GÖREMEZ (taraflı davranışı önle — K5 kararı)
ALTER TABLE vitrin_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public unauth submits report" ON vitrin_reports
  FOR INSERT WITH CHECK (
    -- Rate-limit Cloudflare Workers KV'de uygulanır (RLS değil)
    -- Sadece veri integrity: required field'lar dolu
    report_type IS NOT NULL
    AND target_type IS NOT NULL
    AND company_id IS NOT NULL
    AND reporter_ip_hash IS NOT NULL
  );
CREATE POLICY "Superadmin reads reports" ON vitrin_reports
  FOR SELECT USING (auth.is_superadmin());
CREATE POLICY "Superadmin updates report status" ON vitrin_reports
  FOR UPDATE USING (auth.is_superadmin()) WITH CHECK (auth.is_superadmin());
-- DELETE: yasak (audit + KVKK 5 yıl)

-- SYSTEM_ERRORS: Sadece SUPERADMIN okur ve INSERT yapar (Workers backend service role'üyle yazar)
-- Tenant kendi hatalarını GÖREMEZ (stack trace güvenlik riski — kullanıcı schema bilgisi alabilir)
-- 2026-05-15 Monitoring & Observability Stratejisi (DEPLOYMENT §8.5)
ALTER TABLE system_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmin reads errors" ON system_errors
  FOR SELECT USING (auth.is_superadmin());
CREATE POLICY "Service role writes errors" ON system_errors
  FOR INSERT WITH CHECK (auth.is_superadmin());  -- Workers backend service role JWT'siyle yazar
CREATE POLICY "Superadmin acknowledges errors" ON system_errors
  FOR UPDATE USING (auth.is_superadmin())
  WITH CHECK (auth.is_superadmin() AND acknowledged_at IS NOT NULL);
-- DELETE: pg_cron 90 gün retention (yukarıda sistem-genel cleanup job)

-- VITRIN_WHATSAPP_FEEDBACK: Public anon INSERT (müşteri rating verir) + tenant SELECT (kendi) + süperadmin tüm
-- 2026-05-15 WhatsApp Geri Bildirim Balonu (EKRAN-PUBLIC-VITRIN §17)
-- Anti-spam rate-limit Cloudflare Workers KV'de uygulanır (RLS değil); DB unique constraint günde 1 IP×1 tenant
ALTER TABLE vitrin_whatsapp_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public anon submits feedback" ON vitrin_whatsapp_feedback
  FOR INSERT WITH CHECK (
    -- Required field integrity
    company_id IS NOT NULL
    AND reporter_ip_hash IS NOT NULL
    AND status IN ('submitted', 'closed_manually', 'dismissed')
    -- Submitted ise rating zorunlu, diğer durumlarda NULL kabul
    AND (
      (status = 'submitted' AND rating IS NOT NULL)
      OR (status IN ('closed_manually', 'dismissed') AND rating IS NULL)
    )
    -- flagged status sadece SUPERADMIN UPDATE ile set edilir
    AND status != 'flagged'
  );

CREATE POLICY "Tenant reads own feedback (anonim)" ON vitrin_whatsapp_feedback
  FOR SELECT USING (
    company_id = auth.company_id()
    -- Tenant kendi feedback'ini görür ama IP hash + UA görmez (anonim)
    -- Frontend tarafında: rating + status + createdAt only SELECT
  );

CREATE POLICY "Superadmin reads all feedback" ON vitrin_whatsapp_feedback
  FOR SELECT USING (auth.is_superadmin());

CREATE POLICY "Superadmin flags feedback" ON vitrin_whatsapp_feedback
  FOR UPDATE USING (auth.is_superadmin())
  WITH CHECK (auth.is_superadmin() AND status = 'flagged');
-- DELETE: pg_cron 1 yıl retention (flagged kayıtlar süresiz tutulur — spam analizi)
```

---

## 5. Trigger'lar

### 5.1 stock_movements Immutable Trigger

```sql
CREATE OR REPLACE FUNCTION prevent_movement_update() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'stock_movements is immutable. Use reversal entries.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stock_movements_no_update
  BEFORE UPDATE OR DELETE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION prevent_movement_update();
```

### 5.2 Yeni Şube → Otomatik branch_inventory

```sql
CREATE OR REPLACE FUNCTION create_branch_inventory_rows() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO branch_inventory (company_id, branch_id, variant_id, stock_qty)
  SELECT NEW.company_id, NEW.id, pv.id, 0
  FROM product_variants pv
  JOIN products p ON p.id = pv.product_id
  WHERE p.company_id = NEW.company_id AND pv.is_active = true;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_branch_insert
  AFTER INSERT ON branches
  FOR EACH ROW EXECUTE FUNCTION create_branch_inventory_rows();
```

### 5.3 Yeni Variant → Tüm Şubelerde branch_inventory

```sql
CREATE OR REPLACE FUNCTION create_variant_inventory_rows() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO branch_inventory (company_id, branch_id, variant_id, stock_qty)
  SELECT NEW.company_id, b.id, NEW.id, 0
  FROM branches b
  WHERE b.company_id = NEW.company_id AND b.is_active = true;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_variant_insert
  AFTER INSERT ON product_variants
  FOR EACH ROW EXECUTE FUNCTION create_variant_inventory_rows();
```

### 5.4 updated_at Auto

```sql
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Her updated_at olan tabloda:
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- ... diğer tablolar
```

### 5.5 Stok 0 → Vitrin'den Otomatik Çekme (2026-05-13 eklendi)

Pet shop sahibi vitrin'e koyduğu ürünün stoğu bittiğinde otomatik olarak vitrin'den çekilir (müşteri "stokta var" görüp mağazaya gidip "yok" demesin). Trigger değil, **transaction içinde Server Action'da** yapılır (kontrollü hata mesajları + Telegram bildirimi için):

```ts
// server-action: createStockMovement (Bölüm 5.6'daki transaction'a ek)
await db.transaction(async (tx) => {
  // ... mevcut stock_movement insert + branch_inventory update

  // Stok 0 kontrolü — eğer parent product'ın tüm şube + variant toplam stoğu 0 ise
  if (input.type === 'stock_out' && newQty === 0) {
    const totalRemaining = await tx
      .select({ total: sum(branchInventory.stockQty) })
      .from(branchInventory)
      .innerJoin(productVariants, eq(productVariants.id, branchInventory.variantId))
      .where(eq(productVariants.productId, variant.productId));

    if (totalRemaining[0].total === 0) {
      // Vitrin'den otomatik çek
      await tx.update(products)
        .set({
          vitrinPublished: false,
          vitrinAutoUnpublishedAt: new Date(),
          vitrinAutoUnpublishedReason: 'STOCK_OUT',
        })
        .where(eq(products.id, variant.productId))
        .where(eq(products.vitrinPublished, true));

      // Bildirim queue (Telegram + ekran)
      await tx.insert(notifications).values({
        companyId: ctx.tenantId,
        userId: null,  // tüm tenant
        type: 'out_of_stock',
        channel: 'telegram',
        content: {
          title: '⛔ Stok bitti, vitrin\'den çekildi',
          body: `${product.name} stoğu bitti, vitrin\'den otomatik çekildi. Stok ekleyince "Satışa Aç" toggle ile yeniden açabilirsin.`,
          link: `/admin/products/${product.id}`,
        },
      });

      await tx.insert(notifications).values({
        companyId: ctx.tenantId,
        userId: null,
        type: 'out_of_stock',
        channel: 'screen',
        content: { /* aynı */ },
      });
    }
  }
});
```

**UX kuralı:** Stok eklendiğinde otomatik geri açılmaz — pet shop sahibi manuel "Satışa Aç" toggle açmalı. Kontrol kullanıcıda kalır.

### 5.6 stock_movements → branch_inventory Otomatik Güncelleme

Backend Server Action içinde transaction'da yapılır (trigger değil), çünkü:
- before_qty / after_qty hesabı race condition'a karşı
- Validation app-level (eksi stok engelleme)
- Daha kontrolu hata mesajları

```ts
// server-action: createStockMovement
await db.transaction(async (tx) => {
  // 1. Mevcut stok lock
  const inventory = await tx.select().from(branchInventory)
    .where(eq(branchInventory.branchId, input.branchId))
    .where(eq(branchInventory.variantId, input.variantId))
    .for('update');

  // 2. Validation
  if (input.type === 'stock_out' && inventory.stockQty + input.quantity < 0) {
    throw new InsufficientStockError();
  }

  // 3. Movement insert
  const newQty = inventory.stockQty + input.quantity;
  await tx.insert(stockMovements).values({
    ...input,
    beforeQty: inventory.stockQty,
    afterQty: newQty,
  });

  // 4. Inventory güncelle
  await tx.update(branchInventory)
    .set({ stockQty: newQty, lastSoldAt: input.type === 'stock_out' ? new Date() : inventory.lastSoldAt })
    .where(eq(branchInventory.id, inventory.id));
});
```

---

## 6. Index'ler

```sql
-- Tenant izolasyon (hot path)
CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_branches_company ON branches(company_id);
CREATE INDEX idx_products_company ON products(company_id);
CREATE INDEX idx_products_company_active ON products(company_id, is_active);
CREATE INDEX idx_variants_company ON product_variants(company_id);
CREATE INDEX idx_inventory_company_branch ON branch_inventory(company_id, branch_id);

-- Stok hareketleri (Stok Hareketleri ekranı, Pano feed)
CREATE INDEX idx_movements_company_date ON stock_movements(company_id, created_at DESC);
CREATE INDEX idx_movements_company_type_date ON stock_movements(company_id, type, created_at DESC);
CREATE INDEX idx_movements_branch ON stock_movements(branch_id, created_at DESC);
CREATE INDEX idx_movements_variant ON stock_movements(variant_id, created_at DESC);
CREATE INDEX idx_movements_supplier ON stock_movements(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX idx_movements_superadmin ON stock_movements(performed_as_superadmin) WHERE performed_as_superadmin = true;
CREATE INDEX idx_movements_transfer_group ON stock_movements(transfer_group_id) WHERE transfer_group_id IS NOT NULL;

-- Düşük stok query
CREATE INDEX idx_inventory_low_stock ON branch_inventory(company_id, stock_qty);

-- Ürün arama (2026-05-21 Tur 5 P1-4 Performance Deep Audit — Migration 0024)
-- pg_trgm GIN — `ILIKE %query%` leading wildcard için. tsvector tam kelime
-- arar, trigram kısmi metin arar. Vitrin search.ts ILIKE kullanır → pg_trgm
-- canon. Partial WHERE: sadece vitrin'de görünen ürün (deleted_at IS NULL
-- AND vitrin_published = true) → küçük index, sıkı match.
-- ⚠ MANUEL APPLY — CONCURRENTLY transaction içinde çalışmaz, Drizzle migrator
-- _journal.json'a EKLENMEZ. Production deploy: bkz. DEPLOYMENT.md §5.2 step 1b
CREATE INDEX CONCURRENTLY idx_products_name_trgm ON products USING GIN (name gin_trgm_ops)
  WHERE deleted_at IS NULL AND vitrin_published = true;
CREATE INDEX CONCURRENTLY idx_brands_name_trgm ON brands USING GIN (name gin_trgm_ops);
CREATE INDEX idx_variants_sku ON product_variants(sku);
CREATE INDEX idx_variants_barcode ON product_variants(barcode) WHERE barcode IS NOT NULL;

-- Audit log
CREATE INDEX idx_audit_company_date ON audit_logs(company_id, created_at DESC);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_superadmin_session ON audit_logs(superadmin_session_id) WHERE superadmin_session_id IS NOT NULL;

-- Vitrin
CREATE INDEX idx_storefront_slug ON companies(slug) WHERE slug IS NOT NULL;
CREATE INDEX idx_products_published ON products(company_id, is_published, is_active);
CREATE INDEX idx_products_vitrin ON products(company_id, vitrin_published, is_active) WHERE vitrin_published = true;  -- vitrin'de gösterilenler
CREATE INDEX idx_storefront_messages_company ON storefront_messages(company_id, created_at DESC);
-- 2026-05-21 Tur 4 P1-1 Performance Deep Audit — Migration 0023
-- Vitrin'in en sık filter'ı `storefront_status = 'approved'`. Partial index
-- sadece 'approved' tenant'ı index'ler — küçük + hızlı. Diğer state'ler seq
-- scan (süperadmin moderation panel, seyrek).
-- ⚠ MANUEL APPLY — CONCURRENTLY transaction'da çalışmaz. DEPLOYMENT.md §5.2 step 1b
CREATE INDEX CONCURRENTLY idx_companies_storefront_approved
  ON companies(storefront_status)
  WHERE storefront_status = 'approved';

-- Konum (Cities + Districts seed)
CREATE INDEX idx_districts_city ON districts(city_id);
CREATE INDEX idx_cities_slug ON cities(slug);
CREATE INDEX idx_districts_slug ON districts(city_id, slug);
CREATE INDEX idx_companies_city ON companies(city_id) WHERE city_id IS NOT NULL;
CREATE INDEX idx_branches_city ON branches(city_id) WHERE city_id IS NOT NULL;
-- 2026-05-14 MANTIK-HATALARI S4: PostGIS tek extension (earthdistance kaldırıldı).
-- Sorgu pattern'i ile index pattern'i aynı olmalı — `EKRAN-PUBLIC-VITRIN.md §4.4`
-- ST_DWithin(ST_MakePoint(lng, lat)::geography, ..., 5000) kullanıyor.
-- Bu index o sorguyu hızlandırır (GIST geography üzerinde).
CREATE INDEX idx_branches_location ON branches USING GIST (
  (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography)
) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
-- ESKİ: ll_to_earth(latitude, longitude) — earthdistance, çıkarıldı

-- Vitrin metrikleri
CREATE INDEX idx_vitrin_events_company_date ON vitrin_events(company_id, created_at DESC);
CREATE INDEX idx_vitrin_events_company_type_date ON vitrin_events(company_id, event_type, created_at DESC);
CREATE INDEX idx_vitrin_events_product ON vitrin_events(product_id, created_at DESC) WHERE product_id IS NOT NULL;

-- Bayi Admin (Faz 3)
CREATE INDEX idx_bayi_admin_user ON bayi_admin_relations(bayi_admin_user_id);
CREATE INDEX idx_bayi_admin_watched ON bayi_admin_relations(watched_company_id);
CREATE INDEX idx_bayi_admin_pending ON bayi_admin_relations(status, invited_at DESC) WHERE status = 'pending';

-- Realtime subscription performansı
CREATE INDEX idx_movements_realtime ON stock_movements(company_id, created_at) WHERE created_at > NOW() - INTERVAL '24 hours';
```

---

## 7. Seed Data

```sql
-- plans master (2026-05-22 son revize — 3-tier B, TR-only + USD pricing önerisi)
-- price_try_monthly KDV dahil. TR-only kararı (2026-05-14) korunur, USD pricing
-- yurt dışı tier Faz 2'de açıldığında (Paddle MoR + EN locale + KVKK Md.9)
-- kullanılacak öneri değer (2026-05-22 kullanıcı kararı: PRO=20, PRO+=50).
INSERT INTO plans (tier, product_limit, price_try_monthly, price_usd_monthly, features) VALUES
  ('FREE',     50,   0,    0,  '{"all_features": true}'),
  ('PRO',      500,  1000, 20, '{"all_features": true}'),
  ('PRO_PLUS', NULL, 2000, 50, '{"all_features": true}');

-- Default kategoriler (tenant başına copy template — onboarding'de)
-- 2026-05-14 MANTIK-HATALARI YT-3: KDV %18 → %20 (TR 2024 Temmuz oranı). Mama %10 gıda, Sağlık %8 özel oran.
INSERT INTO categories (company_id, name, slug, emoji, vat_rate, skt_required) VALUES
  ($1, 'Mama', 'mama', '🍖', 10, true),
  ($1, 'Aksesuar', 'aksesuar', '🎀', 20, false),
  ($1, 'Oyuncak', 'oyuncak', '🧸', 20, false),
  ($1, 'Kum', 'kum', '🪨', 20, false),
  ($1, 'Sağlık', 'saglik', '💊', 8, true),
  ($1, 'Bakım', 'bakim', '🧴', 20, false);

-- Default system_settings (2026-05-14 MANTIK-HATALARI O4: tablo adı `system_settings`, eski hatalı `site_settings` düzeltildi)
INSERT INTO system_settings (key, value, category) VALUES
  ('telegram_bot_username', '@PetStockProBot',         'telegram'),
  ('telegram_bot_token',    'xxx',                      'telegram'),  -- env'den runtime'da okunur
  ('brevo_smtp_key',        'xxx',                      'email'),     -- env'den runtime'da okunur
  ('default_locale',        'tr-TR',                    'locale'),
  ('default_currency',      'TRY',                      'locale');
```

---

## 8. Migration Strategy

### 8.1 Drizzle Kit Setup

```ts
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  schema: './src/db/schema/*.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  schemaFilter: ['public'],
  verbose: true,
  strict: true,
});
```

### 8.2 Komutlar

```bash
# Dev: schema değiştirdikten sonra DB'ye push
npx drizzle-kit push

# Prod: migration üret
npx drizzle-kit generate

# Prod: migration uygula
npx drizzle-kit migrate

# Drizzle Studio (DB GUI)
npx drizzle-kit studio
```

### 8.3 RLS Politikalar — Manuel SQL

Drizzle Kit RLS desteklemiyor. Politikalar ayrı SQL dosyalarında:

```
drizzle/
├── migrations/        ← Drizzle otomatik
├── rls/              ← Manuel
│   ├── 001_enable_rls.sql
│   ├── 002_helper_functions.sql
│   ├── 003_companies_policies.sql
│   ├── 004_branches_policies.sql
│   └── ...
└── triggers/          ← Manuel
    ├── 001_immutable_movements.sql
    ├── 002_branch_inventory_auto.sql
    └── ...
```

Sprint 0'da bir kez uygulanır, sonra `migrate` flow'una eklenmek için Supabase Migration veya `node-pg-migrate` ile sıraya konur.

---

## 9. Type Generation

### 9.1 Drizzle TypeScript Tipleri

Drizzle schema kendisinden tip üretir:

```ts
import { products } from './schema/catalog';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

export type Product = InferSelectModel<typeof products>;
export type NewProduct = InferInsertModel<typeof products>;
```

### 9.2 Supabase TypeScript Tipleri

Supabase Realtime + REST için tipler:

```bash
npx supabase gen types typescript --project-id $SUPABASE_PROJECT_ID > src/types/supabase.ts
```

CI'da otomatik script:
```yaml
# .github/workflows/types.yml
- run: npx supabase gen types typescript --project-id ${{ secrets.SUPABASE_PROJECT_ID }} > src/types/supabase.ts
- run: git diff --exit-code src/types/supabase.ts || (git add . && git commit -m "chore: regen supabase types")
```

### 9.3 Drizzle + Zod Bridge

Form validation için:

```ts
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

export const insertProductSchema = createInsertSchema(products, {
  name: (s) => s.name.min(1).max(255),
  slug: (s) => s.slug.regex(/^[a-z0-9-]+$/),
});

export const selectProductSchema = createSelectSchema(products);
```

Server Action'da:
```ts
'use server';
export async function createProduct(formData: FormData) {
  const parsed = insertProductSchema.parse({
    name: formData.get('name'),
    // ...
  });
  // parsed type-safe, validate edilmiş
  await db.insert(products).values(parsed);
}
```

---

## 10. Performans Stratejisi

### 10.1 Read-Heavy Tablolar İçin Materialized View

Raporlar için (Pano, Raporlar ekranı):

```sql
CREATE MATERIALIZED VIEW mv_daily_sales AS
SELECT
  company_id,
  branch_id,
  DATE_TRUNC('day', created_at) AS day,
  COUNT(*) AS sale_count,
  SUM(unit_price * ABS(quantity)) AS revenue,
  SUM((unit_price - unit_cost) * ABS(quantity)) AS profit
FROM stock_movements
WHERE type = 'stock_out' AND subtype = 'sale'
GROUP BY company_id, branch_id, DATE_TRUNC('day', created_at);

CREATE UNIQUE INDEX ON mv_daily_sales (company_id, branch_id, day);

-- Gece 02:00'de refresh (Supabase pg_cron)
SELECT cron.schedule('refresh_daily_sales', '0 2 * * *', $$ REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_sales; $$);
```

### 10.2 Inventory Snapshot Tablosu (Trend Chart için)

```sql
CREATE TABLE inventory_snapshots (
  company_id UUID,
  snapshot_date DATE,
  total_value DECIMAL(12, 2),
  total_qty INTEGER,
  PRIMARY KEY (company_id, snapshot_date)
);

-- Gece 03:00'de günlük snapshot
SELECT cron.schedule('inventory_snapshot', '0 3 * * *', $$
  INSERT INTO inventory_snapshots (company_id, snapshot_date, total_value, total_qty)
  SELECT
    pv.company_id,
    CURRENT_DATE - 1,
    SUM(pv.cost_price * bi.stock_qty),
    SUM(bi.stock_qty)
  FROM branch_inventory bi
  JOIN product_variants pv ON pv.id = bi.variant_id
  WHERE pv.is_active = true
  GROUP BY pv.company_id
  ON CONFLICT DO NOTHING;
$$);
```

### 10.3 Connection Pooling

Supabase free tier ~60 connection. Cloudflare Workers serverless → connection pooling şart.

**Çözüm:** Supabase **Hyperdrive** (Cloudflare ile entegre, otomatik pooling) veya **Supabase Connection Pooler** (PgBouncer based).

---

## 11. Data Migration & Backup

### 11.1 Backup

- Supabase otomatik 7 gün backup (free tier)
- Pro tier 30 gün + point-in-time recovery
- Manuel: `pg_dump` ile haftalık snapshot ekstra (KVKK için)

### 11.2 DR (Disaster Recovery)

- RTO: 4 saat
- RPO: 24 saat (free tier backup interval)
- Pro tier RPO: < 5 dakika

---

## 12. Schema Versiyonlama

```
v0.1.0 — Sprint 0 schema (bu doküman)
v0.2.0 — Sprint 5 sonu (kapalı beta)
v1.0.0 — Sprint 16 lansman
```

Her `migrate generate` Drizzle migration dosyası SemVer ile etiketlenir.

---

## 13. Faz 2 Eklenecek Tablolar (Not)

- `auto_reorder_rules` — düşük stok otomatik sipariş kuralları (Sprint 8 sonrası talep gelirse)
- `customers` — müşteri DB (Faz 3, kredili satış takibi için)
- `paddle_subscriptions` — yurt dışı abonelik (TR-only kararı sonrası saklı, Faz 2'de açılabilir)

> **2026-05-14 değişiklik (MANTIK-HATALARI K2):** `subscriptions`, `invoices`, `processed_webhooks` Faz 2 listesinden **MVP'ye taşındı** — Sprint 13/14 lansman öncesi gerek. Detay: §3.10
>
> **2026-05-13 değişiklik:** `webhooks`, `api_keys`, `custom_domains` tabloları **kaldırıldı** — PRO+ rafa kararı sonrası bu özellikler kapsam dışı (3-tier B'de hâlâ kapsam dışı).

---

## 14. Tablo Sayısı Özet (2026-05-21 revize — user_permissions + catalog_seed_products eklendi)

| Kategori | Tablo sayısı |
|---|---|
| Tenant & Auth | 6 (companies, plans, users, accounts, sessions, verification_tokens) |
| Şube & Stok | 2 (branches, branch_inventory) — `currency_rates` MVP'de migrate edilmez (O5, TR-only) |
| Katalog | 5 (categories, brands, products, product_variants, product_images) |
| **Katalog Seed** (yeni — 2026-05-19) | **1 (catalog_seed_products) — 1.240 satır seed, autocomplete kaynağı** |
| Operasyon | 4 (stock_movements, stocktakes, stocktake_items, suppliers) |
| Sistem | 5 (audit_logs, notifications, telegram_bindings, plan_approval_requests, data_export_jobs) |
| **Yetki Sistemi** (yeni — 2026-05-21 Migration 0021) | **1 (user_permissions) — STAFF granular permission, PLAN-OBSERVER §C** |
| Süperadmin | 2 (system_settings, system_broadcasts) — `SUPERADMIN-YETKILERI.md` |
| Vitrin | 2 (storefront_settings, storefront_messages) |
| **Konum** | **2 (cities, districts) — seed 81+970 kayıt** |
| **Vitrin Metrikleri** | **1 (vitrin_events)** |
| **Bayi Admin** (Faz 3) | **1 (bayi_admin_relations) — schema hazır, UI Faz 3'te** |
| **Abonelik & Fatura** (yeni — K2) | **3 (subscriptions, processed_webhooks, invoices)** |
| **Vitrin Modlama** (yeni — K5) | **1 (vitrin_reports)** |
| **Monitoring** (yeni — 2026-05-15 Observability + 2026-05-21 Migration 0022) | **1 (system_errors) — DEPLOYMENT §8.5** |
| **WhatsApp Geri Bildirim** (yeni — 2026-05-15) | **1 (vitrin_whatsapp_feedback) — EKRAN-PUBLIC-VITRIN §17** |
| **Toplam MVP** | **37 tablo** (currency_rates MVP'de migrate edilmez, O5 düzeltmesi) |
| Faz 2 | + 3 tablo (auto_reorder_rules, customers, paddle_subscriptions) |

### 14.1 Süperadmin Yetki Sistemi DB Etkileri

`SUPERADMIN-YETKILERI.md` onaylanan kapsam sonrası schema güncellemeleri:

- ✅ `audit_logs.superadmin_action_type` enum kolonu (impersonation/bypass/dbfix/system/user)
- ✅ `companies.temporary_limit_override` + `temporary_limit_override_until` (plan limit override)
- ✅ `users.locked_until` + `locked_reason` (uzak hesap kilitleme)
- ✅ `system_settings` tablosu (plan tier, feature flag, email template, telegram bot config)
- ✅ `system_broadcasts` tablosu (tüm tenant'lara sistem mesajı)

---

## 15. Sıradaki Adım

✅ DATABASE-SCHEMA.md (bu doküman)
⏭ **Sprint planı revize** — yeni TS/Supabase stack için 16 sprint güncelleme
⏭ **Sprint 0** — proje skeleton (`create-next-app` + Supabase project + Drizzle init)

---

*Son güncelleme: 2026-05-12. 24 tablo + RLS politikaları + Drizzle schema TS örnekleri.*

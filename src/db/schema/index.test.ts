import { describe, it, expect } from 'vitest';
import {
  planEnum,
  userRoleEnum,
  subscriptionStatusEnum,
  invoiceStatusEnum,
  superadminActionTypeEnum,
  storefrontStatusEnum,
  userInviteMethodEnum,
  stocktakeStatusEnum,
  stocktakeModeEnum,
  stocktakeReasonEnum,
  vitrinEventTypeEnum,
  cities,
  districts,
  companies,
  users,
  branches,
  subscriptions,
  processedWebhooks,
  invoices,
  auditLogs,
  sessions,
  stocktakes,
  stocktakeItems,
  vitrinEvents,
} from './index';

/**
 * Schema değişikliklerini koruyan testler — schema'da bir şey eklenip/silindiğinde
 * burası fark eder. Drizzle'ın `.enumValues` ve column proxy'lerini kullanır.
 */

describe('Schema — enum değerleri (Sprint 1A)', () => {
  it('planEnum: FREE/PRO/PRO_PLUS', () => {
    expect(planEnum.enumValues).toEqual(['FREE', 'PRO', 'PRO_PLUS']);
  });

  it('userRoleEnum: 5 rol (BAYI_ADMIN legacy — UI gizli)', () => {
    // Faz 1 (2026-05-21) — SUBE_MUDURU → OBSERVER rename (Migration 0021).
    // BAYI_ADMIN değer Postgres enum drop limited olduğu için kaldı, UI'da yok.
    expect(userRoleEnum.enumValues).toEqual([
      'SUPERADMIN',
      'BAYI_SAHIBI',
      'OBSERVER',
      'STAFF',
      'BAYI_ADMIN',
    ]);
  });

  it('userInviteMethodEnum: email + link (hibrit davet)', () => {
    expect(userInviteMethodEnum.enumValues).toEqual(['email', 'link']);
  });

  it('storefrontStatusEnum: 5 state', () => {
    expect(storefrontStatusEnum.enumValues).toEqual([
      'disabled',
      'pending',
      'approved',
      'rejected',
      'auto_suspended',
    ]);
  });

  it('subscriptionStatusEnum: 6 state (suspended dahil — KT2-3)', () => {
    expect(subscriptionStatusEnum.enumValues).toEqual([
      'active',
      'past_due',
      'suspended',
      'cancelled',
      'expired',
      'trialing',
    ]);
  });

  it('invoiceStatusEnum: 5 state (Nilvera lifecycle)', () => {
    expect(invoiceStatusEnum.enumValues).toEqual([
      'pending',
      'issued',
      'delivered',
      'cancelled',
      'failed',
    ]);
  });

  it('superadminActionTypeEnum: 5 kategori (SUPERADMIN-YETKILERI §4)', () => {
    expect(superadminActionTypeEnum.enumValues).toEqual([
      'impersonation',
      'bypass',
      'dbfix',
      'system',
      'user',
    ]);
  });
});

describe('Schema — enum değerleri (Sprint 1B.2)', () => {
  it('stocktakeStatusEnum: 4 state', () => {
    expect(stocktakeStatusEnum.enumValues).toEqual([
      'in_progress',
      'waiting',
      'completed',
      'cancelled',
    ]);
  });

  it('stocktakeModeEnum: full/category/manual', () => {
    expect(stocktakeModeEnum.enumValues).toEqual(['full', 'category', 'manual']);
  });

  it('stocktakeReasonEnum: 7 sebep (loss/overage/wrong_entry/expired/damage/theft/other)', () => {
    expect(stocktakeReasonEnum.enumValues).toEqual([
      'loss',
      'overage',
      'wrong_entry',
      'expired',
      'damage',
      'theft',
      'other',
    ]);
  });

  it('vitrinEventTypeEnum: 14 type (10 analytics + 4 feedback balonu)', () => {
    expect(vitrinEventTypeEnum.enumValues).toEqual([
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
  });
});

describe('Schema — Sprint 0 iskelet tabloları', () => {
  it('cities: id integer (plaka kodu) + name + slug', () => {
    expect(cities.id).toBeDefined();
    expect(cities.name).toBeDefined();
    expect(cities.slug).toBeDefined();
  });

  it('districts: city FK + name + slug', () => {
    expect(districts.id).toBeDefined();
    expect(districts.cityId).toBeDefined();
    expect(districts.name).toBeDefined();
  });

  it('companies: tenant — plan + slug + vatNo opsiyonel + storefrontStatus default disabled', () => {
    expect(companies.id).toBeDefined();
    expect(companies.plan).toBeDefined();
    expect(companies.slug).toBeDefined();
    expect(companies.vatNo).toBeDefined();
    expect(companies.storefrontStatus).toBeDefined();
  });

  it('users: email unique + role default + 2FA + lock + KVKK consents', () => {
    expect(users.email).toBeDefined();
    expect(users.role).toBeDefined();
    expect(users.twoFactorEnabled).toBeDefined();
    expect(users.lockedUntil).toBeDefined();
    expect(users.kvkkConsentedAt).toBeDefined();
    expect(users.dataLocationConsentedAt).toBeDefined();
  });

  it('users: email verification 4 field (Sprint 2.3)', () => {
    expect(users.emailVerificationToken).toBeDefined();
    expect(users.emailVerificationExpiresAt).toBeDefined();
    expect(users.emailVerificationResendCount).toBeDefined();
    expect(users.emailVerificationLastSentAt).toBeDefined();
  });

  it('branches: company FK + lat/lng + WhatsApp + isActive', () => {
    expect(branches.companyId).toBeDefined();
    expect(branches.lat).toBeDefined();
    expect(branches.lng).toBeDefined();
    expect(branches.whatsappPhone).toBeDefined();
    expect(branches.isActive).toBeDefined();
  });
});

describe('Schema — Sprint 1A payment + audit tabloları', () => {
  it('subscriptions: company FK + plan + status + iyzico refs + period + amount', () => {
    expect(subscriptions.id).toBeDefined();
    expect(subscriptions.companyId).toBeDefined();
    expect(subscriptions.plan).toBeDefined();
    expect(subscriptions.status).toBeDefined();
    expect(subscriptions.iyzicoSubscriptionRef).toBeDefined();
    expect(subscriptions.iyzicoCustomerRef).toBeDefined();
    expect(subscriptions.currentPeriodStart).toBeDefined();
    expect(subscriptions.currentPeriodEnd).toBeDefined();
    expect(subscriptions.cancelAtPeriodEnd).toBeDefined();
    expect(subscriptions.amountTry).toBeDefined();
  });

  it('processedWebhooks: eventId PK + source + eventType + payload jsonb', () => {
    expect(processedWebhooks.eventId).toBeDefined();
    expect(processedWebhooks.source).toBeDefined();
    expect(processedWebhooks.eventType).toBeDefined();
    expect(processedWebhooks.payload).toBeDefined();
    expect(processedWebhooks.processedAt).toBeDefined();
  });

  it('invoices: subscription FK + 3 tutar alanı (matrah/vat/total) + Nilvera refs + status', () => {
    expect(invoices.subscriptionId).toBeDefined();
    expect(invoices.amountMatrah).toBeDefined();
    expect(invoices.vatAmount).toBeDefined();
    expect(invoices.amountTotal).toBeDefined();
    expect(invoices.nilveraInvoiceId).toBeDefined();
    expect(invoices.nilveraInvoiceNumber).toBeDefined();
    expect(invoices.pdfUrl).toBeDefined();
    expect(invoices.status).toBeDefined();
  });

  it('auditLogs: user FK notNull + company FK nullable (sistem aksiyonu) + superadmin override fields', () => {
    expect(auditLogs.userId).toBeDefined();
    expect(auditLogs.companyId).toBeDefined();
    expect(auditLogs.action).toBeDefined();
    expect(auditLogs.beforeState).toBeDefined();
    expect(auditLogs.afterState).toBeDefined();
    expect(auditLogs.performedAsSuperadmin).toBeDefined();
    expect(auditLogs.superadminActionType).toBeDefined();
    expect(auditLogs.superadminReason).toBeDefined();
  });
});

describe('Schema — Sprint 1B.2 sessions + sayım + vitrin events', () => {
  it('sessions: sessionToken PK + user FK + expires + cihaz takibi (ip/ua/deviceLabel/lastActivity)', () => {
    expect(sessions.sessionToken).toBeDefined();
    expect(sessions.userId).toBeDefined();
    expect(sessions.expires).toBeDefined();
    expect(sessions.ipAddress).toBeDefined();
    expect(sessions.userAgent).toBeDefined();
    expect(sessions.deviceLabel).toBeDefined();
    expect(sessions.lastActivityAt).toBeDefined();
  });

  it('stocktakes: company+branch FK + mode + status default in_progress + softLock + startedBy', () => {
    expect(stocktakes.companyId).toBeDefined();
    expect(stocktakes.branchId).toBeDefined();
    expect(stocktakes.mode).toBeDefined();
    expect(stocktakes.categoryId).toBeDefined();
    expect(stocktakes.softLock).toBeDefined();
    expect(stocktakes.status).toBeDefined();
    expect(stocktakes.totalItems).toBeDefined();
    expect(stocktakes.countedItems).toBeDefined();
    expect(stocktakes.diffItems).toBeDefined();
    expect(stocktakes.valueImpact).toBeDefined();
    expect(stocktakes.startedById).toBeDefined();
    expect(stocktakes.closedAt).toBeDefined();
  });

  it('stocktakeItems: stocktake FK + variant FK + systemQty/countedQty/diff + reason enum + isSkipped', () => {
    expect(stocktakeItems.stocktakeId).toBeDefined();
    expect(stocktakeItems.variantId).toBeDefined();
    expect(stocktakeItems.systemQty).toBeDefined();
    expect(stocktakeItems.countedQty).toBeDefined();
    expect(stocktakeItems.diff).toBeDefined();
    expect(stocktakeItems.reason).toBeDefined();
    expect(stocktakeItems.customReason).toBeDefined();
    expect(stocktakeItems.isSkipped).toBeDefined();
  });

  it('vitrinEvents: company FK + eventType + visitor anonim (ipHash/cityId/country) + UTM', () => {
    expect(vitrinEvents.companyId).toBeDefined();
    expect(vitrinEvents.branchId).toBeDefined();
    expect(vitrinEvents.productId).toBeDefined();
    expect(vitrinEvents.variantId).toBeDefined();
    expect(vitrinEvents.eventType).toBeDefined();
    expect(vitrinEvents.visitorIpHash).toBeDefined();
    expect(vitrinEvents.visitorCityId).toBeDefined();
    expect(vitrinEvents.visitorCountry).toBeDefined();
    expect(vitrinEvents.searchQuery).toBeDefined();
    expect(vitrinEvents.utmSource).toBeDefined();
    expect(vitrinEvents.utmMedium).toBeDefined();
    expect(vitrinEvents.utmCampaign).toBeDefined();
  });
});

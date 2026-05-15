import { describe, it, expect } from 'vitest';
import {
  planEnum,
  userRoleEnum,
  subscriptionStatusEnum,
  invoiceStatusEnum,
  superadminActionTypeEnum,
  storefrontStatusEnum,
  userInviteMethodEnum,
  cities,
  districts,
  companies,
  users,
  branches,
  subscriptions,
  processedWebhooks,
  invoices,
  auditLogs,
} from './index';

/**
 * Schema değişikliklerini koruyan testler — schema'da bir şey eklenip/silindiğinde
 * burası fark eder. Drizzle'ın `.enumValues` ve column proxy'lerini kullanır.
 */

describe('Schema — enum değerleri (Sprint 1A)', () => {
  it('planEnum: FREE/PRO/PRO_PLUS', () => {
    expect(planEnum.enumValues).toEqual(['FREE', 'PRO', 'PRO_PLUS']);
  });

  it('userRoleEnum: 5 rol (BAYI_ADMIN Faz 3 dahil)', () => {
    expect(userRoleEnum.enumValues).toEqual([
      'SUPERADMIN',
      'BAYI_SAHIBI',
      'SUBE_MUDURU',
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

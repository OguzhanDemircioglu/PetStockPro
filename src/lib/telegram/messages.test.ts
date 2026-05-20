import { describe, it, expect } from 'vitest';
import {
  buildAccountLockedAlert,
  buildDailyReportSummaryAlert,
  buildNewVitrinReportAlert,
  buildTwoFactorDisabledAlert,
  buildSitemapRebuildFailedAlert,
  buildSitemapCacheStaleAlert,
} from './messages';

describe('buildAccountLockedAlert', () => {
  it('BRUTE_FORCE_1H — warning severity', () => {
    const req = buildAccountLockedAlert({
      email: 'a@b.com',
      reason: 'BRUTE_FORCE_1H',
      recentLockCount: 1,
    });
    expect(req.severity).toBe('warning');
    expect(req.text).toContain('1 saat');
    expect(req.text).toContain('a@b.com');
    expect(req.text).toContain('BRUTE_FORCE_1H');
    expect(req.parseMode).toBe('HTML');
  });

  it('BRUTE_FORCE_24H — critical severity + saldırı uyarısı', () => {
    const req = buildAccountLockedAlert({
      email: 'victim@petshop.com',
      reason: 'BRUTE_FORCE_24H',
      recentLockCount: 3,
    });
    expect(req.severity).toBe('critical');
    expect(req.text).toContain('🚨');
    expect(req.text).toContain('KRİTİK');
    expect(req.text).toContain('saldırı şüphesi');
    expect(req.text).toContain('3');
  });

  it('IP verildiğinde HTML\'de görünür', () => {
    const req = buildAccountLockedAlert({
      email: 'a@b.com',
      reason: 'BRUTE_FORCE_1H',
      recentLockCount: 1,
      ipAddress: '203.0.113.5',
    });
    expect(req.text).toContain('203.0.113.5');
  });

  it('IP yokken IP satırı yok', () => {
    const req = buildAccountLockedAlert({
      email: 'a@b.com',
      reason: 'BRUTE_FORCE_1H',
      recentLockCount: 1,
    });
    expect(req.text).not.toContain('IP:');
  });
});

describe('buildTwoFactorDisabledAlert', () => {
  it('Email + tenant adı → mesaj', () => {
    const req = buildTwoFactorDisabledAlert({
      email: 'a@b.com',
      companyName: 'Mavi Pet',
    });
    expect(req.text).toContain('2FA kapatıldı');
    expect(req.text).toContain('a@b.com');
    expect(req.text).toContain('Mavi Pet');
    expect(req.severity).toBe('info');
    expect(req.disableNotification).toBe(true); // info → sessiz
  });

  it('Tenant adı null ise tenant satırı yok', () => {
    const req = buildTwoFactorDisabledAlert({
      email: 'a@b.com',
      companyName: null,
    });
    expect(req.text).not.toContain('Tenant:');
  });
});

describe('buildNewVitrinReportAlert', () => {
  it('storefront target — tenant + sebep + warning severity', () => {
    const req = buildNewVitrinReportAlert({
      companyName: 'Mavi Pet',
      targetType: 'storefront',
      reason: 'spam',
    });
    expect(req.text).toContain('Yeni vitrin şikayeti');
    expect(req.text).toContain('Mavi Pet');
    expect(req.text).toContain('Tüm pet shop profili');
    expect(req.text).toContain('Spam / reklam'); // TR-localize
    expect(req.severity).toBe('warning');
    expect(req.parseMode).toBe('HTML');
  });

  it('product target — ürün adı satırı', () => {
    const req = buildNewVitrinReportAlert({
      companyName: 'Mavi Pet',
      targetType: 'product',
      productName: 'Royal Canin Kedi 2kg',
      reason: 'wrong_photo',
    });
    expect(req.text).toContain('Ürün:');
    expect(req.text).toContain('Royal Canin Kedi 2kg');
    expect(req.text).toContain('Yanlış fotoğraf');
    expect(req.text).not.toContain('Tüm pet shop profili');
  });

  it('note çok uzunsa 200 char truncate + …', () => {
    const longNote = 'x'.repeat(300);
    const req = buildNewVitrinReportAlert({
      companyName: 'Mavi Pet',
      targetType: 'storefront',
      reason: 'other',
      note: longNote,
    });
    // 197 + … = 198 char görünür, ama HTML wrapper ile <i>...</i>
    expect(req.text).toContain('xxx');
    expect(req.text).toContain('…');
  });

  it('note yok → Not: satırı yok', () => {
    const req = buildNewVitrinReportAlert({
      companyName: 'Mavi Pet',
      targetType: 'storefront',
      reason: 'spam',
    });
    expect(req.text).not.toContain('Not:');
  });

  it('panelUrl varsa link içerir', () => {
    const req = buildNewVitrinReportAlert({
      companyName: 'Mavi Pet',
      targetType: 'storefront',
      reason: 'spam',
      panelUrl: '/admin/superadmin/vitrin-moderation?tab=reports',
    });
    expect(req.text).toContain(
      'href="/admin/superadmin/vitrin-moderation?tab=reports"',
    );
  });

  it('bilinmeyen reason → raw string fallback', () => {
    const req = buildNewVitrinReportAlert({
      companyName: 'Mavi Pet',
      targetType: 'storefront',
      reason: 'custom_xyz',
    });
    expect(req.text).toContain('custom_xyz');
  });
});

describe('buildDailyReportSummaryAlert', () => {
  it('boş 24h → bilgi mesajı + sessiz', () => {
    const req = buildDailyReportSummaryAlert({
      windowHours: 24,
      totalReports: 0,
      pendingCount: 0,
      resolvedCount: 0,
      dismissedCount: 0,
      topTenants: [],
    });
    expect(req.text).toContain('hiç şikayet gelmedi');
    expect(req.severity).toBe('info');
    expect(req.disableNotification).toBe(true);
  });

  it('düşük pending (< 5) → info', () => {
    const req = buildDailyReportSummaryAlert({
      windowHours: 24,
      totalReports: 6,
      pendingCount: 3,
      resolvedCount: 2,
      dismissedCount: 1,
      topTenants: [
        { companyName: 'Mavi Pet', pendingCount: 2 },
        { companyName: 'Sarı Pet', pendingCount: 1 },
      ],
    });
    expect(req.text).toContain('Toplam:');
    expect(req.text).toContain('6');
    expect(req.text).toContain('Mavi Pet');
    expect(req.text).toContain('Sarı Pet');
    expect(req.severity).toBe('info');
    expect(req.disableNotification).toBe(true);
  });

  it('yüksek pending (>=5) → warning + sesli bildirim', () => {
    const req = buildDailyReportSummaryAlert({
      windowHours: 24,
      totalReports: 10,
      pendingCount: 7,
      resolvedCount: 2,
      dismissedCount: 1,
      topTenants: [{ companyName: 'Mavi Pet', pendingCount: 7 }],
    });
    expect(req.severity).toBe('warning');
    expect(req.disableNotification).toBe(false);
  });

  it('windowHours custom değer', () => {
    const req = buildDailyReportSummaryAlert({
      windowHours: 48,
      totalReports: 0,
      pendingCount: 0,
      resolvedCount: 0,
      dismissedCount: 0,
      topTenants: [],
    });
    expect(req.text).toContain('48s');
  });

  it('panelUrl varsa link içerir', () => {
    const req = buildDailyReportSummaryAlert({
      windowHours: 24,
      totalReports: 3,
      pendingCount: 3,
      resolvedCount: 0,
      dismissedCount: 0,
      topTenants: [{ companyName: 'X', pendingCount: 3 }],
      panelUrl: '/admin/superadmin/vitrin-moderation?tab=reports',
    });
    expect(req.text).toContain(
      'href="/admin/superadmin/vitrin-moderation?tab=reports"',
    );
  });

  it('topTenants boş → "En çok bekleyen tenant" satırı yok', () => {
    const req = buildDailyReportSummaryAlert({
      windowHours: 24,
      totalReports: 2,
      pendingCount: 0,
      resolvedCount: 2,
      dismissedCount: 0,
      topTenants: [],
    });
    expect(req.text).not.toContain('En çok bekleyen tenant:');
  });
});

describe('buildSitemapRebuildFailedAlert', () => {
  it('critical severity + hata mesajı + panel link', () => {
    const req = buildSitemapRebuildFailedAlert({
      triggeredAt: '2026-05-21T03:00:00Z',
      errorMessage: 'Connection timeout to Postgres',
      panelUrl: 'https://petstockpro.com/admin/superadmin/system-settings',
    });
    expect(req.severity).toBe('critical');
    expect(req.disableNotification).toBe(false);
    expect(req.text).toContain('Sitemap rebuild başarısız');
    expect(req.text).toContain('Connection timeout');
    expect(req.text).toContain('https://petstockpro.com/admin/superadmin/system-settings');
  });

  it('HTML tag içeren error sanitize edilir', () => {
    const req = buildSitemapRebuildFailedAlert({
      triggeredAt: '2026-05-21T03:00:00Z',
      errorMessage: '<script>alert(1)</script>Bad input',
    });
    expect(req.text).not.toContain('<script>');
    expect(req.text).not.toContain('</script>');
  });

  it('errorMessage 250 char ile kesilir', () => {
    const longErr = 'x'.repeat(500);
    const req = buildSitemapRebuildFailedAlert({
      triggeredAt: '2026-05-21T03:00:00Z',
      errorMessage: longErr,
    });
    expect(req.text).toContain('x'.repeat(250));
    expect(req.text).not.toContain('x'.repeat(251));
  });

  it('panelUrl yok ise link section çıkmaz', () => {
    const req = buildSitemapRebuildFailedAlert({
      triggeredAt: '2026-05-21T03:00:00Z',
      errorMessage: 'fail',
    });
    expect(req.text).not.toContain('Sistem ayarları →');
  });
});

describe('buildSitemapCacheStaleAlert', () => {
  it('warning severity + yaş ve cachedAt göster', () => {
    const req = buildSitemapCacheStaleAlert({
      ageHours: 28.7,
      cachedAt: '2026-05-19T23:00:00Z',
      panelUrl: 'https://x.com/admin',
    });
    expect(req.severity).toBe('warning');
    expect(req.text).toContain('Sitemap cache yaşlandı');
    expect(req.text).toContain('29 saat'); // round
    expect(req.text).toContain('2026-05-19T23:00:00Z');
    expect(req.text).toContain('https://x.com/admin');
  });
});

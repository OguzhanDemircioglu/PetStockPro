import { describe, it, expect } from 'vitest';
import { buildAccountLockedAlert, buildTwoFactorDisabledAlert } from './messages';

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

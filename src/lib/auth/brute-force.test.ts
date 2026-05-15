import { describe, it, expect } from 'vitest';
import {
  processFailedLogin,
  processSuccessfulLogin,
  isLocked,
  getLockRemainingSeconds,
  getRemainingAttemptsMessage,
  LOCK_DURATION_MS,
  PERMANENT_LOCK_DURATION_MS,
  FAIL_THRESHOLD,
} from './brute-force';

const NOW = new Date('2026-05-15T12:00:00Z');

describe('processFailedLogin', () => {
  it('1. yanlış → 4 hak kaldı, banner yok', () => {
    const result = processFailedLogin(
      { failedLoginCount: 0, lockedUntil: null },
      NOW,
    );
    expect(result.shouldLock).toBe(false);
    expect(result.newFailedCount).toBe(1);
    expect(result.remainingAttempts).toBe(4);
    expect(result.showRemainingBanner).toBe(false);
  });

  it('2. yanlış → 3 hak kaldı, banner yok (parmak hatası varsayımı)', () => {
    const result = processFailedLogin(
      { failedLoginCount: 1, lockedUntil: null },
      NOW,
    );
    expect(result.remainingAttempts).toBe(3);
    expect(result.showRemainingBanner).toBe(false);
  });

  it('3. yanlış → 2 hak kaldı, banner gösterilir', () => {
    const result = processFailedLogin(
      { failedLoginCount: 2, lockedUntil: null },
      NOW,
    );
    expect(result.newFailedCount).toBe(3);
    expect(result.remainingAttempts).toBe(2);
    expect(result.showRemainingBanner).toBe(true);
  });

  it('4. yanlış → 1 hak kaldı, banner', () => {
    const result = processFailedLogin(
      { failedLoginCount: 3, lockedUntil: null },
      NOW,
    );
    expect(result.remainingAttempts).toBe(1);
    expect(result.showRemainingBanner).toBe(true);
  });

  it('5. yanlış → LOCK 1 saat, failedCount reset', () => {
    const result = processFailedLogin(
      { failedLoginCount: 4, lockedUntil: null },
      NOW,
    );
    expect(result.shouldLock).toBe(true);
    expect(result.newFailedCount).toBe(0);
    expect(result.newLockedUntil).toEqual(new Date(NOW.getTime() + LOCK_DURATION_MS));
    expect(result.isPermanentLock).toBe(false);
    expect(result.remainingAttempts).toBe(0);
  });

  it('3 art arda lock → 24 saat KALICI lock', () => {
    const result = processFailedLogin(
      { failedLoginCount: 4, lockedUntil: null, recentLockCount: 2 },
      NOW,
    );
    expect(result.shouldLock).toBe(true);
    expect(result.isPermanentLock).toBe(true);
    expect(result.newLockedUntil).toEqual(new Date(NOW.getTime() + PERMANENT_LOCK_DURATION_MS));
  });

  it('FAIL_THRESHOLD constant 5', () => {
    expect(FAIL_THRESHOLD).toBe(5);
  });

  it('1 saat lock duration milliseconds', () => {
    expect(LOCK_DURATION_MS).toBe(3600 * 1000);
  });

  it('24 saat permanent lock duration', () => {
    expect(PERMANENT_LOCK_DURATION_MS).toBe(24 * 3600 * 1000);
  });
});

describe('processSuccessfulLogin', () => {
  it('failedCount 0 + lockedUntil null', () => {
    const result = processSuccessfulLogin();
    expect(result.newFailedCount).toBe(0);
    expect(result.newLockedUntil).toBeNull();
  });
});

describe('isLocked', () => {
  it('lockedUntil null → false', () => {
    expect(isLocked({ failedLoginCount: 0, lockedUntil: null }, NOW)).toBe(false);
  });

  it('lockedUntil gelecekte → true', () => {
    const future = new Date(NOW.getTime() + 1000);
    expect(isLocked({ failedLoginCount: 0, lockedUntil: future }, NOW)).toBe(true);
  });

  it('lockedUntil geçmişte → false (süresi dolmuş)', () => {
    const past = new Date(NOW.getTime() - 1000);
    expect(isLocked({ failedLoginCount: 0, lockedUntil: past }, NOW)).toBe(false);
  });

  it('lockedUntil tam şimdi → false (boundary)', () => {
    expect(isLocked({ failedLoginCount: 0, lockedUntil: NOW }, NOW)).toBe(false);
  });
});

describe('getLockRemainingSeconds', () => {
  it('lock yok → 0', () => {
    expect(getLockRemainingSeconds({ failedLoginCount: 0, lockedUntil: null }, NOW)).toBe(0);
  });

  it('1 dakika kaldı → 60', () => {
    const future = new Date(NOW.getTime() + 60 * 1000);
    expect(getLockRemainingSeconds({ failedLoginCount: 0, lockedUntil: future }, NOW)).toBe(60);
  });

  it('1 saat kaldı → 3600', () => {
    const future = new Date(NOW.getTime() + 3600 * 1000);
    expect(getLockRemainingSeconds({ failedLoginCount: 0, lockedUntil: future }, NOW)).toBe(3600);
  });

  it('süre dolmuş → 0 (negatife düşmez)', () => {
    const past = new Date(NOW.getTime() - 5000);
    expect(getLockRemainingSeconds({ failedLoginCount: 0, lockedUntil: past }, NOW)).toBe(0);
  });

  it('5.4 saniye → 6 (ceiling, UI countdown için)', () => {
    const future = new Date(NOW.getTime() + 5400);
    expect(getLockRemainingSeconds({ failedLoginCount: 0, lockedUntil: future }, NOW)).toBe(6);
  });
});

describe('getRemainingAttemptsMessage', () => {
  it('5 hak → null (yeni kullanıcı, banner yok)', () => {
    expect(getRemainingAttemptsMessage(5)).toBeNull();
  });

  it('4 hak → null (1 fail, parmak hatası)', () => {
    expect(getRemainingAttemptsMessage(4)).toBeNull();
  });

  it('3 hak → null (banner threshold REMAINING_BANNER_FROM=3 dahil değil — hâlâ 3 hak var)', () => {
    // 3+ kaldıysa banner gösterme — 3, 4, 5 hep null
    expect(getRemainingAttemptsMessage(3)).toBeNull();
  });

  it('2 hak → "2 hakkın kaldı"', () => {
    expect(getRemainingAttemptsMessage(2)).toBe('2 hakkın kaldı');
  });

  it('1 hak → "1 hakkın kaldı + 1 saat lock uyarı"', () => {
    expect(getRemainingAttemptsMessage(1)).toBe('1 hakkın kaldı — sonraki yanlış 1 saatlik kilit getirir');
  });

  it('0 hak → "Hesap kilitli"', () => {
    expect(getRemainingAttemptsMessage(0)).toBe('Hesap kilitli');
  });
});

import { describe, it, expect } from 'vitest';
import {
  generateResetToken,
  createResetToken,
  verifyResetToken,
  RESET_TOKEN_TTL_MS,
} from './password-reset';

describe('generateResetToken', () => {
  it('base64url 43 karakter token üretir', () => {
    const token = generateResetToken();
    expect(token).toHaveLength(43);
    // base64url charset: A-Z a-z 0-9 - _
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('her çağrı farklı token üretir (rastgelelik)', () => {
    const t1 = generateResetToken();
    const t2 = generateResetToken();
    expect(t1).not.toBe(t2);
  });
});

describe('createResetToken', () => {
  it('30 dk geçerli token + expiry üretir', () => {
    const now = new Date('2026-05-15T10:00:00Z');
    const result = createResetToken(now);

    expect(result.token).toHaveLength(43);
    expect(result.expiresAt.getTime() - now.getTime()).toBe(RESET_TOKEN_TTL_MS);
    expect(result.expiresAt.toISOString()).toBe('2026-05-15T10:30:00.000Z');
  });
});

describe('verifyResetToken', () => {
  it('geçerli token + dolmamış expiry → ok', () => {
    const now = new Date('2026-05-15T10:00:00Z');
    const token = generateResetToken();

    const result = verifyResetToken(
      {
        passwordResetToken: token,
        passwordResetExpiresAt: new Date(now.getTime() + 15 * 60 * 1000),
      },
      token,
      now,
    );

    expect(result.ok).toBe(true);
  });

  it('DB token NULL → invalid_token', () => {
    const result = verifyResetToken(
      { passwordResetToken: null, passwordResetExpiresAt: null },
      'anything',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_token');
  });

  it('provided token boş → invalid_token', () => {
    const result = verifyResetToken(
      {
        passwordResetToken: generateResetToken(),
        passwordResetExpiresAt: new Date(Date.now() + 60000),
      },
      '',
    );
    expect(result.ok).toBe(false);
  });

  it('farklı token uzunluğu → invalid_token (timing-safe early return)', () => {
    const result = verifyResetToken(
      {
        passwordResetToken: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        passwordResetExpiresAt: new Date(Date.now() + 60000),
      },
      'short',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_token');
  });

  it('aynı uzunlukta farklı token → invalid_token', () => {
    const result = verifyResetToken(
      {
        passwordResetToken: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        passwordResetExpiresAt: new Date(Date.now() + 60000),
      },
      'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_token');
  });

  it('süresi dolmuş token → expired', () => {
    const now = new Date('2026-05-15T11:00:00Z');
    const token = generateResetToken();

    const result = verifyResetToken(
      {
        passwordResetToken: token,
        passwordResetExpiresAt: new Date(now.getTime() - 1000), // 1 sn önce expired
      },
      token,
      now,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('expired');
  });

  it('expiresAt NULL ama token doğru → ok (defansif default)', () => {
    const token = generateResetToken();
    const result = verifyResetToken(
      { passwordResetToken: token, passwordResetExpiresAt: null },
      token,
    );
    // Token doğru, expiry NULL → caller bunu zaten "süresiz" anlamında kullanmamalı,
    // ama helper teknik olarak geçerli kabul eder (DB temizleme caller'ın sorumluluğu)
    expect(result.ok).toBe(true);
  });
});

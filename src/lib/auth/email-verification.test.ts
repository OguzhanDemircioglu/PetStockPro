import { describe, it, expect } from 'vitest';
import {
  generateVerificationToken,
  createVerificationToken,
  canResendVerification,
  verifyEmailToken,
  isGracePeriodExpired,
  VERIFICATION_TOKEN_TTL_MS,
  RESEND_COOLDOWN_MS,
  RESEND_MAX_COUNT,
  VERIFICATION_GRACE_PERIOD_MS,
  type VerificationTokenState,
} from './email-verification';

const NOW = new Date('2026-05-15T12:00:00Z');

describe('generateVerificationToken', () => {
  it('43 karakter base64url döner (32 byte)', () => {
    const t = generateVerificationToken();
    expect(t.length).toBe(43);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('her çağrıda farklı token (crypto random)', () => {
    const a = generateVerificationToken();
    const b = generateVerificationToken();
    expect(a).not.toBe(b);
  });
});

describe('createVerificationToken', () => {
  it('token + 24 saat sonra expiresAt', () => {
    const result = createVerificationToken(NOW);
    expect(result.token).toHaveLength(43);
    expect(result.expiresAt).toEqual(new Date(NOW.getTime() + VERIFICATION_TOKEN_TTL_MS));
  });

  it('VERIFICATION_TOKEN_TTL_MS = 24 saat', () => {
    expect(VERIFICATION_TOKEN_TTL_MS).toBe(24 * 3600 * 1000);
  });
});

describe('canResendVerification', () => {
  const emptyState: VerificationTokenState = {
    emailVerificationToken: null,
    emailVerificationExpiresAt: null,
    emailVerificationResendCount: 0,
    emailVerificationLastSentAt: null,
  };

  it('ilk resend (lastSentAt null) → ok=true, count=1', () => {
    const result = canResendVerification(emptyState, NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.newCount).toBe(1);
      expect(result.newLastSentAt).toEqual(NOW);
    }
  });

  it('30sn önce gönderildi → cooldown reject', () => {
    const state = {
      ...emptyState,
      emailVerificationLastSentAt: new Date(NOW.getTime() - 30 * 1000),
      emailVerificationResendCount: 1,
    };
    const result = canResendVerification(state, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('cooldown');
      expect((result as { reason: 'cooldown'; retryAfterSeconds: number }).retryAfterSeconds).toBe(30);
    }
  });

  it('61sn önce gönderildi → cooldown geçti, ok=true', () => {
    const state = {
      ...emptyState,
      emailVerificationLastSentAt: new Date(NOW.getTime() - 61 * 1000),
      emailVerificationResendCount: 2,
    };
    const result = canResendVerification(state, NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.newCount).toBe(3); // 2 + 1
    }
  });

  it('5 resend yapılmış, cooldown geçti → max_count reject', () => {
    const state = {
      ...emptyState,
      emailVerificationLastSentAt: new Date(NOW.getTime() - 2 * 60 * 1000), // 2 dk önce
      emailVerificationResendCount: RESEND_MAX_COUNT,
    };
    const result = canResendVerification(state, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('max_count');
    }
  });

  it('5 resend ama 24h+ önce → count stale, ok=true (yeni cycle)', () => {
    const state = {
      ...emptyState,
      emailVerificationLastSentAt: new Date(NOW.getTime() - 25 * 60 * 60 * 1000), // 25h önce
      emailVerificationResendCount: RESEND_MAX_COUNT,
    };
    const result = canResendVerification(state, NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.newCount).toBe(1); // reset, yeni cycle
    }
  });

  it('RESEND_COOLDOWN_MS = 60 saniye', () => {
    expect(RESEND_COOLDOWN_MS).toBe(60 * 1000);
  });

  it('RESEND_MAX_COUNT = 5', () => {
    expect(RESEND_MAX_COUNT).toBe(5);
  });
});

describe('verifyEmailToken', () => {
  const validState: VerificationTokenState = {
    emailVerificationToken: 'abcdef-test-token-43-char-long-for-test-here-1',
    emailVerificationExpiresAt: new Date(NOW.getTime() + 60 * 60 * 1000), // 1 saat sonra
    emailVerificationResendCount: 1,
    emailVerificationLastSentAt: NOW,
  };

  it('doğru token + ttl dolmadı → ok=true', () => {
    const result = verifyEmailToken(validState, validState.emailVerificationToken!, NOW);
    expect(result.ok).toBe(true);
  });

  it('yanlış token → invalid_token', () => {
    const result = verifyEmailToken(validState, 'wrong-token-same-length-but-different-content', NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_token');
  });

  it('token length mismatch → invalid_token (timing-safe)', () => {
    const result = verifyEmailToken(validState, 'short', NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_token');
  });

  it('expired token → expired', () => {
    const expiredState = {
      ...validState,
      emailVerificationExpiresAt: new Date(NOW.getTime() - 1000), // 1sn önce expire
    };
    const result = verifyEmailToken(expiredState, validState.emailVerificationToken!, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('expired');
  });

  it('boş state token → invalid_token', () => {
    const result = verifyEmailToken(
      { ...validState, emailVerificationToken: null },
      'any-token',
      NOW,
    );
    expect(result.ok).toBe(false);
  });

  it('boş provided token → invalid_token', () => {
    const result = verifyEmailToken(validState, '', NOW);
    expect(result.ok).toBe(false);
  });
});

describe('isGracePeriodExpired', () => {
  it('emailVerifiedAt set → false (verify edilmiş)', () => {
    const createdAt = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 gün önce
    const verifiedAt = new Date(NOW.getTime() - 25 * 24 * 60 * 60 * 1000);
    expect(isGracePeriodExpired(createdAt, verifiedAt, NOW)).toBe(false);
  });

  it('6 gün önce kayıt + verify yok → false (henüz grace içinde)', () => {
    const createdAt = new Date(NOW.getTime() - 6 * 24 * 60 * 60 * 1000);
    expect(isGracePeriodExpired(createdAt, null, NOW)).toBe(false);
  });

  it('8 gün önce kayıt + verify yok → true (grace period geçti)', () => {
    const createdAt = new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1000);
    expect(isGracePeriodExpired(createdAt, null, NOW)).toBe(true);
  });

  it('VERIFICATION_GRACE_PERIOD_MS = 7 gün', () => {
    expect(VERIFICATION_GRACE_PERIOD_MS).toBe(7 * 24 * 3600 * 1000);
  });
});

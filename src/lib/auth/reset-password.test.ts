import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'node:crypto';
import { completePasswordReset } from './reset-password';
import { generateResetToken, RESET_TOKEN_TTL_MS } from './password-reset';
import type { DbClient } from '@/lib/db/client';

vi.mock('@/lib/brevo/client', () => ({
  sendBrevoEmail: vi.fn().mockResolvedValue({ ok: true, mock: true }),
}));

import { sendBrevoEmail } from '@/lib/brevo/client';

interface UserRow {
  id: string;
  email: string;
  passwordResetToken: string | null;
  passwordResetExpiresAt: Date | null;
}

interface MockOpts {
  userRow?: UserRow | null;
  updateThrows?: boolean;
}

function makeMockDb(opts: MockOpts = {}): {
  db: DbClient;
  updateSet: ReturnType<typeof vi.fn>;
  updateWhere: ReturnType<typeof vi.fn>;
} {
  const rows = opts.userRow ? [opts.userRow] : [];

  const selectFn = vi.fn().mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  }));

  const updateWhere = vi.fn().mockImplementation(async () => {
    if (opts.updateThrows) throw new Error('DB constraint');
  });
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const updateFn = vi.fn().mockReturnValue({ set: updateSet });

  return {
    db: {
      select: selectFn,
      update: updateFn,
    } as unknown as DbClient,
    updateSet,
    updateWhere,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // HIBP fetch mock — şifre temiz (default)
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response('OTHER:1\n', { status: 200 }),
  );
  (sendBrevoEmail as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, mock: true });
});

describe('completePasswordReset', () => {
  const validToken = generateResetToken();
  const now = new Date();
  const validUser: UserRow = {
    id: 'user_abc',
    email: 'reset@petshop.com',
    passwordResetToken: validToken,
    passwordResetExpiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS),
  };

  // AUTH-036 + AUTH-040
  it('Geçerli token + güçlü şifre → ok + DB update + email', async () => {
    const { db, updateSet } = makeMockDb({ userRow: validUser });

    const result = await completePasswordReset(
      { token: validToken, password: 'YeniGuclu123' },
      db,
      { ipAddress: '203.0.113.50' },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.userId).toBe('user_abc');
      expect(result.email).toBe('reset@petshop.com');
    }

    // Update set verilerini kontrol et — token NULL + lock reset
    const setCallArg = updateSet.mock.calls[0]?.[0];
    expect(setCallArg).toMatchObject({
      passwordResetToken: null,
      passwordResetExpiresAt: null,
      failedLoginCount: 0,
      lockedUntil: null,
    });
    expect(setCallArg.passwordHash).toBeTypeOf('string');
    expect(setCallArg.passwordHash.length).toBeGreaterThan(20);

    // Brevo bilgilendirme
    expect(sendBrevoEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: { email: 'reset@petshop.com' },
        tags: ['password-reset', 'completed'],
      }),
    );
  });

  // AUTH-037
  it('Süresi dolmuş token → expired', async () => {
    const expiredUser: UserRow = {
      ...validUser,
      passwordResetExpiresAt: new Date(now.getTime() - 60_000),
    };
    const { db } = makeMockDb({ userRow: expiredUser });

    const result = await completePasswordReset(
      { token: validToken, password: 'YeniGuclu123' },
      db,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('expired');
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });

  // AUTH-042
  it('DB\'de bulunmayan token → invalid_token (tek kullanımlık invariant)', async () => {
    const { db } = makeMockDb({ userRow: null });

    const result = await completePasswordReset(
      { token: validToken, password: 'YeniGuclu123' },
      db,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_token');
  });

  // AUTH-038
  it('HIBP breached şifre → weak_password reason', async () => {
    // Dinamik SHA-1 hesapla — gerçek HIBP API response'unu mock'la
    const password = 'Password123';
    const sha1 = crypto.createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
    const breachedSuffix = sha1.slice(5);

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(`${breachedSuffix}:99999\nOTHER:1\n`, { status: 200 }),
    );

    const { db } = makeMockDb({ userRow: validUser });

    const result = await completePasswordReset({ token: validToken, password }, db);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('weak_password');
      expect(result.issues?.some((i) => i.includes('veri sızıntı'))).toBe(true);
    }
  });

  it('Zayıf şifre (8 char altı) → weak_password', async () => {
    const { db } = makeMockDb({ userRow: validUser });

    const result = await completePasswordReset(
      { token: validToken, password: 'kisa1A' },
      db,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('weak_password');
  });

  it('Şifre güçsüz kuralları (büyük harf yok) → weak_password', async () => {
    const { db } = makeMockDb({ userRow: validUser });

    const result = await completePasswordReset(
      { token: validToken, password: 'tumkucukbiseyler123' },
      db,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('weak_password');
      expect(result.issues?.some((i) => i.includes('büyük harf'))).toBe(true);
    }
  });

  it('Geçersiz token (çok kısa) → weak_password schema fail', async () => {
    const { db } = makeMockDb({ userRow: null });

    const result = await completePasswordReset(
      { token: 'short', password: 'YeniGuclu123' },
      db,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('weak_password');
  });

  it('Brevo bilgilendirme hatası reset başarısını bozmaz', async () => {
    (sendBrevoEmail as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Brevo down'));
    const { db } = makeMockDb({ userRow: validUser });

    const result = await completePasswordReset(
      { token: validToken, password: 'YeniGuclu123' },
      db,
    );

    expect(result.ok).toBe(true);
  });

  it('DB update hatası → unknown reason', async () => {
    const { db } = makeMockDb({ userRow: validUser, updateThrows: true });

    const result = await completePasswordReset(
      { token: validToken, password: 'YeniGuclu123' },
      db,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unknown');
  });

  it('ipAddress context email template\'ine geçer', async () => {
    const { db } = makeMockDb({ userRow: validUser });

    await completePasswordReset(
      { token: validToken, password: 'YeniGuclu123' },
      db,
      { ipAddress: '198.51.100.7' },
    );

    expect(sendBrevoEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        htmlContent: expect.stringContaining('198.51.100.7'),
      }),
    );
  });
});

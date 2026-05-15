import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initTwoFactorSetup,
  verifyTwoFactorSetup,
  enableTwoFactor,
  disableTwoFactor,
} from './two-factor-setup';
import {
  generateTotpSecret,
  generateTotpCode,
  generateRecoveryCodes,
  TWO_FACTOR_SETUP_TTL_MS,
} from './two-factor';
import type { DbClient } from '@/lib/db/client';
import type { RecoveryCode } from '@/db/schema';

interface UserRow {
  id: string;
  email?: string;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string | null;
  twoFactorRecoveryCodes?: RecoveryCode[] | null;
  twoFactorSetupSecret?: string | null;
  twoFactorSetupExpiresAt?: Date | null;
}

function makeMockDb(opts: { userRow?: UserRow | null } = {}): {
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

  const updateWhere = vi.fn().mockResolvedValue(undefined);
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
});

describe('initTwoFactorSetup', () => {
  const userRow: UserRow = {
    id: 'user_1',
    email: 'test@petshop.com',
    twoFactorEnabled: false,
  };

  // AUTH-043 (kısım 1)
  it('Secret + QR data URL + expiresAt döner', async () => {
    const { db, updateSet } = makeMockDb({ userRow });
    const now = new Date('2026-05-15T10:00:00Z');

    const result = await initTwoFactorSetup('user_1', db, now);

    expect(result.secret).toMatch(/^[A-Z2-7]+=*$/);
    expect(result.otpAuthUri).toContain('otpauth://totp/');
    expect(result.otpAuthUri).toContain('test%40petshop.com');
    expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(result.expiresAt.getTime() - now.getTime()).toBe(TWO_FACTOR_SETUP_TTL_MS);

    // DB'ye geçici secret yazıldı
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        twoFactorSetupSecret: result.secret,
        twoFactorSetupExpiresAt: result.expiresAt,
      }),
    );
  });

  it('Kullanıcı bulunamadı → throw', async () => {
    const { db } = makeMockDb({ userRow: null });
    await expect(initTwoFactorSetup('missing', db)).rejects.toThrow('Kullanıcı bulunamadı');
  });

  it('2FA zaten aktif → throw', async () => {
    const { db } = makeMockDb({
      userRow: { ...userRow, twoFactorEnabled: true },
    });
    await expect(initTwoFactorSetup('user_1', db)).rejects.toThrow('2FA zaten aktif');
  });
});

describe('verifyTwoFactorSetup', () => {
  // AUTH-043 (kısım 2)
  it('Doğru TOTP kod → ok + 8 recovery code', async () => {
    const secret = generateTotpSecret();
    const code = generateTotpCode(secret);
    const now = new Date();

    const { db, updateSet } = makeMockDb({
      userRow: {
        id: 'user_1',
        twoFactorSetupSecret: secret,
        twoFactorSetupExpiresAt: new Date(now.getTime() + 5 * 60 * 1000),
      },
    });

    const result = await verifyTwoFactorSetup('user_1', code, db, now);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.recoveryCodes).toHaveLength(8);
      // Recovery codes ABCD-EFGH formatında
      for (const c of result.recoveryCodes) {
        expect(c).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      }
    }

    // DB'ye hashed codes yazıldı
    const callArg = updateSet.mock.calls[0]?.[0];
    expect(callArg.twoFactorRecoveryCodes).toHaveLength(8);
    expect(callArg.twoFactorRecoveryCodes[0].hash).toMatch(/^[a-f0-9]{64}$/);
  });

  // AUTH-044
  it('Yanlış TOTP kod → invalid_code', async () => {
    const secret = generateTotpSecret();
    const { db } = makeMockDb({
      userRow: {
        id: 'user_1',
        twoFactorSetupSecret: secret,
        twoFactorSetupExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    const result = await verifyTwoFactorSetup('user_1', '999999', db);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_code');
  });

  it('Setup secret yok → no_setup', async () => {
    const { db } = makeMockDb({
      userRow: { id: 'user_1', twoFactorSetupSecret: null },
    });

    const result = await verifyTwoFactorSetup('user_1', '123456', db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no_setup');
  });

  it('Setup expired → expired', async () => {
    const secret = generateTotpSecret();
    const now = new Date('2026-05-15T11:00:00Z');
    const { db } = makeMockDb({
      userRow: {
        id: 'user_1',
        twoFactorSetupSecret: secret,
        twoFactorSetupExpiresAt: new Date(now.getTime() - 1000), // 1sn önce expired
      },
    });

    const result = await verifyTwoFactorSetup('user_1', generateTotpCode(secret), db, now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('expired');
  });
});

describe('enableTwoFactor', () => {
  const setupSecret = generateTotpSecret();
  const { hashed: recoveryCodes } = generateRecoveryCodes();
  const validRow: UserRow = {
    id: 'user_1',
    twoFactorSetupSecret: setupSecret,
    twoFactorSetupExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
    twoFactorRecoveryCodes: recoveryCodes,
  };

  // AUTH-046
  it('Doğru flow → ok + DB update', async () => {
    const { db, updateSet } = makeMockDb({ userRow: validRow });

    const result = await enableTwoFactor('user_1', true, db);
    expect(result.ok).toBe(true);

    const callArg = updateSet.mock.calls[0]?.[0];
    expect(callArg.twoFactorEnabled).toBe(true);
    expect(callArg.twoFactorSecret).toBe(setupSecret); // setup → kalıcı
    expect(callArg.twoFactorSetupSecret).toBeNull();   // temizlendi
    expect(callArg.twoFactorEnabledAt).toBeInstanceOf(Date);
  });

  it('Acknowledged=false → no_recovery_codes', async () => {
    const { db } = makeMockDb({ userRow: validRow });
    const result = await enableTwoFactor('user_1', false, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no_recovery_codes');
  });

  it('Setup secret yoksa → no_setup', async () => {
    const { db } = makeMockDb({
      userRow: { ...validRow, twoFactorSetupSecret: null },
    });
    const result = await enableTwoFactor('user_1', true, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no_setup');
  });

  it('Recovery codes üretilmemişse → no_recovery_codes', async () => {
    const { db } = makeMockDb({
      userRow: { ...validRow, twoFactorRecoveryCodes: null },
    });
    const result = await enableTwoFactor('user_1', true, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no_recovery_codes');
  });
});

describe('disableTwoFactor', () => {
  const secret = generateTotpSecret();
  const validRow: UserRow = {
    id: 'user_1',
    twoFactorEnabled: true,
    twoFactorSecret: secret,
  };

  // AUTH-047
  it('Doğru TOTP → ok + DB clear', async () => {
    const { db, updateSet } = makeMockDb({ userRow: validRow });
    const code = generateTotpCode(secret);

    const result = await disableTwoFactor('user_1', code, db);
    expect(result.ok).toBe(true);

    const callArg = updateSet.mock.calls[0]?.[0];
    expect(callArg.twoFactorEnabled).toBe(false);
    expect(callArg.twoFactorSecret).toBeNull();
    expect(callArg.twoFactorRecoveryCodes).toBeNull();
  });

  it('Yanlış TOTP → invalid_code', async () => {
    const { db } = makeMockDb({ userRow: validRow });
    const result = await disableTwoFactor('user_1', '999999', db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_code');
  });

  it('2FA aktif değil → not_enabled', async () => {
    const { db } = makeMockDb({
      userRow: { ...validRow, twoFactorEnabled: false },
    });
    const result = await disableTwoFactor('user_1', '123456', db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_enabled');
  });
});

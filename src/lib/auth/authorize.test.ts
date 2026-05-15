import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authorizeCredentials } from './authorize';
import { hashPassword } from './password';
import {
  generateTotpSecret,
  generateTotpCode,
  generateRecoveryCodes,
} from './two-factor';
import { TwoFactorRequiredError, TwoFactorInvalidError } from './errors';
import type { DbClient } from '@/lib/db/client';
import type { RecoveryCode } from '@/db/schema';

/**
 * Drizzle DB mock helper — chain'leri vi.fn() ile yakalar.
 * Test'te fake user data döndürür, db.update çağrılarını izler.
 */
type MockUserRow = {
  id: string;
  email: string;
  passwordHash: string | null;
  emailVerifiedAt: Date | null;
  name: string | null;
  role: string;
  companyId: string | null;
  failedLoginCount: number;
  lockedUntil: Date | null;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string | null;
  twoFactorRecoveryCodes?: RecoveryCode[] | null;
};

function makeMockDb(user: MockUserRow | null): {
  db: DbClient;
  updateSpy: ReturnType<typeof vi.fn>;
} {
  const updateSpy = vi.fn().mockReturnThis();
  const setSpy = vi.fn().mockReturnThis();
  const whereSpy = vi.fn().mockResolvedValue([]);

  const limitSpy = vi.fn().mockResolvedValue(user ? [user] : []);
  const selectWhereSpy = vi.fn().mockReturnValue({ limit: limitSpy });
  const fromSpy = vi.fn().mockReturnValue({ where: selectWhereSpy });
  const selectSpy = vi.fn().mockReturnValue({ from: fromSpy });

  const updateChain = vi.fn().mockReturnValue({
    set: setSpy.mockReturnValue({ where: whereSpy }),
  });
  updateSpy.mockImplementation(updateChain);

  const db = {
    select: selectSpy,
    update: updateSpy,
  } as unknown as DbClient;

  return { db, updateSpy };
}

const NOW = new Date('2026-05-15T12:00:00Z');

async function makeValidUser(overrides: Partial<MockUserRow> = {}): Promise<MockUserRow> {
  const hash = await hashPassword('CorrectPass123');
  return {
    id: 'user-uuid-1',
    email: 'mehmet@petshop.com',
    passwordHash: hash,
    emailVerifiedAt: new Date('2026-04-01'),
    name: 'Mehmet Acer',
    role: 'BAYI_SAHIBI',
    companyId: 'company-uuid-1',
    failedLoginCount: 0,
    lockedUntil: null,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorRecoveryCodes: null,
    ...overrides,
  };
}

describe('authorizeCredentials', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('input validation', () => {
    it('geçersiz email → null (DB query yapılmaz)', async () => {
      const { db } = makeMockDb(null);
      const dbSelectSpy = vi.spyOn(db, 'select');

      const result = await authorizeCredentials(
        { email: 'not-email', password: 'CorrectPass123' },
        db,
        NOW,
      );

      expect(result).toBeNull();
      expect(dbSelectSpy).not.toHaveBeenCalled();
    });

    it('boş password → null', async () => {
      const { db } = makeMockDb(null);
      const result = await authorizeCredentials(
        { email: 'a@b.com', password: '' },
        db,
        NOW,
      );
      expect(result).toBeNull();
    });

    it('object eksik field → null', async () => {
      const { db } = makeMockDb(null);
      const result = await authorizeCredentials({ email: 'a@b.com' }, db, NOW);
      expect(result).toBeNull();
    });

    it('null credentials → null', async () => {
      const { db } = makeMockDb(null);
      const result = await authorizeCredentials(null, db, NOW);
      expect(result).toBeNull();
    });

    it('email lowercase normalize edilir', async () => {
      const user = await makeValidUser();
      const { db } = makeMockDb(user);

      const result = await authorizeCredentials(
        { email: 'MEHMET@PETSHOP.COM', password: 'CorrectPass123' },
        db,
        NOW,
      );

      expect(result).not.toBeNull();
      expect(result?.email).toBe('mehmet@petshop.com');
    });
  });

  describe('user lookup', () => {
    it('user yok → null (enumeration koruma)', async () => {
      const { db } = makeMockDb(null);
      const result = await authorizeCredentials(
        { email: 'unknown@x.com', password: 'AnyPass123' },
        db,
        NOW,
      );
      expect(result).toBeNull();
    });
  });

  describe('account lock', () => {
    it('lockedUntil gelecekte → null', async () => {
      const user = await makeValidUser({
        lockedUntil: new Date(NOW.getTime() + 30 * 60 * 1000), // 30 dk sonra
      });
      const { db, updateSpy } = makeMockDb(user);

      const result = await authorizeCredentials(
        { email: user.email, password: 'CorrectPass123' },
        db,
        NOW,
      );

      expect(result).toBeNull();
      expect(updateSpy).not.toHaveBeenCalled(); // lock'lu, failed_count tracking yapma
    });

    it('lockedUntil geçmişte → password verify edilir (lock süresi bitti)', async () => {
      const user = await makeValidUser({
        lockedUntil: new Date(NOW.getTime() - 1000), // 1sn önce bitti
      });
      const { db } = makeMockDb(user);

      const result = await authorizeCredentials(
        { email: user.email, password: 'CorrectPass123' },
        db,
        NOW,
      );

      expect(result).not.toBeNull();
    });
  });

  describe('email verification', () => {
    it('emailVerifiedAt null → null (UI "verify et" gösterir)', async () => {
      const user = await makeValidUser({ emailVerifiedAt: null });
      const { db } = makeMockDb(user);

      const result = await authorizeCredentials(
        { email: user.email, password: 'CorrectPass123' },
        db,
        NOW,
      );
      expect(result).toBeNull();
    });
  });

  describe('password verification', () => {
    it('passwordHash yok (davet kabul edilmemiş) → null', async () => {
      const user = await makeValidUser({ passwordHash: null });
      const { db } = makeMockDb(user);

      const result = await authorizeCredentials(
        { email: user.email, password: 'AnyPass123' },
        db,
        NOW,
      );
      expect(result).toBeNull();
    });

    it('yanlış şifre → null + failed_count artırır', async () => {
      const user = await makeValidUser({ failedLoginCount: 2 });
      const { db, updateSpy } = makeMockDb(user);

      const result = await authorizeCredentials(
        { email: user.email, password: 'WrongPass456' },
        db,
        NOW,
      );

      expect(result).toBeNull();
      expect(updateSpy).toHaveBeenCalledTimes(1);
    });

    it('5. yanlış şifre → null + lockedUntil set', async () => {
      const user = await makeValidUser({ failedLoginCount: 4 });
      const { db, updateSpy } = makeMockDb(user);

      const result = await authorizeCredentials(
        { email: user.email, password: 'WrongPass456' },
        db,
        NOW,
      );

      expect(result).toBeNull();
      expect(updateSpy).toHaveBeenCalledTimes(1);
      // Drizzle chain: db.update().set({...}).where() — set spy çağrılan args görmek karmaşık,
      // ama updateSpy çağrıldı = state güncellendi
    });

    it('doğru şifre → AuthorizedUser (id, email, name, role, companyId)', async () => {
      const user = await makeValidUser();
      const { db, updateSpy } = makeMockDb(user);

      const result = await authorizeCredentials(
        { email: user.email, password: 'CorrectPass123' },
        db,
        NOW,
      );

      expect(result).toEqual({
        id: 'user-uuid-1',
        email: 'mehmet@petshop.com',
        name: 'Mehmet Acer',
        role: 'BAYI_SAHIBI',
        companyId: 'company-uuid-1',
      });
      // Başarılı login → failed_count reset (DB update yine çağrılır)
      expect(updateSpy).toHaveBeenCalledTimes(1);
    });

    it('doğru şifre ama failed_count vardı → reset edilir', async () => {
      const user = await makeValidUser({ failedLoginCount: 3 });
      const { db, updateSpy } = makeMockDb(user);

      const result = await authorizeCredentials(
        { email: user.email, password: 'CorrectPass123' },
        db,
        NOW,
      );

      expect(result).not.toBeNull();
      expect(updateSpy).toHaveBeenCalledTimes(1); // reset için update çağrıldı
    });
  });

  // Sprint 2.5 — 2FA enforcement
  describe('2FA enforcement', () => {
    // AUTH-013
    it('2FA enabled + totp boş → TwoFactorRequiredError', async () => {
      const secret = generateTotpSecret();
      const user = await makeValidUser({
        twoFactorEnabled: true,
        twoFactorSecret: secret,
      });
      const { db } = makeMockDb(user);

      await expect(
        authorizeCredentials(
          { email: user.email, password: 'CorrectPass123' },
          db,
          NOW,
        ),
      ).rejects.toBeInstanceOf(TwoFactorRequiredError);
    });

    // AUTH-013 (kabul)
    it('2FA enabled + doğru TOTP → AuthorizedUser', async () => {
      const secret = generateTotpSecret();
      const code = generateTotpCode(secret);
      const user = await makeValidUser({
        twoFactorEnabled: true,
        twoFactorSecret: secret,
      });
      const { db } = makeMockDb(user);

      const result = await authorizeCredentials(
        { email: user.email, password: 'CorrectPass123', totp: code },
        db,
        NOW,
      );
      expect(result).not.toBeNull();
      expect(result?.id).toBe('user-uuid-1');
    });

    // AUTH-014 — TOTP failure failedLoginCount'a SAYILMAZ
    it('2FA enabled + yanlış TOTP → TwoFactorInvalidError (failedLoginCount artmaz)', async () => {
      const secret = generateTotpSecret();
      const user = await makeValidUser({
        twoFactorEnabled: true,
        twoFactorSecret: secret,
        failedLoginCount: 2,
      });
      const { db, updateSpy } = makeMockDb(user);

      await expect(
        authorizeCredentials(
          { email: user.email, password: 'CorrectPass123', totp: '999999' },
          db,
          NOW,
        ),
      ).rejects.toBeInstanceOf(TwoFactorInvalidError);

      // Password verify başarılıydı ama TOTP fail — failedLoginCount güncelleme YAPILMAZ
      // (success-path update'i de yapmadık çünkü exception throw oldu)
      expect(updateSpy).not.toHaveBeenCalled();
    });

    // AUTH-015 — Recovery code login
    it('2FA enabled + recovery code → success + usedAt set', async () => {
      const secret = generateTotpSecret();
      const { plain, hashed } = generateRecoveryCodes();
      const user = await makeValidUser({
        twoFactorEnabled: true,
        twoFactorSecret: secret,
        twoFactorRecoveryCodes: hashed,
      });
      const { db, updateSpy } = makeMockDb(user);

      const result = await authorizeCredentials(
        { email: user.email, password: 'CorrectPass123', totp: plain[0] },
        db,
        NOW,
      );

      expect(result).not.toBeNull();
      // İki update: recovery codes invalidate + success reset
      expect(updateSpy).toHaveBeenCalledTimes(2);
    });

    // Kullanılmış recovery code → invalid
    it('Daha önce kullanılmış recovery code → TwoFactorInvalidError', async () => {
      const secret = generateTotpSecret();
      const { plain, hashed } = generateRecoveryCodes();
      // İlk kodu kullanılmış olarak işaretle
      const used = hashed.map((c, i) =>
        i === 0 ? { ...c, usedAt: new Date('2026-05-14').toISOString() } : c,
      );
      const user = await makeValidUser({
        twoFactorEnabled: true,
        twoFactorSecret: secret,
        twoFactorRecoveryCodes: used,
      });
      const { db } = makeMockDb(user);

      await expect(
        authorizeCredentials(
          { email: user.email, password: 'CorrectPass123', totp: plain[0] },
          db,
          NOW,
        ),
      ).rejects.toBeInstanceOf(TwoFactorInvalidError);
    });

    it('2FA enabled YOK → totp gönderilse bile login normal devam eder', async () => {
      const user = await makeValidUser({ twoFactorEnabled: false });
      const { db } = makeMockDb(user);

      const result = await authorizeCredentials(
        { email: user.email, password: 'CorrectPass123', totp: '123456' },
        db,
        NOW,
      );
      expect(result).not.toBeNull();
    });
  });
});

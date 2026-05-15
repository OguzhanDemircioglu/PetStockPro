import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initEmailChange,
  verifyEmailChange,
  cancelEmailChange,
} from './change-email';
import { hashPassword } from './password';
import type { DbClient } from '@/lib/db/client';

vi.mock('@/lib/brevo/client', () => ({
  sendBrevoEmail: vi.fn().mockResolvedValue({ ok: true, mock: true }),
}));
vi.mock('@/lib/telegram/client', () => ({
  sendTelegramAlert: vi.fn().mockResolvedValue({ ok: true, mock: true }),
}));

import { sendBrevoEmail } from '@/lib/brevo/client';
import { sendTelegramAlert } from '@/lib/telegram/client';

interface UserSelect {
  id?: string;
  email?: string;
  passwordHash?: string | null;
  pendingEmail?: string | null;
  pendingEmailExpiresAt?: Date | null;
  companyId?: string | null;
}

interface MockOpts {
  userRow?: UserSelect | null;
  conflicts?: boolean;
  pendingTokenRow?: UserSelect | null;
}

function makeMockDb(opts: MockOpts = {}): { db: DbClient; updateSet: ReturnType<typeof vi.fn> } {
  let selectIdx = 0;
  const selectReturns: UserSelect[][] = [];

  if (opts.userRow !== undefined) {
    selectReturns.push(opts.userRow ? [opts.userRow] : []);
    // conflict check (only when init flow)
    selectReturns.push(opts.conflicts ? [{ id: 'other' }] : []);
  } else if (opts.pendingTokenRow !== undefined) {
    selectReturns.push(opts.pendingTokenRow ? [opts.pendingTokenRow] : []);
  }

  const selectFn = vi.fn().mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockImplementation(async () => selectReturns[selectIdx++] ?? []),
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
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (sendBrevoEmail as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, mock: true });
  (sendTelegramAlert as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, mock: true });
});

describe('initEmailChange', () => {
  it('Geçerli input + doğru şifre → ok + 2 Brevo email (new + old)', async () => {
    const passwordHash = await hashPassword('CorrectPass123');
    const { db, updateSet } = makeMockDb({
      userRow: {
        id: 'u1',
        email: 'old@ps.com',
        passwordHash,
      },
      conflicts: false,
    });

    const result = await initEmailChange(
      'u1',
      { newEmail: 'new@ps.com', currentPassword: 'CorrectPass123' },
      db,
    );

    expect(result.ok).toBe(true);
    expect(sendBrevoEmail).toHaveBeenCalledTimes(2);
    expect(sendBrevoEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: { email: 'new@ps.com' }, tags: ['email-change', 'new-confirm'] }),
    );
    expect(sendBrevoEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: { email: 'old@ps.com' }, tags: ['email-change', 'old-notify'] }),
    );

    // DB update'inde pendingEmail set
    const setCall = updateSet.mock.calls[0]?.[0];
    expect(setCall.pendingEmail).toBe('new@ps.com');
    expect(setCall.pendingEmailToken).toBeTypeOf('string');
    expect(setCall.pendingEmailExpiresAt).toBeInstanceOf(Date);
  });

  it('Yanlış şifre → wrong_password', async () => {
    const passwordHash = await hashPassword('Correct123');
    const { db } = makeMockDb({
      userRow: { id: 'u1', email: 'old@ps.com', passwordHash },
      conflicts: false,
    });

    const result = await initEmailChange(
      'u1',
      { newEmail: 'new@ps.com', currentPassword: 'WrongPass!' },
      db,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('wrong_password');
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });

  it('Aynı email → same_email', async () => {
    const passwordHash = await hashPassword('Correct123');
    const { db } = makeMockDb({
      userRow: { id: 'u1', email: 'me@ps.com', passwordHash },
      conflicts: false,
    });

    const result = await initEmailChange(
      'u1',
      { newEmail: 'me@ps.com', currentPassword: 'Correct123' },
      db,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('same_email');
  });

  it('Email başka tenant\'ta var → taken', async () => {
    const passwordHash = await hashPassword('Correct123');
    const { db } = makeMockDb({
      userRow: { id: 'u1', email: 'me@ps.com', passwordHash },
      conflicts: true,
    });

    const result = await initEmailChange(
      'u1',
      { newEmail: 'taken@ps.com', currentPassword: 'Correct123' },
      db,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('taken');
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });

  it('Geçersiz email format → invalid_input', async () => {
    const { db } = makeMockDb({ userRow: { id: 'u1' }, conflicts: false });
    const result = await initEmailChange(
      'u1',
      { newEmail: 'not-an-email', currentPassword: 'Pass1234' },
      db,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_input');
  });

  it('User bulunamadı → unknown', async () => {
    const { db } = makeMockDb({ userRow: null, conflicts: false });
    const result = await initEmailChange(
      'u1',
      { newEmail: 'new@ps.com', currentPassword: 'Pass1234' },
      db,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unknown');
  });
});

describe('verifyEmailChange', () => {
  const validToken = 'a'.repeat(43); // 43 char base64url

  it('Geçerli token → email değişti + final Brevo email', async () => {
    const { db, updateSet } = makeMockDb({
      pendingTokenRow: {
        id: 'u1',
        email: 'old@ps.com',
        pendingEmail: 'new@ps.com',
        pendingEmailExpiresAt: new Date(Date.now() + 3600 * 1000),
      },
    });

    const result = await verifyEmailChange(validToken, db);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.oldEmail).toBe('old@ps.com');
      expect(result.newEmail).toBe('new@ps.com');
    }

    const setCall = updateSet.mock.calls[0]?.[0];
    expect(setCall.email).toBe('new@ps.com');
    expect(setCall.pendingEmail).toBeNull();
    expect(setCall.pendingEmailToken).toBeNull();

    expect(sendBrevoEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: { email: 'old@ps.com' }, tags: ['email-change', 'completed'] }),
    );
  });

  it('Token bulunamadı → invalid_token', async () => {
    const { db } = makeMockDb({ pendingTokenRow: null });
    const result = await verifyEmailChange(validToken, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_token');
  });

  it('Süresi dolmuş → expired', async () => {
    const { db } = makeMockDb({
      pendingTokenRow: {
        id: 'u1',
        email: 'old@ps.com',
        pendingEmail: 'new@ps.com',
        pendingEmailExpiresAt: new Date(Date.now() - 1000),
      },
    });
    const result = await verifyEmailChange(validToken, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('expired');
  });

  it('Token çok kısa → invalid_token (Zod fail)', async () => {
    const { db } = makeMockDb({ pendingTokenRow: null });
    const result = await verifyEmailChange('short', db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_token');
  });
});

describe('cancelEmailChange', () => {
  const validToken = 'a'.repeat(43);

  it('Token bulunduysa → ok + Telegram alert + pendingEmail NULL', async () => {
    const { db, updateSet } = makeMockDb({
      pendingTokenRow: {
        id: 'u1',
        email: 'me@ps.com',
        pendingEmail: 'attacker@evil.com',
        companyId: null,
      },
    });

    const result = await cancelEmailChange(validToken, db);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.email).toBe('me@ps.com');

    const setCall = updateSet.mock.calls[0]?.[0];
    expect(setCall.pendingEmail).toBeNull();
    expect(setCall.pendingEmailToken).toBeNull();

    expect(sendTelegramAlert).toHaveBeenCalled();
    const alertArg = (sendTelegramAlert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(alertArg.severity).toBe('critical');
    expect(alertArg.text).toContain('me@ps.com');
    expect(alertArg.text).toContain('attacker@evil.com');
  });

  it('Token bulunamadı → invalid_token', async () => {
    const { db } = makeMockDb({ pendingTokenRow: null });
    const result = await cancelEmailChange(validToken, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_token');
    expect(sendTelegramAlert).not.toHaveBeenCalled();
  });
});

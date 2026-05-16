import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  forcePasswordResetLink,
  resetTwoFactor,
  lockAccount,
  unlockAccount,
  forcePasswordResetSchema,
  resetTwoFactorSchema,
  lockAccountSchema,
  unlockAccountSchema,
} from './user-actions';
import type { DbClient } from '@/lib/db/client';

const TARGET = '11111111-1111-1111-1111-111111111111';
const NOW = new Date('2026-05-16T10:00:00Z');
const TELEMETRY = {
  superadminEmail: 'super@admin.com',
  reason: 'Müşteri destek talebi #1234',
};

vi.mock('@/lib/brevo/client', () => ({
  sendBrevoEmail: vi.fn(async () => undefined),
}));
vi.mock('@/lib/brevo/templates', () => ({
  buildResetPasswordTemplate: vi.fn(() => ({
    subject: 'Sıfırla',
    htmlContent: '<p>html</p>',
    textContent: 'text',
  })),
}));
vi.mock('@/lib/telegram/client', () => ({
  sendTelegramAlert: vi.fn(async () => undefined),
}));

function makeMockDb(opts: {
  userRow?: Record<string, unknown> | null;
  updateShouldThrow?: boolean;
}) {
  const select = vi.fn().mockImplementation(() => {
    const chain = {
      from: vi.fn().mockImplementation(() => chain),
      leftJoin: vi.fn().mockImplementation(() => chain),
      where: vi.fn().mockImplementation(() => chain),
      limit: vi.fn().mockResolvedValue(opts.userRow ? [opts.userRow] : []),
    };
    return chain;
  });

  const update = vi.fn().mockImplementation(() => ({
    set: vi.fn().mockImplementation(() => ({
      where: opts.updateShouldThrow
        ? vi.fn().mockRejectedValue(new Error('db fail'))
        : vi.fn().mockResolvedValue(undefined),
    })),
  }));

  return { select, update } as unknown as DbClient;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ══════════════════════════════════════════════════════════════
// Schemas
// ══════════════════════════════════════════════════════════════

describe('schemas', () => {
  it('forcePasswordResetSchema — UUID required', () => {
    expect(forcePasswordResetSchema.safeParse({ targetUserId: TARGET }).success).toBe(true);
    expect(forcePasswordResetSchema.safeParse({ targetUserId: 'bad' }).success).toBe(false);
  });

  it('resetTwoFactorSchema — UUID required', () => {
    expect(resetTwoFactorSchema.safeParse({ targetUserId: TARGET }).success).toBe(true);
    expect(resetTwoFactorSchema.safeParse({ targetUserId: 'bad' }).success).toBe(false);
  });

  it('lockAccountSchema — hours 1..720', () => {
    expect(lockAccountSchema.safeParse({ targetUserId: TARGET, hours: 24 }).success).toBe(true);
    expect(lockAccountSchema.safeParse({ targetUserId: TARGET, hours: 1 }).success).toBe(true);
    expect(lockAccountSchema.safeParse({ targetUserId: TARGET, hours: 720 }).success).toBe(true);
    expect(lockAccountSchema.safeParse({ targetUserId: TARGET, hours: 0 }).success).toBe(false);
    expect(lockAccountSchema.safeParse({ targetUserId: TARGET, hours: 721 }).success).toBe(false);
    expect(lockAccountSchema.safeParse({ targetUserId: TARGET, hours: 1.5 }).success).toBe(false);
  });

  it('unlockAccountSchema — UUID required', () => {
    expect(unlockAccountSchema.safeParse({ targetUserId: TARGET }).success).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════
// forcePasswordResetLink
// ══════════════════════════════════════════════════════════════

describe('forcePasswordResetLink', () => {
  it('happy — token üretilir, email gönderilir, ok=true', async () => {
    const db = makeMockDb({
      userRow: { id: TARGET, email: 'kayip@user.com', name: 'Kayıp Kullanıcı', companyName: 'Mavi Pet' },
    });
    const r = await forcePasswordResetLink({ targetUserId: TARGET }, TELEMETRY, db, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.targetEmail).toBe('kayip@user.com');
      expect(r.targetCompanyName).toBe('Mavi Pet');
      expect(r.emailSent).toBe(true);
      expect(r.tokenExpiresAt.getTime()).toBeGreaterThan(NOW.getTime());
    }
  });

  it('not_found — user yok', async () => {
    const db = makeMockDb({ userRow: null });
    const r = await forcePasswordResetLink({ targetUserId: TARGET }, TELEMETRY, db, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_found');
  });

  it('invalid_input — UUID fail', async () => {
    const db = makeMockDb({});
    const r = await forcePasswordResetLink({ targetUserId: 'bad' }, TELEMETRY, db, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('invalid_input');
  });

  it('unknown — db update throw', async () => {
    const db = makeMockDb({
      userRow: { id: TARGET, email: 'a@b.com', name: null, companyName: null },
      updateShouldThrow: true,
    });
    const r = await forcePasswordResetLink({ targetUserId: TARGET }, TELEMETRY, db, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('unknown');
  });
});

// ══════════════════════════════════════════════════════════════
// resetTwoFactor
// ══════════════════════════════════════════════════════════════

describe('resetTwoFactor', () => {
  it('happy — 2FA aktif user resetlenir', async () => {
    const db = makeMockDb({
      userRow: { id: TARGET, email: 'tfa@user.com', twoFactorEnabled: true, companyName: 'Mavi Pet' },
    });
    const r = await resetTwoFactor({ targetUserId: TARGET }, TELEMETRY, db, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.wasEnabled).toBe(true);
      expect(r.targetEmail).toBe('tfa@user.com');
    }
  });

  it('not_enabled — 2FA zaten kapalı', async () => {
    const db = makeMockDb({
      userRow: { id: TARGET, email: 'tfa@user.com', twoFactorEnabled: false, companyName: null },
    });
    const r = await resetTwoFactor({ targetUserId: TARGET }, TELEMETRY, db, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_enabled');
  });

  it('not_found — user yok', async () => {
    const db = makeMockDb({ userRow: null });
    const r = await resetTwoFactor({ targetUserId: TARGET }, TELEMETRY, db, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_found');
  });

  it('invalid_input — UUID fail', async () => {
    const db = makeMockDb({});
    const r = await resetTwoFactor({ targetUserId: 'bad' }, TELEMETRY, db, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('invalid_input');
  });
});

// ══════════════════════════════════════════════════════════════
// lockAccount
// ══════════════════════════════════════════════════════════════

describe('lockAccount', () => {
  it('happy — 24 saat lock', async () => {
    const db = makeMockDb({
      userRow: { id: TARGET, email: 'x@y.com', companyName: 'Mavi' },
    });
    const r = await lockAccount({ targetUserId: TARGET, hours: 24 }, TELEMETRY, db, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.hours).toBe(24);
      expect(r.lockedUntil.getTime()).toBe(NOW.getTime() + 24 * 60 * 60 * 1000);
    }
  });

  it('happy — 30 gün max (720 saat)', async () => {
    const db = makeMockDb({
      userRow: { id: TARGET, email: 'x@y.com', companyName: null },
    });
    const r = await lockAccount({ targetUserId: TARGET, hours: 720 }, TELEMETRY, db, NOW);
    expect(r.ok).toBe(true);
  });

  it('not_found', async () => {
    const db = makeMockDb({ userRow: null });
    const r = await lockAccount({ targetUserId: TARGET, hours: 1 }, TELEMETRY, db, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_found');
  });

  it('invalid_input — hours 0', async () => {
    const db = makeMockDb({});
    const r = await lockAccount({ targetUserId: TARGET, hours: 0 }, TELEMETRY, db, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('invalid_input');
  });
});

// ══════════════════════════════════════════════════════════════
// unlockAccount
// ══════════════════════════════════════════════════════════════

describe('unlockAccount', () => {
  it('happy — kilitli user açılır', async () => {
    const future = new Date(NOW.getTime() + 3600_000);
    const db = makeMockDb({
      userRow: { id: TARGET, email: 'x@y.com', lockedUntil: future, companyName: 'M' },
    });
    const r = await unlockAccount({ targetUserId: TARGET }, TELEMETRY, db, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.wasLocked).toBe(true);
  });

  it('happy — zaten kilitsiz user (no-op semantik)', async () => {
    const db = makeMockDb({
      userRow: { id: TARGET, email: 'x@y.com', lockedUntil: null, companyName: null },
    });
    const r = await unlockAccount({ targetUserId: TARGET }, TELEMETRY, db, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.wasLocked).toBe(false);
  });

  it('happy — geçmiş lockedUntil wasLocked=false', async () => {
    const past = new Date(NOW.getTime() - 3600_000);
    const db = makeMockDb({
      userRow: { id: TARGET, email: 'x@y.com', lockedUntil: past, companyName: null },
    });
    const r = await unlockAccount({ targetUserId: TARGET }, TELEMETRY, db, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.wasLocked).toBe(false);
  });

  it('not_found', async () => {
    const db = makeMockDb({ userRow: null });
    const r = await unlockAccount({ targetUserId: TARGET }, TELEMETRY, db, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_found');
  });
});

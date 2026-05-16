import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/auth/password', () => ({
  verifyPassword: vi.fn(),
}));

import { bypassReasonSchema, verifyBypassGuard, writeBypassAudit } from './bypass';
import { verifyPassword } from '@/lib/auth/password';
import type { DbClient } from '@/lib/db/client';

const SUPERADMIN = '11111111-1111-1111-1111-111111111111';
const COMPANY = '22222222-2222-2222-2222-222222222222';
const NOW = new Date('2026-05-16T12:00:00Z');

function makeMockDb(opts: {
  user?: { passwordHash: string; role: string } | null;
  auditInsertCalls?: Record<string, unknown>[];
}) {
  const calls = opts.auditInsertCalls ?? [];
  const select = vi.fn().mockImplementation(() => {
    const chain = {
      from: vi.fn().mockImplementation(() => chain),
      where: vi.fn().mockImplementation(() => chain),
      limit: vi.fn().mockResolvedValue(opts.user ? [opts.user] : []),
    };
    return chain;
  });
  const insert = vi.fn().mockImplementation(() => ({
    values: vi.fn().mockImplementation((v: Record<string, unknown>) => {
      calls.push(v);
      return Promise.resolve();
    }),
  }));
  return {
    db: { select, insert } as unknown as DbClient,
    calls,
  };
}

describe('bypassReasonSchema', () => {
  it('10+ karakter kabul', () => {
    const r = bypassReasonSchema.safeParse('Veresiye satış kapatma kullanıcı talebi');
    expect(r.success).toBe(true);
  });

  it('10 karakterden az → reject', () => {
    const r = bypassReasonSchema.safeParse('Kısa');
    expect(r.success).toBe(false);
  });

  it('500 karakterden fazla → reject', () => {
    const r = bypassReasonSchema.safeParse('a'.repeat(501));
    expect(r.success).toBe(false);
  });
});

describe('verifyBypassGuard', () => {
  it('happy path → ok=true', async () => {
    vi.mocked(verifyPassword).mockResolvedValue(true);
    const { db } = makeMockDb({
      user: { passwordHash: '$2a$12$validHash', role: 'SUPERADMIN' },
    });
    const r = await verifyBypassGuard(
      SUPERADMIN,
      { superadminPassword: 'pass', reason: 'Kullanıcı acil talep etti — eski satış geri alınmalı' },
      db,
    );
    expect(r.ok).toBe(true);
  });

  it('kısa reason → invalid_reason + issues', async () => {
    const { db } = makeMockDb({});
    const r = await verifyBypassGuard(
      SUPERADMIN,
      { superadminPassword: 'pass', reason: 'kısa' },
      db,
    );
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === 'invalid_reason') {
      expect(r.issues.length).toBeGreaterThan(0);
    } else {
      throw new Error('expected invalid_reason');
    }
  });

  it('user bulunamaz → user_not_found', async () => {
    const { db } = makeMockDb({ user: null });
    const r = await verifyBypassGuard(
      SUPERADMIN,
      { superadminPassword: 'pass', reason: 'Yeterli uzunlukta sebep yazıldı' },
      db,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('user_not_found');
  });

  it('yanlış şifre → invalid_password', async () => {
    vi.mocked(verifyPassword).mockResolvedValue(false);
    const { db } = makeMockDb({
      user: { passwordHash: '$2a$12$validHash', role: 'SUPERADMIN' },
    });
    const r = await verifyBypassGuard(
      SUPERADMIN,
      { superadminPassword: 'wrong', reason: 'Yeterli uzunlukta sebep yazıldı' },
      db,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('invalid_password');
  });

  it('passwordHash null → user_not_found', async () => {
    const { db } = makeMockDb({
      user: { passwordHash: null as unknown as string, role: 'SUPERADMIN' },
    });
    const r = await verifyBypassGuard(
      SUPERADMIN,
      { superadminPassword: 'p', reason: 'Yeterli uzunlukta sebep yazıldı' },
      db,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('user_not_found');
  });
});

describe('writeBypassAudit', () => {
  it('audit insert: performedAsSuperadmin=true + actionType=bypass + reason yazılır', async () => {
    const { db, calls } = makeMockDb({});
    await writeBypassAudit({
      companyId: COMPANY,
      superadminUserId: SUPERADMIN,
      action: 'superadmin.bypass.reverse_expired',
      entityType: 'stock_movement',
      entityId: 'mov-1',
      reason: 'Kullanıcı 25 saat sonra fark etti, müşteri hak talebi',
      beforeState: { afterQty: 5 },
      afterState: { afterQty: 10 },
      db,
      now: NOW,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      companyId: COMPANY,
      userId: SUPERADMIN,
      action: 'superadmin.bypass.reverse_expired',
      performedAsSuperadmin: true,
      superadminActionType: 'bypass',
      superadminReason: 'Kullanıcı 25 saat sonra fark etti, müşteri hak talebi',
    });
  });

  it('companyId null kabul (sistem-genel bypass)', async () => {
    const { db, calls } = makeMockDb({});
    await writeBypassAudit({
      companyId: null,
      superadminUserId: SUPERADMIN,
      action: 'superadmin.bypass.plan_limit_override',
      reason: 'Tenant talebi onaylandı acil ihtiyaç',
      db,
    });
    expect(calls[0]?.companyId).toBeNull();
  });
});

import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/lib/auth/auth', () => ({ auth: vi.fn() }));

import { isSuperadmin } from './access';
import type { Session } from 'next-auth';

describe('isSuperadmin', () => {
  it('SUPERADMIN role → true', () => {
    const session = {
      user: { id: 'u1', email: 'admin@x.com', role: 'SUPERADMIN' },
      expires: '2026-12-31',
    } as unknown as Session;
    expect(isSuperadmin(session)).toBe(true);
  });

  it('BAYI_SAHIBI role → false', () => {
    const session = {
      user: { id: 'u1', email: 'owner@x.com', role: 'BAYI_SAHIBI' },
      expires: '2026-12-31',
    } as unknown as Session;
    expect(isSuperadmin(session)).toBe(false);
  });

  it('STAFF role → false', () => {
    const session = {
      user: { id: 'u1', email: 'kasiyer@x.com', role: 'STAFF' },
      expires: '2026-12-31',
    } as unknown as Session;
    expect(isSuperadmin(session)).toBe(false);
  });

  it('session null → false', () => {
    expect(isSuperadmin(null)).toBe(false);
  });

  it('role yok → false', () => {
    const session = {
      user: { id: 'u1', email: 'x@x.com' },
      expires: '2026-12-31',
    } as unknown as Session;
    expect(isSuperadmin(session)).toBe(false);
  });
});

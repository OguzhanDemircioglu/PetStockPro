import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requestPasswordReset } from './forgot-password';
import type { DbClient } from '@/lib/db/client';

vi.mock('@/lib/brevo/client', () => ({
  sendBrevoEmail: vi.fn().mockResolvedValue({ ok: true, mock: true }),
}));

import { sendBrevoEmail } from '@/lib/brevo/client';

interface MockOpts {
  userExists?: boolean;
  brevoThrows?: boolean;
  updateThrows?: boolean;
}

function makeMockDb(opts: MockOpts = {}): DbClient {
  const userRow = opts.userExists
    ? [{ id: 'user_123', email: 'kayitli@petshop.com', name: 'Pet Shop Sahip' }]
    : [];

  const selectFn = vi.fn().mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(userRow),
      }),
    }),
  }));

  const updateWhere = vi.fn().mockImplementation(async () => {
    if (opts.updateThrows) throw new Error('DB constraint');
  });
  const updateFn = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({ where: updateWhere }),
  });

  return {
    select: selectFn,
    update: updateFn,
  } as unknown as DbClient;
}

describe('requestPasswordReset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (sendBrevoEmail as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, mock: true });
  });

  // AUTH-033
  it('Kayıtlı email → token üret + email gönder', async () => {
    const db = makeMockDb({ userExists: true });
    const result = await requestPasswordReset({ email: 'kayitli@petshop.com' }, db);

    expect(result.ok).toBe(true);
    expect(result.emailSent).toBe(true);
    expect(sendBrevoEmail).toHaveBeenCalledTimes(1);
    expect(sendBrevoEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: { email: 'kayitli@petshop.com' },
        tags: ['password-reset', 'request'],
      }),
    );
  });

  // AUTH-034 — enumeration koruma
  it('Kayıtsız email → ok=true ama email gönderilmez (enumeration koruma)', async () => {
    const db = makeMockDb({ userExists: false });
    const result = await requestPasswordReset({ email: 'kayitsiz@example.com' }, db);

    expect(result.ok).toBe(true);
    expect(result.emailSent).toBe(false);
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });

  it('Email case-insensitive lookup', async () => {
    const db = makeMockDb({ userExists: true });
    const result = await requestPasswordReset({ email: 'KAYITLI@petshop.com' }, db);

    // Zod toLowerCase() normalize ettikten sonra DB lookup edilir
    expect(result.ok).toBe(true);
    expect(result.emailSent).toBe(true);
  });

  it('Geçersiz email format → ok=true (enumeration sızdırmaz) ama validation issue dön', async () => {
    const db = makeMockDb({ userExists: false });
    const result = await requestPasswordReset({ email: 'not-an-email' }, db);

    expect(result.ok).toBe(true);
    expect(result.emailSent).toBe(false);
    expect(result.validationIssue).toBeDefined();
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });

  it('Brevo gönderim hatası → emailSent=false ama ok=true (kullanıcıya bilgi sızdırmaz)', async () => {
    (sendBrevoEmail as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Brevo 502'));
    const db = makeMockDb({ userExists: true });
    const result = await requestPasswordReset({ email: 'kayitli@petshop.com' }, db);

    expect(result.ok).toBe(true);
    expect(result.emailSent).toBe(false);
  });

  it('Reset URL email template\'inde NEXT_PUBLIC_APP_URL kullanır', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://petstockpro.com';
    const db = makeMockDb({ userExists: true });
    await requestPasswordReset({ email: 'kayitli@petshop.com' }, db);

    expect(sendBrevoEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        htmlContent: expect.stringContaining('https://petstockpro.com/reset-password/'),
      }),
    );
  });
});

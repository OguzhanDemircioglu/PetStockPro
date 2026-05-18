import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerNewTenant, _makeSlugForTesting } from './register';
import type { DbClient } from '@/lib/db/client';

// Mock Brevo — register entegrasyonunu izole et (real API call yok)
vi.mock('@/lib/brevo/client', () => ({
  sendBrevoEmail: vi.fn().mockResolvedValue({ ok: true, mock: true }),
}));

describe('makeSlug', () => {
  it('Türkçe karakterleri dönüştürür', () => {
    expect(_makeSlugForTesting('Mavi Pet Shop')).toBe('mavi-pet-shop');
    expect(_makeSlugForTesting('Üsküdar Petçi')).toBe('uskudar-petci');
    expect(_makeSlugForTesting('İstanbul Çiçek')).toBe('istanbul-cicek');
  });

  it('boş ve özel karakterleri temizler', () => {
    expect(_makeSlugForTesting('Pet Shop! (İstanbul)')).toBe('pet-shop-istanbul');
  });

  it('max 90 karakter sınırı', () => {
    const long = 'a'.repeat(200);
    expect(_makeSlugForTesting(long).length).toBeLessThanOrEqual(90);
  });

  it('başlangıç/bitiş tire trim', () => {
    expect(_makeSlugForTesting('---Test---')).toBe('test');
  });
});

/**
 * Mock DB helper — register iki select + bir transaction çağırır.
 *
 * Select sırası:
 *   1. users by email — kayıtlı mı?
 *   2. companies by slug — slug çakışıyor mu?
 *
 * Transaction iki insert (companies + users).
 */
interface MockOptions {
  existingUserEmail?: boolean;
  existingSlug?: boolean;
  insertCompanyId?: string;
  insertUserId?: string;
  transactionThrows?: boolean;
}

function makeMockDb(opts: MockOptions): DbClient {
  // İki ayrı select mock — sırayla çağrılır
  const userSelectLimit = vi.fn().mockResolvedValue(
    opts.existingUserEmail ? [{ id: 'existing-user' }] : [],
  );
  const slugSelectLimit = vi.fn().mockResolvedValue(
    opts.existingSlug ? [{ slug: 'mavi-pet-shop' }] : [],
  );

  const limits = [userSelectLimit, slugSelectLimit];
  let selectCallIndex = 0;

  const selectFn = vi.fn().mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: limits[selectCallIndex++] ?? vi.fn().mockResolvedValue([]),
      }),
    }),
  }));

  // Transaction insert mock — sıra: 1. companies.returning, 2. users.returning,
  // 3. categories ROOT.returning (slug+id map için, seed 2-fazlı), 4. categories
  // CHILD insert.values (returning yok, awaitable Promise gibi davranmalı).
  const txReturning = vi.fn()
    .mockResolvedValueOnce([{ id: opts.insertCompanyId ?? 'comp_1' }])
    .mockResolvedValueOnce([{ id: opts.insertUserId ?? 'user_1' }])
    .mockResolvedValueOnce([
      { id: 'root-kedi', slug: 'kedi' },
      { id: 'root-kopek', slug: 'kopek' },
      { id: 'root-kus', slug: 'kus' },
      { id: 'root-akvaryum', slug: 'akvaryum' },
      { id: 'root-kemirgen', slug: 'kemirgen' },
      { id: 'root-surungenler', slug: 'surungenler' },
    ]);

  // values() awaitable PromiseLike — children insert returning'siz await ediliyor.
  // returning() de aynı obje üzerinde mevcut → root insert chain'i `.returning`
  // çağırınca devam eder, child insert chain'i `await db.insert().values()` ile
  // resolved Promise gibi davranır.
  const txInsertChain: Record<string, unknown> = {};
  txInsertChain.insert = vi.fn().mockReturnValue(txInsertChain);
  txInsertChain.values = vi.fn().mockImplementation(() => ({
    returning: txReturning,
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(undefined).then(resolve),
  }));

  const transaction = vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
    if (opts.transactionThrows) {
      throw new Error('DB constraint violation');
    }
    return cb(txInsertChain);
  });

  return {
    select: selectFn,
    transaction,
  } as unknown as DbClient;
}

describe('registerNewTenant', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // HIBP fetch mock — breached değil (default)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('OTHER:1\n', { status: 200 }),
    );
  });

  describe('input validation', () => {
    it('boş shopName → ok=false + issue', async () => {
      const db = makeMockDb({});
      const result = await registerNewTenant(
        {
          shopName: '',
          email: 'a@b.com',
          password: 'StrongPass123',
          kvkkConsent: true,
          dataLocationConsent: true,
        },
        db,
      );
      expect(result.ok).toBe(false);
      expect(result.issues).toBeDefined();
    });

    it('geçersiz email → ok=false', async () => {
      const db = makeMockDb({});
      const result = await registerNewTenant(
        {
          shopName: 'Test Pet',
          email: 'not-email',
          password: 'StrongPass123',
          kvkkConsent: true,
          dataLocationConsent: true,
        },
        db,
      );
      expect(result.ok).toBe(false);
    });

    it('KVKK aydınlatma onayı false → reject', async () => {
      const db = makeMockDb({});
      const result = await registerNewTenant(
        {
          shopName: 'Test Pet',
          email: 'a@b.com',
          password: 'StrongPass123',
          kvkkConsent: false as unknown as true,
          dataLocationConsent: true,
        },
        db,
      );
      expect(result.ok).toBe(false);
    });

    it('AB veri lokasyon rızası false → reject', async () => {
      const db = makeMockDb({});
      const result = await registerNewTenant(
        {
          shopName: 'Test Pet',
          email: 'a@b.com',
          password: 'StrongPass123',
          kvkkConsent: true,
          dataLocationConsent: false as unknown as true,
        },
        db,
      );
      expect(result.ok).toBe(false);
    });
  });

  describe('password validation', () => {
    it('zayıf şifre → reject', async () => {
      const db = makeMockDb({});
      const result = await registerNewTenant(
        {
          shopName: 'Test Pet',
          email: 'a@b.com',
          password: 'weak',
          kvkkConsent: true,
          dataLocationConsent: true,
        },
        db,
      );
      expect(result.ok).toBe(false);
    });

    it('breached şifre (HIBP hit) → reject', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('9007338D6D81DD3B6271621B9CF9A97EA00:5000\n', { status: 200 }),
      );

      const db = makeMockDb({});
      const result = await registerNewTenant(
        {
          shopName: 'Test Pet',
          email: 'a@b.com',
          password: 'Password1',
          kvkkConsent: true,
          dataLocationConsent: true,
        },
        db,
      );
      expect(result.ok).toBe(false);
      expect(result.issues?.some((i) => i.includes('sızıntı'))).toBe(true);
    });
  });

  describe('email uniqueness', () => {
    it('email zaten kayıtlı → reject', async () => {
      const db = makeMockDb({ existingUserEmail: true });
      const result = await registerNewTenant(
        {
          shopName: 'Test Pet',
          email: 'taken@x.com',
          password: 'StrongPass123',
          kvkkConsent: true,
          dataLocationConsent: true,
        },
        db,
      );
      expect(result.ok).toBe(false);
      expect(result.issues?.some((i) => i.includes('kayıtlı'))).toBe(true);
    });
  });

  describe('happy path', () => {
    it('başarılı kayıt → ok=true + ids', async () => {
      const db = makeMockDb({
        insertCompanyId: 'company-uuid-new',
        insertUserId: 'user-uuid-new',
      });

      const result = await registerNewTenant(
        {
          shopName: 'Mavi Pet Shop',
          email: 'mavi@petshop.com',
          password: 'SecurePass2026',
          kvkkConsent: true,
          dataLocationConsent: true,
        },
        db,
      );

      expect(result.ok).toBe(true);
      expect(result.companyId).toBe('company-uuid-new');
      expect(result.userId).toBe('user-uuid-new');
    });

    it('slug çakışıyorsa suffix eklenir (silent retry)', async () => {
      const db = makeMockDb({ existingSlug: true });
      const result = await registerNewTenant(
        {
          shopName: 'Mavi Pet Shop',
          email: 'mavi2@petshop.com',
          password: 'SecurePass2026',
          kvkkConsent: true,
          dataLocationConsent: true,
        },
        db,
      );
      expect(result.ok).toBe(true); // başarılı (slug suffix eklenmiş olur)
    });
  });

  describe('DB error handling', () => {
    it('transaction throw → generic error mesajı', async () => {
      const db = makeMockDb({ transactionThrows: true });
      const result = await registerNewTenant(
        {
          shopName: 'Test Pet',
          email: 'new@x.com',
          password: 'StrongPass123',
          kvkkConsent: true,
          dataLocationConsent: true,
        },
        db,
      );
      expect(result.ok).toBe(false);
      expect(result.issues?.some((i) => i.includes('beklenmedik'))).toBe(true);
    });
  });
});

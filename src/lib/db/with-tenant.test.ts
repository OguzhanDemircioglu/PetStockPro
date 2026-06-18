/**
 * withTenant — redirect-safe transaction davranışı (Faz 4B).
 *
 * Kritik invariant: Next.js redirect()/notFound() throw'unda transaction COMMIT
 * edilmeli (rollback DEĞİL), yoksa server action sonundaki redirect yapılan
 * INSERT/UPDATE'i geri alır → sessiz veri kaybı. Gerçek hatalar ROLLBACK eder.
 *
 * postgres-js `.transaction(cb)`: cb dönerse COMMIT, cb throw ederse ROLLBACK.
 * Mock bunu taklit eder ve hangi yolun seçildiğini kaydeder.
 */
import { describe, it, expect, vi } from 'vitest';
import type { DbClient } from './client';
import { withTenant } from './with-tenant';

const COMPANY = '00000000-0000-0000-0000-0000000000c1';

function makeClient() {
  const events: string[] = [];
  const execute = vi.fn().mockResolvedValue(undefined);
  const client = {
    transaction: async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> => {
      const tx = { execute };
      try {
        const r = await cb(tx);
        events.push('COMMIT');
        return r;
      } catch (e) {
        events.push('ROLLBACK');
        throw e;
      }
    },
  } as unknown as DbClient;
  return { client, events, execute };
}

describe('withTenant', () => {
  it('normal dönüş → COMMIT + GUC set edilir', async () => {
    const { client, events, execute } = makeClient();
    const out = await withTenant(COMPANY, async () => 'ok', client);
    expect(out).toBe('ok');
    expect(events).toEqual(['COMMIT']);
    // set_config çağrıldı (GUC)
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('redirect() throw → COMMIT (rollback DEĞİL) + hata yeniden fırlatılır', async () => {
    const { client, events } = makeClient();
    const redirectErr = Object.assign(new Error('NEXT_REDIRECT'), {
      digest: 'NEXT_REDIRECT;push;/admin/suppliers?created=success;307',
    });
    await expect(
      withTenant(COMPANY, async () => {
        throw redirectErr;
      }, client),
    ).rejects.toBe(redirectErr);
    // En kritik: COMMIT edildi (veri kaybı yok)
    expect(events).toEqual(['COMMIT']);
  });

  it('notFound() throw → COMMIT + yeniden fırlat', async () => {
    const { client, events } = makeClient();
    const nf = Object.assign(new Error('NEXT_NOT_FOUND'), { digest: 'NEXT_NOT_FOUND' });
    await expect(
      withTenant(COMPANY, async () => {
        throw nf;
      }, client),
    ).rejects.toBe(nf);
    expect(events).toEqual(['COMMIT']);
  });

  it('gerçek hata → ROLLBACK + yeniden fırlat', async () => {
    const { client, events } = makeClient();
    const boom = new Error('DB patladı');
    await expect(
      withTenant(COMPANY, async () => {
        throw boom;
      }, client),
    ).rejects.toBe(boom);
    expect(events).toEqual(['ROLLBACK']);
  });

  it('digest benzeri ama sahte string → gerçek hata sayılır (ROLLBACK)', async () => {
    const { client, events } = makeClient();
    const fake = Object.assign(new Error('x'), { digest: 'SOMETHING_ELSE' });
    await expect(
      withTenant(COMPANY, async () => {
        throw fake;
      }, client),
    ).rejects.toBe(fake);
    expect(events).toEqual(['ROLLBACK']);
  });
});

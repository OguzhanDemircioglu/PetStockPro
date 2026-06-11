import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/paytr/client', () => ({
  createPaytrIframeToken: vi.fn(async () => 'iframe-token-xyz'),
  paytrIframeUrl: (t: string) => `https://www.paytr.com/odeme/guvenli/${t}`,
}));

import { startPaytrCheckout, makeMerchantOid, deriveUtoken } from './paytr-checkout';
import { createPaytrIframeToken } from '@/lib/paytr/client';

interface DbConfig {
  activeExists?: boolean;
}

function makeDb(config: DbConfig) {
  const calls = { inserts: [] as Record<string, unknown>[], deletes: 0 };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = {
    select() {
      return {
        from() {
          return {
            where() {
              return { limit: () => Promise.resolve(config.activeExists ? [{ id: 'sub-x' }] : []) };
            },
          };
        },
      };
    },
    delete() {
      return {
        where() {
          calls.deletes++;
          return Promise.resolve();
        },
      };
    },
    insert() {
      return {
        values(vals: Record<string, unknown>) {
          calls.inserts.push(vals);
          return Promise.resolve();
        },
      };
    },
  };
  return { db, calls };
}

const base = {
  companyId: 'abc-123-def',
  companyName: 'Pet A',
  ownerEmail: 'owner@pet.com',
  userIp: '1.2.3.4',
  okUrl: 'https://x/ok',
  failUrl: 'https://x/fail',
};

describe('makeMerchantOid / deriveUtoken', () => {
  it('makeMerchantOid: PSP + alfanümerik + benzersiz', () => {
    const a = makeMerchantOid();
    const b = makeMerchantOid();
    expect(a).toMatch(/^PSP[a-z0-9]+$/i);
    expect(a).not.toBe(b);
  });

  it('deriveUtoken: u + tiresiz companyId (saklı kart grubu)', () => {
    expect(deriveUtoken('abc-123-def')).toBe('uabc123def');
  });
});

describe('startPaytrCheckout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createPaytrIframeToken).mockResolvedValue('iframe-token-xyz');
  });

  // ⚠️ Tutarlar GEÇİCİ TEST FİYATINI yansıtır (PRO 10₺ = 1000 kuruş) — gerçek 1000₺, lansman öncesi geri al.
  it('PRO happy → incomplete insert + token + 1000 kuruş + store_card', async () => {
    const { db, calls } = makeDb({});
    const res = await startPaytrCheckout({ db, targetPlan: 'PRO', ...base });

    expect(calls.deletes).toBe(1); // eski incomplete temizlendi
    expect(calls.inserts).toHaveLength(1);
    const ins = calls.inserts[0];
    expect(ins.status).toBe('incomplete');
    expect(ins.plan).toBe('PRO');
    expect(ins.amountTry).toBe('10.00');
    expect(ins.pendingMerchantOid).toBe(res.merchantOid);
    expect(ins.paytrUtoken).toBe('uabc123def');

    const tokenArgs = vi.mocked(createPaytrIframeToken).mock.calls[0][0];
    expect(tokenArgs.paymentAmount).toBe(1000);
    expect(tokenArgs.storeCard).toBe(1);
    expect(tokenArgs.utoken).toBe('uabc123def');
    expect(tokenArgs.merchantOid).toBe(res.merchantOid);

    expect(res.token).toBe('iframe-token-xyz');
    expect(res.iframeUrl).toContain('/odeme/guvenli/iframe-token-xyz');
  });

  it('PRO_PLUS → 2000 kuruş (test fiyatı)', async () => {
    const { db } = makeDb({});
    await startPaytrCheckout({ db, targetPlan: 'PRO_PLUS', ...base });
    expect(vi.mocked(createPaytrIframeToken).mock.calls[0][0].paymentAmount).toBe(2000);
  });

  it('zaten aktif abonelik → CheckoutError already_subscribed, insert YOK', async () => {
    const { db, calls } = makeDb({ activeExists: true });
    await expect(startPaytrCheckout({ db, targetPlan: 'PRO', ...base })).rejects.toMatchObject({
      code: 'already_subscribed',
    });
    expect(calls.inserts).toHaveLength(0);
  });
});

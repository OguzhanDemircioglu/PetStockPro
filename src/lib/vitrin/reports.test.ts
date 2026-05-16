import { describe, it, expect, vi } from 'vitest';
import {
  reportInputSchema,
  resolveReport,
  resolveReportSchema,
  submitReport,
} from './reports';
import type { DbClient } from '@/lib/db/client';

const COMPANY = '00000000-0000-0000-0000-000000000001';
const PRODUCT = '00000000-0000-0000-0000-000000000002';
const REPORT = '00000000-0000-0000-0000-000000000003';
const SUPERADMIN = '00000000-0000-0000-0000-000000000004';
const NOW = new Date('2026-05-17T12:00:00Z');

const CTX = {
  ipAddress: '203.0.113.42',
  userAgent: 'Mozilla/5.0',
  countryCode: 'TR',
};

function makeMockDb(opts: {
  existing?: { status: string; companyId?: string } | null;
  insertedId?: string;
  shouldThrowOnInsert?: boolean;
  rateLimitCount?: number;
}) {
  const calls = {
    inserted: 0,
    insertedValues: null as Record<string, unknown> | null,
    updated: 0,
    updateSet: null as Record<string, unknown> | null,
    selected: 0,
    countQueries: 0,
  };
  // submitReport: önce COUNT (rate-limit), sonra (existing yoksa) INSERT.
  // resolveReport: SELECT (.limit(1)), sonra UPDATE.
  // Bu mock her iki path'e cevap verir.
  const select = vi.fn().mockImplementation(() => ({
    from: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => {
        // submitReport rate-limit path: COUNT(*) → array { count }
        // resolveReport path: .limit(1) → existing row
        return {
          // .limit(1) ile resolveReport için
          limit: vi.fn().mockImplementation(() => {
            calls.selected++;
            return Promise.resolve(opts.existing ? [opts.existing] : []);
          }),
          // submitReport thenable (COUNT)
          then: (cb: (rows: unknown[]) => unknown) => {
            calls.countQueries++;
            return Promise.resolve([
              { count: opts.rateLimitCount ?? 0 },
            ]).then(cb);
          },
        };
      }),
    })),
  }));
  const insert = vi.fn().mockImplementation(() => ({
    values: vi.fn().mockImplementation((v) => {
      calls.inserted++;
      calls.insertedValues = v;
      return {
        returning: vi
          .fn()
          .mockImplementation(() =>
            opts.shouldThrowOnInsert
              ? Promise.reject(new Error('fail'))
              : Promise.resolve([{ id: opts.insertedId ?? 'new-report-id' }]),
          ),
      };
    }),
  }));
  const update = vi.fn().mockImplementation(() => ({
    set: vi.fn().mockImplementation((v) => {
      calls.updated++;
      calls.updateSet = v;
      return { where: vi.fn().mockResolvedValue(undefined) };
    }),
  }));
  return {
    db: { select, insert, update } as unknown as DbClient,
    calls,
  };
}

describe('reportInputSchema', () => {
  it('valid storefront report', () => {
    const r = reportInputSchema.safeParse({
      companyId: COMPANY,
      targetType: 'storefront',
      reason: 'spam',
    });
    expect(r.success).toBe(true);
  });

  it('valid product report (productId zorunlu)', () => {
    const r = reportInputSchema.safeParse({
      companyId: COMPANY,
      targetType: 'product',
      productId: PRODUCT,
      reason: 'wrong_photo',
    });
    expect(r.success).toBe(true);
  });

  it('product target — productId yoksa → reject', () => {
    const r = reportInputSchema.safeParse({
      companyId: COMPANY,
      targetType: 'product',
      reason: 'wrong_info',
    });
    expect(r.success).toBe(false);
  });

  it('storefront target — productId varsa → reject', () => {
    const r = reportInputSchema.safeParse({
      companyId: COMPANY,
      targetType: 'storefront',
      productId: PRODUCT,
      reason: 'spam',
    });
    expect(r.success).toBe(false);
  });

  it('bilinmeyen reason → reject', () => {
    const r = reportInputSchema.safeParse({
      companyId: COMPANY,
      targetType: 'storefront',
      reason: 'unknown_reason',
    });
    expect(r.success).toBe(false);
  });

  it('note 1001 karakter → reject', () => {
    const r = reportInputSchema.safeParse({
      companyId: COMPANY,
      targetType: 'storefront',
      reason: 'other',
      note: 'x'.repeat(1001),
    });
    expect(r.success).toBe(false);
  });
});

describe('submitReport', () => {
  it('happy — storefront report insert + remainingInWindow=4 (ilk şikayet)', async () => {
    const { db, calls } = makeMockDb({ insertedId: 'r-1' });
    const result = await submitReport(
      { companyId: COMPANY, targetType: 'storefront', reason: 'spam' },
      CTX,
      db,
      NOW,
    );
    expect(result).toEqual({ ok: true, id: 'r-1', remainingInWindow: 4 });
    expect(calls.inserted).toBe(1);
    expect(calls.insertedValues?.reason).toBe('spam');
    expect(calls.insertedValues?.targetType).toBe('storefront');
    expect(calls.insertedValues?.productId).toBeNull();
    expect(calls.insertedValues?.status).toBe('pending');
    expect(calls.insertedValues?.reporterIpHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('product report — productId set', async () => {
    const { db, calls } = makeMockDb({});
    await submitReport(
      {
        companyId: COMPANY,
        targetType: 'product',
        productId: PRODUCT,
        reason: 'wrong_photo',
        note: 'Yanlış variant fotoğrafı kullanılmış',
      },
      CTX,
      db,
      NOW,
    );
    expect(calls.insertedValues?.productId).toBe(PRODUCT);
    expect(calls.insertedValues?.note).toBe(
      'Yanlış variant fotoğrafı kullanılmış',
    );
  });

  it('invalid_input — Zod reject', async () => {
    const { db, calls } = makeMockDb({});
    const result = await submitReport(
      { companyId: 'not-uuid', targetType: 'storefront', reason: 'spam' },
      CTX,
      db,
      NOW,
    );
    expect(result).toEqual({ ok: false, reason: 'invalid_input' });
    expect(calls.inserted).toBe(0);
  });

  it('insert throw → unknown reason', async () => {
    const { db } = makeMockDb({ shouldThrowOnInsert: true });
    const result = await submitReport(
      { companyId: COMPANY, targetType: 'storefront', reason: 'spam' },
      CTX,
      db,
      NOW,
    );
    expect(result).toEqual({ ok: false, reason: 'unknown' });
  });

  it('IP yoksa hash="unknown" + rate-limit atlanır + remainingInWindow=4 (currentCount=0 sayılır)', async () => {
    const { db, calls } = makeMockDb({ rateLimitCount: 99 });
    const result = await submitReport(
      { companyId: COMPANY, targetType: 'storefront', reason: 'other' },
      {},
      db,
      NOW,
    );
    expect(result).toEqual({ ok: true, id: 'new-report-id', remainingInWindow: 4 });
    expect(calls.insertedValues?.reporterIpHash).toBe('unknown');
    // IP yoksa rate-limit COUNT atlanır; alert dedup COUNT fire-and-forget +1
    expect(calls.countQueries).toBe(1);
  });

  it('rate_limit_exceeded — 5+ şikayet 24h içinde + meta forward (currentCount/max/windowHours)', async () => {
    const { db, calls } = makeMockDb({ rateLimitCount: 5 });
    const result = await submitReport(
      { companyId: COMPANY, targetType: 'storefront', reason: 'spam' },
      CTX,
      db,
      NOW,
    );
    expect(result).toEqual({
      ok: false,
      reason: 'rate_limit_exceeded',
      currentCount: 5,
      max: 5,
      windowHours: 24,
    });
    expect(calls.countQueries).toBe(1);
    expect(calls.inserted).toBe(0); // limit aşıldıysa INSERT yok
  });

  it('rate-limit altında (4 kayıt) → insert geçer + remainingInWindow=0 (sonuncu kontenjan tükendi)', async () => {
    const { db, calls } = makeMockDb({ rateLimitCount: 4 });
    const result = await submitReport(
      { companyId: COMPANY, targetType: 'storefront', reason: 'spam' },
      CTX,
      db,
      NOW,
    );
    expect(result).toEqual({ ok: true, id: 'new-report-id', remainingInWindow: 0 });
    // rate-limit COUNT 1× + alert dedup COUNT 1× = 2 toplam
    expect(calls.countQueries).toBe(2);
    expect(calls.inserted).toBe(1);
  });

  it('rate-limit altında (2 kayıt) → insert geçer + remainingInWindow=2', async () => {
    const { db } = makeMockDb({ rateLimitCount: 2 });
    const result = await submitReport(
      { companyId: COMPANY, targetType: 'storefront', reason: 'spam' },
      CTX,
      db,
      NOW,
    );
    expect(result).toEqual({ ok: true, id: 'new-report-id', remainingInWindow: 2 });
  });
});

describe('resolveReportSchema', () => {
  it('valid resolved', () => {
    const r = resolveReportSchema.safeParse({
      reportId: REPORT,
      superadminUserId: SUPERADMIN,
      resolution: 'resolved',
    });
    expect(r.success).toBe(true);
  });

  it('valid dismissed + not', () => {
    const r = resolveReportSchema.safeParse({
      reportId: REPORT,
      superadminUserId: SUPERADMIN,
      resolution: 'dismissed',
      resolutionNote: 'Şikayet temelsiz',
    });
    expect(r.success).toBe(true);
  });

  it('resolution enum dışı → reject', () => {
    const r = resolveReportSchema.safeParse({
      reportId: REPORT,
      superadminUserId: SUPERADMIN,
      resolution: 'pending',
    });
    expect(r.success).toBe(false);
  });

  it('note 500+ → reject', () => {
    const r = resolveReportSchema.safeParse({
      reportId: REPORT,
      superadminUserId: SUPERADMIN,
      resolution: 'resolved',
      resolutionNote: 'x'.repeat(501),
    });
    expect(r.success).toBe(false);
  });
});

describe('resolveReport', () => {
  it('happy — pending → resolved update', async () => {
    const { db, calls } = makeMockDb({
      existing: { status: 'pending', companyId: COMPANY },
    });
    const result = await resolveReport(
      {
        reportId: REPORT,
        superadminUserId: SUPERADMIN,
        resolution: 'resolved',
        resolutionNote: 'Tenant uyarıldı',
      },
      db,
      NOW,
    );
    expect(result).toEqual({
      ok: true,
      reportId: REPORT,
      companyId: COMPANY,
    });
    expect(calls.updated).toBe(1);
    expect(calls.updateSet?.status).toBe('resolved');
    expect(calls.updateSet?.resolvedById).toBe(SUPERADMIN);
    expect(calls.updateSet?.resolvedAt).toEqual(NOW);
    expect(calls.updateSet?.resolutionNote).toBe('Tenant uyarıldı');
  });

  it('dismissed — note opsiyonel null', async () => {
    const { db, calls } = makeMockDb({
      existing: { status: 'pending', companyId: COMPANY },
    });
    await resolveReport(
      {
        reportId: REPORT,
        superadminUserId: SUPERADMIN,
        resolution: 'dismissed',
      },
      db,
      NOW,
    );
    expect(calls.updateSet?.status).toBe('dismissed');
    expect(calls.updateSet?.resolutionNote).toBeNull();
  });

  it('not_found — yoksa', async () => {
    const { db, calls } = makeMockDb({ existing: null });
    const result = await resolveReport(
      {
        reportId: REPORT,
        superadminUserId: SUPERADMIN,
        resolution: 'resolved',
      },
      db,
      NOW,
    );
    expect(result).toEqual({ ok: false, reason: 'not_found' });
    expect(calls.updated).toBe(0);
  });

  it('already_resolved — zaten resolved/dismissed ise reject', async () => {
    const { db, calls } = makeMockDb({
      existing: { status: 'resolved', companyId: COMPANY },
    });
    const result = await resolveReport(
      {
        reportId: REPORT,
        superadminUserId: SUPERADMIN,
        resolution: 'resolved',
      },
      db,
      NOW,
    );
    expect(result).toEqual({ ok: false, reason: 'already_resolved' });
    expect(calls.updated).toBe(0);
  });

  it('invalid_input — Zod fail, select bile yok', async () => {
    const { db, calls } = makeMockDb({
      existing: { status: 'pending', companyId: COMPANY },
    });
    const result = await resolveReport(
      {
        reportId: 'not-uuid',
        superadminUserId: SUPERADMIN,
        resolution: 'resolved',
      },
      db,
      NOW,
    );
    expect(result).toEqual({ ok: false, reason: 'invalid_input' });
    expect(calls.selected).toBe(0);
    expect(calls.updated).toBe(0);
  });
});

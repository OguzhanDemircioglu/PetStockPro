import { describe, it, expect, vi } from 'vitest';
import { trackVitrinEvent, trackVitrinEventAsync } from './track';
import type { DbClient } from '@/lib/db/client';

const COMPANY = '00000000-0000-0000-0000-000000000001';
const NOW = new Date('2026-05-17T10:00:00Z');

describe('trackVitrinEvent', () => {
  it('happy — insert çağrılır, hash IP set', async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values });
    const db = { insert } as unknown as DbClient;

    const result = await trackVitrinEvent(
      {
        companyId: COMPANY,
        eventType: 'profile_view',
        ipAddress: '203.0.113.42',
        userAgent: 'Mozilla/5.0',
      },
      db,
      NOW,
    );

    expect(result).toEqual({ ok: true });
    expect(values).toHaveBeenCalledTimes(1);
    const args = values.mock.calls[0][0];
    expect(args.companyId).toBe(COMPANY);
    expect(args.eventType).toBe('profile_view');
    expect(args.visitorIpHash).toMatch(/^[a-f0-9]{64}$/);
    expect(args.userAgent).toBe('Mozilla/5.0');
  });

  it('IP yoksa hash null', async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values });
    const db = { insert } as unknown as DbClient;

    await trackVitrinEvent(
      { companyId: COMPANY, eventType: 'home_view' },
      db,
      NOW,
    );
    const args = values.mock.calls[0][0];
    expect(args.visitorIpHash).toBeNull();
  });

  it('aynı IP + aynı gün → aynı hash', async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values });
    const db = { insert } as unknown as DbClient;

    await trackVitrinEvent(
      { companyId: COMPANY, eventType: 'profile_view', ipAddress: '1.2.3.4' },
      db,
      NOW,
    );
    await trackVitrinEvent(
      { companyId: COMPANY, eventType: 'product_view', ipAddress: '1.2.3.4' },
      db,
      NOW,
    );
    const hash1 = values.mock.calls[0][0].visitorIpHash;
    const hash2 = values.mock.calls[1][0].visitorIpHash;
    expect(hash1).toBe(hash2);
  });

  it('aynı IP + farklı gün → farklı hash (daily salt rotation)', async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values });
    const db = { insert } as unknown as DbClient;

    await trackVitrinEvent(
      { companyId: COMPANY, eventType: 'profile_view', ipAddress: '1.2.3.4' },
      db,
      new Date('2026-05-17T10:00:00Z'),
    );
    await trackVitrinEvent(
      { companyId: COMPANY, eventType: 'profile_view', ipAddress: '1.2.3.4' },
      db,
      new Date('2026-05-18T10:00:00Z'),
    );
    const hash1 = values.mock.calls[0][0].visitorIpHash;
    const hash2 = values.mock.calls[1][0].visitorIpHash;
    expect(hash1).not.toBe(hash2);
  });

  it('DB hata → ok=false (caller atmaz)', async () => {
    const values = vi.fn().mockRejectedValue(new Error('DB FK violation'));
    const insert = vi.fn().mockReturnValue({ values });
    const db = { insert } as unknown as DbClient;

    const result = await trackVitrinEvent(
      { companyId: COMPANY, eventType: 'home_view' },
      db,
      NOW,
    );
    expect(result).toEqual({ ok: false });
  });

  it('opsiyonel alanlar default NULL', async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values });
    const db = { insert } as unknown as DbClient;

    await trackVitrinEvent(
      { companyId: COMPANY, eventType: 'home_view' },
      db,
      NOW,
    );
    const args = values.mock.calls[0][0];
    expect(args.productId).toBeNull();
    expect(args.variantId).toBeNull();
    expect(args.branchId).toBeNull();
    expect(args.searchQuery).toBeNull();
    expect(args.userAgent).toBeNull();
  });
});

describe('trackVitrinEventAsync', () => {
  it('fire-and-forget — caller bekletilmez', () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values });
    const db = { insert } as unknown as DbClient;
    const result = trackVitrinEventAsync(
      { companyId: COMPANY, eventType: 'whatsapp_click' },
      db,
    );
    expect(result).toBeUndefined();
    expect(insert).toHaveBeenCalled();
  });

  it('hata sessiz yutar (throw atmaz)', () => {
    const values = vi.fn().mockRejectedValue(new Error('DB down'));
    const insert = vi.fn().mockReturnValue({ values });
    const db = { insert } as unknown as DbClient;
    expect(() =>
      trackVitrinEventAsync(
        { companyId: COMPANY, eventType: 'home_view' },
        db,
      ),
    ).not.toThrow();
  });
});

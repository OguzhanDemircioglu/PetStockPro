import { describe, it, expect, vi } from 'vitest';
import {
  PROMO_SLOT_LIMIT,
  PROMO_DURATION_MONTHS,
  PROMO_REMINDER_7_DAYS,
  PROMO_REMINDER_1_DAY,
  getPromoStatus,
  claimPromoSlot,
  getPromoSystemStats,
  revertExpiredPromos,
  getExpiringPromos,
  markReminderSent,
  hadPromoBefore,
  getProductLimitContext,
} from './first-100';

// Drizzle db mock — minimum yüzey: select + update + execute
function makeMockDb(opts: {
  selectRows?: unknown[];
  executeRows?: unknown[];
} = {}) {
  const selectRows = opts.selectRows ?? [];
  const executeRows = opts.executeRows ?? [];

  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(selectRows),
  };

  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };

  return {
    select: vi.fn().mockReturnValue(selectChain),
    update: vi.fn().mockReturnValue(updateChain),
    execute: vi.fn().mockResolvedValue(executeRows),
  } as unknown as Parameters<typeof getPromoStatus>[0];
}

describe('constants', () => {
  it('PROMO_SLOT_LIMIT = 100', () => {
    expect(PROMO_SLOT_LIMIT).toBe(100);
  });

  it('PROMO_DURATION_MONTHS = 3', () => {
    expect(PROMO_DURATION_MONTHS).toBe(3);
  });

  it('reminders: 7 ve 1 gün', () => {
    expect(PROMO_REMINDER_7_DAYS).toBe(7);
    expect(PROMO_REMINDER_1_DAY).toBe(1);
  });
});

describe('getPromoStatus', () => {
  it('eligible=false → tüm field varsayılan', async () => {
    const db = makeMockDb({ selectRows: [{ eligible: false, until: null, slotNumber: null, expiredHandledAt: null }] });
    const s = await getPromoStatus(db, 'co-1');
    expect(s).toEqual({
      eligible: false,
      active: false,
      until: null,
      slotNumber: null,
      daysRemaining: null,
      expiredPendingRevert: false,
    });
  });

  it('eligible + until=future → active=true + daysRemaining hesaplı', async () => {
    const futureDate = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000); // 45 gün sonra
    const db = makeMockDb({
      selectRows: [{ eligible: true, until: futureDate, slotNumber: 7, expiredHandledAt: null }],
    });
    const s = await getPromoStatus(db, 'co-1');
    expect(s.active).toBe(true);
    expect(s.slotNumber).toBe(7);
    expect(s.daysRemaining).toBeGreaterThan(40);
    expect(s.daysRemaining).toBeLessThanOrEqual(45);
    expect(s.expiredPendingRevert).toBe(false);
  });

  it('eligible + until=past + expiredHandled=null → expiredPendingRevert=true', async () => {
    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const db = makeMockDb({
      selectRows: [{ eligible: true, until: pastDate, slotNumber: 1, expiredHandledAt: null }],
    });
    const s = await getPromoStatus(db, 'co-1');
    expect(s.active).toBe(false);
    expect(s.expiredPendingRevert).toBe(true);
  });

  it('eligible + until=past + expiredHandled set → expiredPendingRevert=false', async () => {
    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const db = makeMockDb({
      selectRows: [{ eligible: true, until: pastDate, slotNumber: 1, expiredHandledAt: new Date() }],
    });
    const s = await getPromoStatus(db, 'co-1');
    expect(s.expiredPendingRevert).toBe(false);
  });
});

describe('claimPromoSlot', () => {
  it('UPDATE 1 satır etkilerse claimed=true + slotNumber döner', async () => {
    const db = makeMockDb({ executeRows: [{ slot: 5 }] });
    const r = await claimPromoSlot(db, 'co-1');
    expect(r.claimed).toBe(true);
    expect(r.slotNumber).toBe(5);
  });

  it('UPDATE 0 satır (zaten claim edildi veya cap doldu) → claimed=false', async () => {
    const db = makeMockDb({ executeRows: [] });
    const r = await claimPromoSlot(db, 'co-1');
    expect(r.claimed).toBe(false);
    expect(r.slotNumber).toBeNull();
  });
});

describe('getPromoSystemStats', () => {
  it('aggregate sayım: kullanılan + kalan + aktif + bitmiş', async () => {
    const db = makeMockDb({
      executeRows: [
        { total: 7, active: 4, expired_handled: 2, expired_pending: 1 },
      ],
    });
    const s = await getPromoSystemStats(db);
    expect(s.totalSlotsUsed).toBe(7);
    expect(s.slotsRemaining).toBe(93); // 100 - 7
    expect(s.activePromos).toBe(4);
    expect(s.expiredHandled).toBe(2);
    expect(s.expiredPending).toBe(1);
  });

  it('boş tabloda → tüm sıfır', async () => {
    const db = makeMockDb({ executeRows: [] });
    const s = await getPromoSystemStats(db);
    expect(s.totalSlotsUsed).toBe(0);
    expect(s.slotsRemaining).toBe(100);
  });
});

describe('revertExpiredPromos', () => {
  it('returning id listesini döner', async () => {
    const db = makeMockDb({ executeRows: [{ id: 'a' }, { id: 'b' }] });
    const r = await revertExpiredPromos(db);
    expect(r.revertedIds).toEqual(['a', 'b']);
  });

  it('boş sonuç → revertedIds=[]', async () => {
    const db = makeMockDb({ executeRows: [] });
    const r = await revertExpiredPromos(db);
    expect(r.revertedIds).toEqual([]);
  });
});

describe('getExpiringPromos', () => {
  it('T-7 query çağrılır, owner_email + days_remaining map edilir', async () => {
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const db = makeMockDb({
      executeRows: [
        {
          company_id: 'co-1',
          company_name: 'Test PetShop',
          until: future,
          owner_email: 'sahip@example.com',
          owner_name: 'Sahip',
          days_remaining: 5,
        },
      ],
    });
    const list = await getExpiringPromos(db, 7);
    expect(list).toHaveLength(1);
    expect(list[0].ownerEmail).toBe('sahip@example.com');
    expect(list[0].daysRemaining).toBe(5);
  });
});

describe('markReminderSent', () => {
  it('7 → promoReminder7Sent', async () => {
    const db = makeMockDb();
    await markReminderSent(db, 'co-1', 7);
    expect((db as unknown as { update: ReturnType<typeof vi.fn> }).update).toHaveBeenCalled();
  });

  it('1 → promoReminder1Sent', async () => {
    const db = makeMockDb();
    await markReminderSent(db, 'co-1', 1);
    expect((db as unknown as { update: ReturnType<typeof vi.fn> }).update).toHaveBeenCalled();
  });
});

describe('hadPromoBefore', () => {
  it('eligible=true → true', async () => {
    const db = makeMockDb({ selectRows: [{ eligible: true }] });
    expect(await hadPromoBefore(db, 'co-1')).toBe(true);
  });

  it('eligible=false → false', async () => {
    const db = makeMockDb({ selectRows: [{ eligible: false }] });
    expect(await hadPromoBefore(db, 'co-1')).toBe(false);
  });

  it('row yok → false', async () => {
    const db = makeMockDb({ selectRows: [] });
    expect(await hadPromoBefore(db, 'co-1')).toBe(false);
  });
});

describe('getProductLimitContext', () => {
  it('FREE plan + 30 ürün → exceeded=false, limit=50', async () => {
    const db = makeMockDb({
      executeRows: [{ plan: 'FREE', promo_eligible: false, promo_until: null, product_count: 30 }],
    });
    const ctx = await getProductLimitContext(db, 'co-1');
    expect(ctx.plan).toBe('FREE');
    expect(ctx.currentCount).toBe(30);
    expect(ctx.limit).toBe(50);
    expect(ctx.exceeded).toBe(false);
    expect(ctx.hadPromo).toBe(false);
  });

  it('FREE plan + 50 ürün → exceeded=true (cap hit)', async () => {
    const db = makeMockDb({
      executeRows: [{ plan: 'FREE', promo_eligible: false, promo_until: null, product_count: 50 }],
    });
    const ctx = await getProductLimitContext(db, 'co-1');
    expect(ctx.exceeded).toBe(true);
  });

  it('PRO plan + 200 ürün → exceeded=false, limit=500', async () => {
    const db = makeMockDb({
      executeRows: [{ plan: 'PRO', promo_eligible: false, promo_until: null, product_count: 200 }],
    });
    const ctx = await getProductLimitContext(db, 'co-1');
    expect(ctx.limit).toBe(500);
    expect(ctx.exceeded).toBe(false);
  });

  it('PRO_PLUS plan + 9999 ürün → exceeded=false (Infinity)', async () => {
    const db = makeMockDb({
      executeRows: [{ plan: 'PRO_PLUS', promo_eligible: false, promo_until: null, product_count: 9999 }],
    });
    const ctx = await getProductLimitContext(db, 'co-1');
    expect(ctx.limit).toBe(Number.POSITIVE_INFINITY);
    expect(ctx.exceeded).toBe(false);
  });

  it('Promo aktif (PRO + until=future) → promoActive=true', async () => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const db = makeMockDb({
      executeRows: [{ plan: 'PRO', promo_eligible: true, promo_until: future, product_count: 80 }],
    });
    const ctx = await getProductLimitContext(db, 'co-1');
    expect(ctx.promoActive).toBe(true);
    expect(ctx.hadPromo).toBe(true);
  });

  it('Promo bitmiş (FREE plan revert + had promo) → hadPromo=true, promoActive=false', async () => {
    const past = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    const db = makeMockDb({
      executeRows: [{ plan: 'FREE', promo_eligible: true, promo_until: past, product_count: 80 }],
    });
    const ctx = await getProductLimitContext(db, 'co-1');
    expect(ctx.hadPromo).toBe(true);
    expect(ctx.promoActive).toBe(false);
    expect(ctx.exceeded).toBe(true); // 80 > FREE 50
  });

  it('tenant bulunamadı → defaults', async () => {
    const db = makeMockDb({ executeRows: [] });
    const ctx = await getProductLimitContext(db, 'unknown');
    expect(ctx.plan).toBe('FREE');
    expect(ctx.exceeded).toBe(false);
  });
});

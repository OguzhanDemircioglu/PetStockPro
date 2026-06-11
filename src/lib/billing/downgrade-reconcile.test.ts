import { describe, it, expect } from 'vitest';
import { unpublishVitrinOverLimit } from './downgrade-reconcile';
import type { DbClient } from '@/lib/db/client';

function makeDb(publishedIds: string[]) {
  const calls = { updateCount: 0, updatedSet: null as Record<string, unknown> | null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve(publishedIds.map((id) => ({ id }))),
        }),
      }),
    }),
    update: () => ({
      set: (vals: Record<string, unknown>) => ({
        where: () => {
          calls.updateCount++;
          calls.updatedSet = vals;
          return Promise.resolve();
        },
      }),
    }),
  };
  return { db: db as DbClient, calls };
}

const now = new Date('2026-06-11T12:00:00.000Z');

describe('unpublishVitrinOverLimit', () => {
  it('limit ∞ (PRO_PLUS upgrade) → 0, sorgu/update YOK', async () => {
    const { db, calls } = makeDb(['a', 'b', 'c']);
    const n = await unpublishVitrinOverLimit(db, 'c1', Infinity, now);
    expect(n).toBe(0);
    expect(calls.updateCount).toBe(0);
  });

  it('yayında ürün limitin altında → 0, update YOK', async () => {
    const { db, calls } = makeDb(['a', 'b']);
    const n = await unpublishVitrinOverLimit(db, 'c1', 5, now);
    expect(n).toBe(0);
    expect(calls.updateCount).toBe(0);
  });

  it('limit aşıldı → fazlası (en eskiler) vitrin\'den çekilir, reason=plan_downgrade', async () => {
    const { db, calls } = makeDb(['p1', 'p2', 'p3', 'p4', 'p5']); // 5 yayında, limit 3
    const n = await unpublishVitrinOverLimit(db, 'c1', 3, now);
    expect(n).toBe(2); // 5 - 3
    expect(calls.updateCount).toBe(1);
    expect(calls.updatedSet?.vitrinPublished).toBe(false);
    expect(calls.updatedSet?.vitrinAutoUnpublishedReason).toBe('plan_downgrade');
  });
});

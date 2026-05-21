import { describe, it, expect, vi } from 'vitest';
import type { DbClient } from '@/lib/db/client';
import {
  RETENTION_RULES,
  runRetentionCleanup,
  getRetentionStats,
} from './retention';

describe('RETENTION_RULES (shape + güvenlik invariant)', () => {
  it('audit_logs RETENTION_RULES içinde OLMAMALI (KVKK 5 yıl + vergi 10 yıl)', () => {
    expect(RETENTION_RULES.some((r) => r.table === 'audit_logs')).toBe(false);
  });

  it('invoices ve subscriptions ASLA silinmemeli', () => {
    expect(RETENTION_RULES.some((r) => r.table === 'invoices')).toBe(false);
    expect(RETENTION_RULES.some((r) => r.table === 'subscriptions')).toBe(false);
  });

  it('6 retention kuralı tanımlı (system_errors, vitrin_events, ...)', () => {
    expect(RETENTION_RULES).toHaveLength(6);
    const tables = RETENTION_RULES.map((r) => r.table);
    expect(tables).toEqual(
      expect.arrayContaining([
        'system_errors',
        'vitrin_events',
        'processed_webhooks',
        'notifications',
        'vitrin_reports',
        'vitrin_whatsapp_feedback',
      ]),
    );
  });

  it('notifications kuralında is_read=true whereExtra var', () => {
    const rule = RETENTION_RULES.find((r) => r.table === 'notifications');
    expect(rule?.whereExtra).toBeDefined();
  });

  it('vitrin_reports kuralında status<>pending whereExtra var', () => {
    const rule = RETENTION_RULES.find((r) => r.table === 'vitrin_reports');
    expect(rule?.whereExtra).toBeDefined();
  });

  it('system_errors TTL 90 gün, vitrin_events 365 gün', () => {
    const sysErr = RETENTION_RULES.find((r) => r.table === 'system_errors');
    const vEvent = RETENTION_RULES.find((r) => r.table === 'vitrin_events');
    expect(sysErr?.ageDays).toBe(90);
    expect(vEvent?.ageDays).toBe(365);
  });
});

describe('runRetentionCleanup', () => {
  it('happy path — 6 tablo için DELETE çalıştırır, totalDeleted toplar', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ count: 12 })   // system_errors
      .mockResolvedValueOnce({ count: 0 })    // vitrin_events
      .mockResolvedValueOnce({ count: 5 })    // processed_webhooks
      .mockResolvedValueOnce({ count: 33 })   // notifications
      .mockResolvedValueOnce({ count: 1 })    // vitrin_reports
      .mockResolvedValueOnce({ count: 4 });   // vitrin_whatsapp_feedback
    const db = { execute } as unknown as DbClient;
    const report = await runRetentionCleanup(db, new Date('2026-05-21T04:00:00Z'));
    expect(execute).toHaveBeenCalledTimes(6);
    expect(report.totalDeleted).toBe(55);
    expect(report.hasErrors).toBe(false);
    expect(report.rules).toHaveLength(6);
  });

  it('tek tablo fail ederse diğerleri devam eder, hasErrors=true', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockRejectedValueOnce(new Error('relation does not exist'))
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 3 })
      .mockResolvedValueOnce({ count: 4 })
      .mockResolvedValueOnce({ count: 5 });
    const db = { execute } as unknown as DbClient;
    const report = await runRetentionCleanup(db, new Date('2026-05-21T04:00:00Z'));
    expect(report.hasErrors).toBe(true);
    expect(report.totalDeleted).toBe(15);
    const failedRule = report.rules.find((r) => r.error);
    expect(failedRule?.error).toContain('relation does not exist');
    // Diğer 5 başarılı
    const okRules = report.rules.filter((r) => !r.error);
    expect(okRules).toHaveLength(5);
  });

  it('now parametresi dependency injection — deterministic cutoff', async () => {
    const execute = vi.fn().mockResolvedValue({ count: 0 });
    const db = { execute } as unknown as DbClient;
    const now1 = new Date('2026-01-01T00:00:00Z');
    const now2 = new Date('2026-12-31T00:00:00Z');
    const r1 = await runRetentionCleanup(db, now1);
    const r2 = await runRetentionCleanup(db, now2);
    expect(r1.startedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(r2.startedAt).toBe('2026-12-31T00:00:00.000Z');
  });

  it('rowCount fallback (postgres-js farklı return shape)', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 7 }) // alternatif shape
      .mockResolvedValue({ count: 0 });
    const db = { execute } as unknown as DbClient;
    const report = await runRetentionCleanup(db, new Date('2026-05-21T04:00:00Z'));
    expect(report.rules[0]?.deletedCount).toBe(7);
  });
});

describe('getRetentionStats', () => {
  it('her tablo için satır + en eski + expired döner', async () => {
    const execute = vi.fn().mockResolvedValue([
      {
        row_count: 42,
        oldest_created_at: '2025-08-01T10:00:00Z',
        expired_count: 3,
      },
    ]);
    const db = { execute } as unknown as DbClient;
    const stats = await getRetentionStats(db);
    expect(stats).toHaveLength(6);
    expect(stats[0]).toMatchObject({
      table: 'system_errors',
      ageDays: 90,
      rowCount: 42,
      hasExpired: true,
    });
  });

  it('tablo yoksa (migration apply edilmemiş) graceful 0 döner', async () => {
    const execute = vi.fn().mockRejectedValue(new Error('does not exist'));
    const db = { execute } as unknown as DbClient;
    const stats = await getRetentionStats(db);
    expect(stats).toHaveLength(6);
    expect(stats.every((s) => s.rowCount === 0 && !s.hasExpired)).toBe(true);
  });
});

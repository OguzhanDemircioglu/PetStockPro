import { describe, it, expect, vi } from 'vitest';
import type { DbClient } from '@/lib/db/client';
import {
  trackError,
  trackErrorAsync,
  sanitizePii,
  extractErrorType,
  extractMessage,
  extractStack,
} from './track';

function mockInsertChain(returningRows: Array<{ id: string }> = [{ id: 'err-1' }]) {
  const returning = vi.fn().mockResolvedValue(returningRows);
  const values = vi.fn().mockReturnValue({ returning });
  const insert = vi.fn().mockReturnValue({ values });
  return { insert, values, returning };
}

describe('sanitizePii', () => {
  it('email maskelenir', () => {
    expect(sanitizePii('User a@b.com login failed')).toBe('User [email] login failed');
  });

  it('IPv4 maskelenir', () => {
    expect(sanitizePii('Request from 192.168.1.5 denied')).toBe(
      'Request from [ip] denied',
    );
  });

  it('TC/VKN (10-11 hane) maskelenir', () => {
    expect(sanitizePii('VKN 1234567890 ve TC 12345678901 not found')).toBe(
      'VKN [tckn-vkn] ve TC [tckn-vkn] not found',
    );
  });

  it('birden fazla PII tek mesajda', () => {
    const out = sanitizePii('User a@b.com IP 10.0.0.1 TC 12345678901');
    expect(out).toContain('[email]');
    expect(out).toContain('[ip]');
    expect(out).toContain('[tckn-vkn]');
  });
});

describe('extract helpers', () => {
  it('Error.name → errorType', () => {
    const e = new TypeError('bad');
    expect(extractErrorType(e)).toBe('TypeError');
  });

  it('override > Error.name', () => {
    expect(extractErrorType(new Error('x'), 'CustomBoundary')).toBe('CustomBoundary');
  });

  it('string error → string message', () => {
    expect(extractMessage('boom')).toBe('boom');
  });

  it('Error.stack → stack', () => {
    const e = new Error('x');
    expect(extractStack(e)).toBeTruthy();
  });

  it('non-Error → null stack', () => {
    expect(extractStack('boom')).toBeNull();
  });
});

describe('trackError', () => {
  it('happy path — system_errors INSERT + PII strip', async () => {
    const { insert, values } = mockInsertChain();
    const db = { insert } as unknown as DbClient;
    const err = new Error('a@b.com login failed at 192.168.1.5');
    const r = await trackError(
      err,
      { companyId: 'co-1', userId: 'u-1', route: '/admin', action: 'product.create' },
      db,
    );
    expect(r.ok).toBe(true);
    expect(r.id).toBe('err-1');
    expect(insert).toHaveBeenCalledTimes(1);
    const args = values.mock.calls[0][0];
    expect(args.errorType).toBe('Error');
    expect(args.message).toBe('[email] login failed at [ip]');
    expect(args.companyId).toBe('co-1');
    expect(args.userId).toBe('u-1');
    expect(args.route).toBe('/admin');
    expect(args.action).toBe('product.create');
    expect(args.severity).toBe('error');
  });

  it('DB fail sessiz yutar (caller bozulmaz)', async () => {
    const insert = vi.fn().mockImplementation(() => {
      throw new Error('DB down');
    });
    const db = { insert } as unknown as DbClient;
    const r = await trackError(new Error('x'), {}, db);
    expect(r.ok).toBe(false);
  });

  it('context.metadata içindeki PII strip edilir', async () => {
    const { insert, values } = mockInsertChain();
    const db = { insert } as unknown as DbClient;
    await trackError(
      new Error('x'),
      {
        metadata: {
          user: 'admin@petshop.com',
          ip: '10.0.0.1',
          orderRef: 'PSP-ABC',
        },
      },
      db,
    );
    const args = values.mock.calls[0][0];
    expect(args.context.user).toBe('[email]');
    expect(args.context.ip).toBe('[ip]');
    expect(args.context.orderRef).toBe('PSP-ABC');
  });

  it('severity override critical kabul edilir', async () => {
    const { insert, values } = mockInsertChain();
    const db = { insert } as unknown as DbClient;
    await trackError(new Error('x'), {}, db, { severity: 'critical' });
    const args = values.mock.calls[0][0];
    expect(args.severity).toBe('critical');
  });

  it('errorTypeOverride kullanılır', async () => {
    const { insert, values } = mockInsertChain();
    const db = { insert } as unknown as DbClient;
    await trackError(new Error('x'), {}, db, {
      errorTypeOverride: 'IyzicoWebhookOrchestrationError',
    });
    const args = values.mock.calls[0][0];
    expect(args.errorType).toBe('IyzicoWebhookOrchestrationError');
  });
});

describe('trackErrorAsync', () => {
  it('fire-and-forget, caller fırlatmaz', () => {
    const insert = vi.fn().mockImplementation(() => {
      throw new Error('DB down');
    });
    const db = { insert } as unknown as DbClient;
    expect(() => trackErrorAsync(new Error('x'), {}, db)).not.toThrow();
  });
});

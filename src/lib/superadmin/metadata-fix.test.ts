import { describe, it, expect, vi } from 'vitest';
import { fixMovementMetadata, metadataFixSchema } from './metadata-fix';
import type { DbClient } from '@/lib/db/client';

const COMPANY = '11111111-1111-1111-1111-111111111111';
const MOVEMENT = '22222222-2222-2222-2222-222222222222';

function makeMockDb(opts: {
  movementRow?: {
    id: string;
    reason: string | null;
    note: string | null;
    customerRef: string | null;
    documentNo: string | null;
  } | null;
  updateShouldThrow?: boolean;
}) {
  const select = vi.fn().mockImplementation(() => {
    const chain = {
      from: vi.fn().mockImplementation(() => chain),
      where: vi.fn().mockImplementation(() => chain),
      limit: vi.fn().mockResolvedValue(opts.movementRow ? [opts.movementRow] : []),
    };
    return chain;
  });

  const update = vi.fn().mockImplementation(() => ({
    set: vi.fn().mockImplementation(() => ({
      where: opts.updateShouldThrow
        ? vi.fn().mockRejectedValue(new Error('db fail'))
        : vi.fn().mockResolvedValue(undefined),
    })),
  }));

  return { select, update } as unknown as DbClient;
}

describe('metadataFixSchema', () => {
  it('valid input — sadece reason', () => {
    expect(
      metadataFixSchema.safeParse({ movementId: MOVEMENT, reason: 'düzeltme' }).success,
    ).toBe(true);
  });

  it('valid input — birden fazla alan', () => {
    expect(
      metadataFixSchema.safeParse({
        movementId: MOVEMENT,
        reason: 'r',
        note: 'n',
        customerRef: 'c',
        documentNo: 'd',
      }).success,
    ).toBe(true);
  });

  it('invalid — hiçbir alan yok', () => {
    expect(metadataFixSchema.safeParse({ movementId: MOVEMENT }).success).toBe(false);
  });

  it('invalid — UUID hatalı', () => {
    expect(
      metadataFixSchema.safeParse({ movementId: 'bad', reason: 'r' }).success,
    ).toBe(false);
  });

  it('null kabul (alan boşaltma)', () => {
    expect(
      metadataFixSchema.safeParse({ movementId: MOVEMENT, note: null }).success,
    ).toBe(true);
  });

  it('reason >500 char reject', () => {
    expect(
      metadataFixSchema.safeParse({ movementId: MOVEMENT, reason: 'a'.repeat(501) }).success,
    ).toBe(false);
  });
});

describe('fixMovementMetadata', () => {
  it('happy path — reason değişir', async () => {
    const db = makeMockDb({
      movementRow: {
        id: MOVEMENT,
        reason: 'eski',
        note: null,
        customerRef: null,
        documentNo: null,
      },
    });
    const r = await fixMovementMetadata(COMPANY, { movementId: MOVEMENT, reason: 'yeni' }, db);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.changedFields).toEqual(['reason']);
      expect(r.before.reason).toBe('eski');
      expect(r.after.reason).toBe('yeni');
    }
  });

  it('happy — 3 alan değişir', async () => {
    const db = makeMockDb({
      movementRow: {
        id: MOVEMENT,
        reason: 'r1',
        note: 'n1',
        customerRef: 'c1',
        documentNo: null,
      },
    });
    const r = await fixMovementMetadata(
      COMPANY,
      { movementId: MOVEMENT, reason: 'r2', note: 'n2', documentNo: 'FAT-001' },
      db,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.changedFields).toEqual(['reason', 'note', 'documentNo']);
      expect(r.after.documentNo).toBe('FAT-001');
    }
  });

  it('happy — empty string → null', async () => {
    const db = makeMockDb({
      movementRow: {
        id: MOVEMENT,
        reason: 'eski',
        note: null,
        customerRef: null,
        documentNo: null,
      },
    });
    const r = await fixMovementMetadata(COMPANY, { movementId: MOVEMENT, reason: '' }, db);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.after.reason).toBe(null);
      expect(r.changedFields).toEqual(['reason']);
    }
  });

  it('no_change — aynı değer reddedilir', async () => {
    const db = makeMockDb({
      movementRow: {
        id: MOVEMENT,
        reason: 'aynı',
        note: null,
        customerRef: null,
        documentNo: null,
      },
    });
    const r = await fixMovementMetadata(COMPANY, { movementId: MOVEMENT, reason: 'aynı' }, db);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('no_change');
  });

  it('not_found — movement yok', async () => {
    const db = makeMockDb({ movementRow: null });
    const r = await fixMovementMetadata(COMPANY, { movementId: MOVEMENT, reason: 'r' }, db);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_found');
  });

  it('invalid_input — Zod fail (UUID)', async () => {
    const db = makeMockDb({});
    const r = await fixMovementMetadata(COMPANY, { movementId: 'bad', reason: 'r' }, db);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('invalid_input');
  });

  it('invalid_input — Zod fail (hiç alan yok)', async () => {
    const db = makeMockDb({});
    const r = await fixMovementMetadata(COMPANY, { movementId: MOVEMENT }, db);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('invalid_input');
  });

  it('unknown — db throw', async () => {
    const db = makeMockDb({
      movementRow: {
        id: MOVEMENT,
        reason: 'eski',
        note: null,
        customerRef: null,
        documentNo: null,
      },
      updateShouldThrow: true,
    });
    const r = await fixMovementMetadata(COMPANY, { movementId: MOVEMENT, reason: 'yeni' }, db);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('unknown');
  });
});

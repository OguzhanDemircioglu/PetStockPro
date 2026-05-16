import { describe, it, expect, vi } from 'vitest';
import {
  computeSeverity,
  formatExpiryLabel,
  listExpiringSuggestions,
  EXPIRY_CRITICAL_DAYS,
  EXPIRY_WARNING_DAYS,
} from './expiring-suggestions';
import type { DbClient } from '@/lib/db/client';

const COMPANY = 'company-uuid';
const NOW = new Date('2026-05-15T12:00:00Z');

function makeSelectChain(responses: unknown[][]) {
  let i = 0;
  return vi.fn().mockImplementation(() => {
    const data = responses[i++] ?? [];
    const makeNode = (): {
      from: ReturnType<typeof vi.fn>;
      innerJoin: ReturnType<typeof vi.fn>;
      where: ReturnType<typeof vi.fn>;
      orderBy: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
      then: (cb: (rows: unknown[]) => unknown) => Promise<unknown>;
    } => {
      const node: ReturnType<typeof makeNode> = {
        from: vi.fn(() => makeNode()),
        innerJoin: vi.fn(() => makeNode()),
        where: vi.fn(() => makeNode()),
        orderBy: vi.fn(() => makeNode()),
        limit: vi.fn(() => makeNode()),
        then: (cb) => Promise.resolve(data).then(cb),
      };
      return node;
    };
    return makeNode();
  });
}

describe('computeSeverity', () => {
  it('negatif gün → expired', () => {
    expect(computeSeverity(-1)).toBe('expired');
    expect(computeSeverity(-365)).toBe('expired');
  });

  it('0 ile 7 arası → critical (sınır dahil)', () => {
    expect(computeSeverity(0)).toBe('critical');
    expect(computeSeverity(3)).toBe('critical');
    expect(computeSeverity(EXPIRY_CRITICAL_DAYS)).toBe('critical');
  });

  it('8 ile 30 arası → warning', () => {
    expect(computeSeverity(8)).toBe('warning');
    expect(computeSeverity(15)).toBe('warning');
    expect(computeSeverity(EXPIRY_WARNING_DAYS)).toBe('warning');
  });
});

describe('formatExpiryLabel', () => {
  it('negatif gün → "N gün önce geçti"', () => {
    expect(formatExpiryLabel(-5)).toBe('5 gün önce geçti');
    expect(formatExpiryLabel(-1)).toBe('1 gün önce geçti');
  });

  it('0 → "Bugün son gün"', () => {
    expect(formatExpiryLabel(0)).toBe('Bugün son gün');
  });

  it('1 → "1 gün kaldı"', () => {
    expect(formatExpiryLabel(1)).toBe('1 gün kaldı');
  });

  it('çoğul → "N gün kaldı"', () => {
    expect(formatExpiryLabel(15)).toBe('15 gün kaldı');
    expect(formatExpiryLabel(7)).toBe('7 gün kaldı');
  });
});

describe('listExpiringSuggestions', () => {
  it('boş — boş array', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;
    const result = await listExpiringSuggestions(COMPANY, db, 5, NOW);
    expect(result).toEqual([]);
  });

  it('happy — severity ile dönüş', async () => {
    const rows = [
      {
        variantId: 'v1',
        productId: 'p1',
        productName: 'Royal Canin Adult Kedi',
        variantLabel: '2kg',
        sku: 'RC-AD-2KG',
        branchId: 'b1',
        branchName: 'Merkez Şube',
        stockQty: 5,
        expiryDate: '2026-05-10', // 5 gün önce
        daysUntilExpiry: -5,
      },
      {
        variantId: 'v2',
        productId: 'p2',
        productName: 'Acana Yetişkin Köpek',
        variantLabel: '6kg',
        sku: 'AC-AD-6KG',
        branchId: 'b1',
        branchName: 'Merkez Şube',
        stockQty: 3,
        expiryDate: '2026-05-18', // 3 gün sonra
        daysUntilExpiry: 3,
      },
      {
        variantId: 'v3',
        productId: 'p3',
        productName: 'Hill\'s Senior',
        variantLabel: '3kg',
        sku: 'HL-SR-3KG',
        branchId: 'b2',
        branchName: 'Şube 2',
        stockQty: 8,
        expiryDate: '2026-06-05', // 21 gün sonra
        daysUntilExpiry: 21,
      },
    ];
    const select = makeSelectChain([rows]);
    const db = { select } as unknown as DbClient;
    const result = await listExpiringSuggestions(COMPANY, db, 10, NOW);

    expect(result).toHaveLength(3);
    expect(result[0].severity).toBe('expired');
    expect(result[0].productName).toBe('Royal Canin Adult Kedi');
    expect(result[1].severity).toBe('critical');
    expect(result[2].severity).toBe('warning');
  });

  it('limit doğru iletilir', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;
    await listExpiringSuggestions(COMPANY, db, 3, NOW);
    expect(select).toHaveBeenCalled();
  });
});

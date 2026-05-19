import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { transferSeedImageToProduct } from './seed-image-transfer';

const mockDb = {} as never;
const COMPANY_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PRODUCT_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

interface TestDeps {
  fetchR2: Mock;
  upload: Mock;
}

function deps(overrides: Partial<TestDeps> = {}): TestDeps {
  return {
    fetchR2: overrides.fetchR2 ?? vi.fn().mockResolvedValue(Buffer.from([0xff])),
    upload:
      overrides.upload ??
      vi.fn().mockResolvedValue({
        ok: true,
        imageId: 'img-1',
        url: 'https://pub-test.r2.dev/tenants/img-1',
        storagePath: 'tenants/path',
      }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('transferSeedImageToProduct — key validation', () => {
  it('eski lokal path format → invalid_path (R2 key olmalı)', async () => {
    const d = deps();
    const r = await transferSeedImageToProduct(
      COMPANY_ID,
      PRODUCT_ID,
      'scripts/data/images/abc.jpg',
      mockDb,
      d,
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid_path');
    expect(d.fetchR2).not.toHaveBeenCalled();
  });

  it('seed prefix dışı key → invalid_path', async () => {
    const d = deps();
    const r = await transferSeedImageToProduct(
      COMPANY_ID,
      PRODUCT_ID,
      'tenants/abc/def.jpg',
      mockDb,
      d,
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid_path');
    expect(d.fetchR2).not.toHaveBeenCalled();
  });

  it('path traversal (..) → invalid_path', async () => {
    const d = deps();
    const r = await transferSeedImageToProduct(
      COMPANY_ID,
      PRODUCT_ID,
      'seed/../../../etc/passwd',
      mockDb,
      d,
    );
    expect(r.reason).toBe('invalid_path');
    expect(d.fetchR2).not.toHaveBeenCalled();
  });

  it('izin verilmeyen extension (.txt) → invalid_path', async () => {
    const d = deps();
    const r = await transferSeedImageToProduct(
      COMPANY_ID,
      PRODUCT_ID,
      'seed/abc.txt',
      mockDb,
      d,
    );
    expect(r.reason).toBe('invalid_path');
  });

  it('izin verilmeyen sub-directory → invalid_path', async () => {
    const d = deps();
    const r = await transferSeedImageToProduct(
      COMPANY_ID,
      PRODUCT_ID,
      'seed/sub/abc.jpg',
      mockDb,
      d,
    );
    expect(r.reason).toBe('invalid_path');
  });

  it.each([
    'seed/abc.jpg',
    'seed/abc.jpeg',
    'seed/abc.png',
    'seed/abc.webp',
    'seed/abc-123_XYZ.jpg',
  ])('izin verilen pattern: %s', async (validKey) => {
    const d = deps();
    const r = await transferSeedImageToProduct(
      COMPANY_ID,
      PRODUCT_ID,
      validKey,
      mockDb,
      d,
    );
    expect(r.ok).toBe(true);
    expect(d.fetchR2).toHaveBeenCalledTimes(1);
    expect(d.upload).toHaveBeenCalledTimes(1);
  });
});

describe('transferSeedImageToProduct — R2 IO', () => {
  it('R2 obje yok (null döner) → file_not_found', async () => {
    const d = deps({
      fetchR2: vi.fn().mockResolvedValue(null),
    });
    const r = await transferSeedImageToProduct(
      COMPANY_ID,
      PRODUCT_ID,
      'seed/missing.webp',
      mockDb,
      d,
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('file_not_found');
  });

  it('R2 fetch hata throw → file_read_error', async () => {
    const d = deps({
      fetchR2: vi.fn().mockRejectedValue(new Error('network down')),
    });
    const r = await transferSeedImageToProduct(
      COMPANY_ID,
      PRODUCT_ID,
      'seed/locked.webp',
      mockDb,
      d,
    );
    expect(r.reason).toBe('file_read_error');
    expect(r.message).toContain('network');
  });
});

describe('transferSeedImageToProduct — content-type detection', () => {
  it.each([
    ['seed/x.jpg', 'image/jpeg'],
    ['seed/x.jpeg', 'image/jpeg'],
    ['seed/x.png', 'image/png'],
    ['seed/x.webp', 'image/webp'],
  ])('%s → contentType %s', async (validKey, expectedCt) => {
    const d = deps();
    await transferSeedImageToProduct(COMPANY_ID, PRODUCT_ID, validKey, mockDb, d);
    expect(d.upload).toHaveBeenCalledWith(
      COMPANY_ID,
      expect.objectContaining({ contentType: expectedCt }),
      expect.any(Buffer),
      mockDb,
    );
  });
});

describe('transferSeedImageToProduct — upload result mapping', () => {
  it('upload fail → upload_failed + message forward', async () => {
    const d = deps({
      upload: vi.fn().mockResolvedValue({
        ok: false,
        reason: 'storage_error',
        message: 'R2 500',
      }),
    });
    const r = await transferSeedImageToProduct(
      COMPANY_ID,
      PRODUCT_ID,
      'seed/x.webp',
      mockDb,
      d,
    );
    expect(r.reason).toBe('upload_failed');
    expect(r.message).toContain('R2 500');
  });

  it('happy path → ok=true + imageId + url forward', async () => {
    const d = deps({
      upload: vi.fn().mockResolvedValue({
        ok: true,
        imageId: 'img-42',
        url: 'https://pub-test.r2.dev/tenants/aaa/bbb/img-42.webp',
        storagePath: 'tenants/aaa/bbb/img-42.webp',
      }),
    });
    const r = await transferSeedImageToProduct(
      COMPANY_ID,
      PRODUCT_ID,
      'seed/abc.webp',
      mockDb,
      d,
    );
    expect(r.ok).toBe(true);
    expect(r.imageId).toBe('img-42');
    expect(r.url).toContain('tenants/aaa/bbb/img-42.webp');
  });
});

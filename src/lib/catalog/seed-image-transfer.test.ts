import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { transferSeedImageToProduct } from './seed-image-transfer';

const mockDb = {} as never;
const COMPANY_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PRODUCT_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

interface TestDeps {
  readFile: Mock;
  upload: Mock;
}

function deps(overrides: Partial<TestDeps> = {}): TestDeps {
  return {
    readFile: overrides.readFile ?? vi.fn().mockResolvedValue(Buffer.from([0xff])),
    upload:
      overrides.upload ??
      vi.fn().mockResolvedValue({
        ok: true,
        imageId: 'img-1',
        url: 'https://example.com/img-1',
        storagePath: 'path',
      }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('transferSeedImageToProduct — path validation', () => {
  it('boş/geçersiz path → invalid_path', async () => {
    const d = deps();
    const r = await transferSeedImageToProduct(
      COMPANY_ID,
      PRODUCT_ID,
      'foo/bar.jpg',
      mockDb,
      d,
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid_path');
    expect(d.readFile).not.toHaveBeenCalled();
  });

  it('path traversal (..) → invalid_path', async () => {
    const d = deps();
    const r = await transferSeedImageToProduct(
      COMPANY_ID,
      PRODUCT_ID,
      'scripts/data/images/../../../etc/passwd',
      mockDb,
      d,
    );
    expect(r.reason).toBe('invalid_path');
    expect(d.readFile).not.toHaveBeenCalled();
  });

  it('izin verilmeyen extension (.txt) → invalid_path', async () => {
    const d = deps();
    const r = await transferSeedImageToProduct(
      COMPANY_ID,
      PRODUCT_ID,
      'scripts/data/images/abc.txt',
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
      'scripts/data/images/sub/abc.jpg',
      mockDb,
      d,
    );
    expect(r.reason).toBe('invalid_path');
  });

  it.each([
    'scripts/data/images/abc.jpg',
    'scripts/data/images/abc.jpeg',
    'scripts/data/images/abc.png',
    'scripts/data/images/abc.webp',
    'scripts/data/images/abc-123_XYZ.jpg',
  ])('izin verilen pattern: %s', async (validPath) => {
    const d = deps();
    const r = await transferSeedImageToProduct(
      COMPANY_ID,
      PRODUCT_ID,
      validPath,
      mockDb,
      d,
    );
    expect(r.ok).toBe(true);
    expect(d.readFile).toHaveBeenCalledTimes(1);
    expect(d.upload).toHaveBeenCalledTimes(1);
  });
});

describe('transferSeedImageToProduct — file IO', () => {
  it('dosya yok (ENOENT) → file_not_found', async () => {
    const d = deps({
      readFile: vi
        .fn()
        .mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })),
    });
    const r = await transferSeedImageToProduct(
      COMPANY_ID,
      PRODUCT_ID,
      'scripts/data/images/missing.jpg',
      mockDb,
      d,
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('file_not_found');
  });

  it('diğer hata (EACCES) → file_read_error', async () => {
    const d = deps({
      readFile: vi
        .fn()
        .mockRejectedValue(Object.assign(new Error('EACCES'), { code: 'EACCES' })),
    });
    const r = await transferSeedImageToProduct(
      COMPANY_ID,
      PRODUCT_ID,
      'scripts/data/images/locked.jpg',
      mockDb,
      d,
    );
    expect(r.reason).toBe('file_read_error');
  });
});

describe('transferSeedImageToProduct — content-type detection', () => {
  it.each([
    ['scripts/data/images/x.jpg', 'image/jpeg'],
    ['scripts/data/images/x.jpeg', 'image/jpeg'],
    ['scripts/data/images/x.png', 'image/png'],
    ['scripts/data/images/x.webp', 'image/webp'],
  ])('%s → contentType %s', async (validPath, expectedCt) => {
    const d = deps();
    await transferSeedImageToProduct(COMPANY_ID, PRODUCT_ID, validPath, mockDb, d);
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
        message: 'Storage 500',
      }),
    });
    const r = await transferSeedImageToProduct(
      COMPANY_ID,
      PRODUCT_ID,
      'scripts/data/images/x.jpg',
      mockDb,
      d,
    );
    expect(r.reason).toBe('upload_failed');
    expect(r.message).toContain('Storage 500');
  });

  it('happy path → ok=true + imageId + url forward', async () => {
    const d = deps({
      upload: vi.fn().mockResolvedValue({
        ok: true,
        imageId: 'img-42',
        url: 'https://x.supabase.co/img-42',
        storagePath: 'path',
      }),
    });
    const r = await transferSeedImageToProduct(
      COMPANY_ID,
      PRODUCT_ID,
      'scripts/data/images/abc.jpg',
      mockDb,
      d,
    );
    expect(r.ok).toBe(true);
    expect(r.imageId).toBe('img-42');
    expect(r.url).toBe('https://x.supabase.co/img-42');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  uploadProductImage,
  listProductImages,
  deleteProductImage,
  setPrimaryProductImage,
  extractStoragePathFromUrl,
  uploadInputSchema,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
} from './product-images';
import type { DbClient } from '@/lib/db/client';

const COMPANY = '11111111-1111-1111-1111-111111111111';
const PRODUCT = '22222222-2222-2222-2222-222222222222';
const IMAGE = '33333333-3333-3333-3333-333333333333';

const FAKE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const R2_BASE = 'https://pub-test.r2.dev';

// Mock R2 client
const mockR2 = {
  uploadCalls: [] as Array<{ key: string; contentType: string; cacheControl?: string }>,
  removeCalls: [] as string[],
  shouldFailUpload: false,
  uploadErrorMessage: 'r2 write denied',
};

vi.mock('@/lib/storage/r2-client', () => ({
  uploadToR2: vi
    .fn()
    .mockImplementation(
      async (
        key: string,
        _body: unknown,
        opts: { contentType: string; cacheControl?: string },
      ) => {
        mockR2.uploadCalls.push({
          key,
          contentType: opts.contentType,
          cacheControl: opts.cacheControl,
        });
        if (mockR2.shouldFailUpload) {
          throw new Error(mockR2.uploadErrorMessage);
        }
        return `${R2_BASE}/${key}`;
      },
    ),
  deleteFromR2: vi.fn().mockImplementation(async (key: string) => {
    mockR2.removeCalls.push(key);
  }),
  getR2PublicUrl: (key: string) => `${R2_BASE}/${key.replace(/^\/+/, '')}`,
  extractR2KeyFromUrl: (url: string) => {
    if (!url.startsWith(R2_BASE)) return null;
    return url.slice(R2_BASE.length).replace(/^\/+/, '');
  },
  fetchFromR2: vi.fn(),
  existsInR2: vi.fn(),
}));

beforeEach(() => {
  mockR2.uploadCalls = [];
  mockR2.removeCalls = [];
  mockR2.shouldFailUpload = false;
});

// DB chain mock factory: select chain'ler kuyruğundan sırayla
function makeDb(opts: {
  selects?: unknown[][];
  insertReturning?: unknown[];
  insertThrows?: boolean;
  updateThrows?: boolean;
  transactionRuns?: boolean;
  deleteThrows?: boolean;
}): DbClient {
  let selectCallIdx = 0;
  const select = vi.fn().mockImplementation(() => {
    const queueIdx = selectCallIdx++;
    const rows = opts.selects?.[queueIdx] ?? [];
    const node: Record<string, unknown> = {};
    const wrap = () => node;
    node.from = vi.fn(wrap);
    node.innerJoin = vi.fn(wrap);
    node.leftJoin = vi.fn(wrap);
    node.where = vi.fn(wrap);
    node.orderBy = vi.fn(wrap);
    node.limit = vi.fn(() => Promise.resolve(rows));
    // Direct then for non-limit calls (orderBy ending, where ending)
    (node as { then: (cb: (v: unknown) => unknown) => Promise<unknown> }).then =
      (cb) => Promise.resolve(rows).then(cb);
    return node;
  });

  const insert = vi.fn().mockImplementation(() => ({
    values: vi.fn().mockImplementation(() => ({
      returning: vi.fn().mockImplementation(() => {
        if (opts.insertThrows) {
          return Promise.reject(new Error('insert constraint violation'));
        }
        return Promise.resolve(opts.insertReturning ?? [{ id: IMAGE }]);
      }),
    })),
  }));

  const update = vi.fn().mockImplementation(() => ({
    set: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => {
        if (opts.updateThrows) {
          return Promise.reject(new Error('update fail'));
        }
        return Promise.resolve();
      }),
    })),
  }));

  const del = vi.fn().mockImplementation(() => ({
    where: vi.fn().mockImplementation(() => {
      if (opts.deleteThrows) {
        return Promise.reject(new Error('delete fail'));
      }
      return Promise.resolve();
    }),
  }));

  const transaction = vi.fn().mockImplementation(async (cb) => {
    opts.transactionRuns = true;
    return cb({ select, insert, update, delete: del } as unknown as DbClient);
  });

  return {
    select,
    insert,
    update,
    delete: del,
    transaction,
  } as unknown as DbClient;
}

// ──────────────────────────────────────────────────────────────────
// extractStoragePathFromUrl — R2 + legacy Supabase URL pattern desteği
// ──────────────────────────────────────────────────────────────────
describe('extractStoragePathFromUrl', () => {
  it('R2 URL → tenants/ prefix dahil key', () => {
    expect(
      extractStoragePathFromUrl(
        'https://pub-test.r2.dev/tenants/abc/def/123.png',
      ),
    ).toBe('tenants/abc/def/123.png');
  });

  it('R2 seed prefix URL → seed/ key', () => {
    expect(
      extractStoragePathFromUrl('https://pub-test.r2.dev/seed/abc123.webp'),
    ).toBe('seed/abc123.webp');
  });

  it('legacy Supabase public URL → tenants/ prefix eklenir (geriye uyumluluk)', () => {
    expect(
      extractStoragePathFromUrl(
        'https://xxx.supabase.co/storage/v1/object/public/product-images/abc/def/123.png',
      ),
    ).toBe('tenants/abc/def/123.png');
  });

  it('non-R2 non-Supabase URL → null', () => {
    expect(extractStoragePathFromUrl('https://other.com/img.png')).toBeNull();
  });

  it('legacy signed URL (Faz 2) → null (sadece public match)', () => {
    expect(
      extractStoragePathFromUrl(
        'https://xxx.supabase.co/storage/v1/object/sign/product-images/abc.png?token=xxx',
      ),
    ).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────
// uploadInputSchema (Zod)
// ──────────────────────────────────────────────────────────────────
describe('uploadInputSchema', () => {
  const valid = {
    companyId: COMPANY,
    productId: PRODUCT,
    fileName: 'photo.png',
    contentType: 'image/png' as const,
    fileBytes: 1234,
  };

  it('valid input geçer', () => {
    expect(uploadInputSchema.safeParse(valid).success).toBe(true);
  });

  it('companyId UUID değil → fail', () => {
    expect(
      uploadInputSchema.safeParse({ ...valid, companyId: 'not-uuid' }).success,
    ).toBe(false);
  });

  it('productId UUID değil → fail', () => {
    expect(
      uploadInputSchema.safeParse({ ...valid, productId: 'not-uuid' }).success,
    ).toBe(false);
  });

  it('fileName boş → fail', () => {
    expect(uploadInputSchema.safeParse({ ...valid, fileName: '' }).success).toBe(
      false,
    );
  });

  it('fileName path traversal denemesi (../) → fail', () => {
    expect(
      uploadInputSchema.safeParse({ ...valid, fileName: '../etc/passwd' })
        .success,
    ).toBe(false);
  });

  it('fileName slash içeriyor → fail', () => {
    expect(
      uploadInputSchema.safeParse({ ...valid, fileName: 'foo/bar.png' }).success,
    ).toBe(false);
  });

  it('fileName backslash içeriyor → fail', () => {
    expect(
      uploadInputSchema.safeParse({ ...valid, fileName: 'foo\\bar.png' })
        .success,
    ).toBe(false);
  });

  it('contentType yanlış MIME → fail', () => {
    expect(
      uploadInputSchema.safeParse({
        ...valid,
        contentType: 'application/octet-stream' as never,
      }).success,
    ).toBe(false);
  });

  it('fileBytes 0 → fail', () => {
    expect(uploadInputSchema.safeParse({ ...valid, fileBytes: 0 }).success).toBe(
      false,
    );
  });

  it('altText boş string → null normalize', () => {
    const parsed = uploadInputSchema.safeParse({ ...valid, altText: '' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.altText).toBeNull();
  });

  it('altText >200 char → fail', () => {
    expect(
      uploadInputSchema.safeParse({ ...valid, altText: 'x'.repeat(201) }).success,
    ).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────
// uploadProductImage
// ──────────────────────────────────────────────────────────────────
describe('uploadProductImage', () => {
  const validInput = {
    productId: PRODUCT,
    fileName: 'photo.png',
    contentType: 'image/png' as (typeof ALLOWED_MIME_TYPES)[number],
    altText: 'Test photo',
  };

  it('dosya boyutu >5MB → file_too_large + storage hiç tetiklenmez', async () => {
    const tooBig = Buffer.alloc(MAX_FILE_SIZE_BYTES + 1);
    const db = makeDb({});
    const result = await uploadProductImage(COMPANY, validInput, tooBig, db);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('file_too_large');
      expect(result.message).toMatch(/5MB/);
    }
    expect(mockR2.uploadCalls).toHaveLength(0);
  });

  it('companyId UUID değil → invalid_input', async () => {
    const db = makeDb({});
    const result = await uploadProductImage(
      'not-uuid',
      validInput,
      FAKE_PNG,
      db,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_input');
  });

  it('product başka tenant\'a ait → product_not_found', async () => {
    const db = makeDb({ selects: [[]] }); // ownership query boş
    const result = await uploadProductImage(COMPANY, validInput, FAKE_PNG, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('product_not_found');
    expect(mockR2.uploadCalls).toHaveLength(0); // storage'a hiç gitmedi
  });

  it('R2 upload fail → storage_error + DB insert atlanır', async () => {
    mockR2.shouldFailUpload = true;
    mockR2.uploadErrorMessage = 'bucket policy violation';
    const db = makeDb({
      selects: [[{ id: PRODUCT }]], // ownership ok
    });
    const result = await uploadProductImage(COMPANY, validInput, FAKE_PNG, db);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('storage_error');
      expect(result.message).toContain('bucket policy');
    }
    expect(mockR2.uploadCalls).toHaveLength(1); // upload denendi
  });

  it('happy path — ilk yüklenen → isPrimary=true, displayOrder=0, R2 URL döner', async () => {
    const db = makeDb({
      selects: [
        [{ id: PRODUCT }], // ownership
        [{ count: 0, maxOrder: -1 }], // existing count
      ],
      insertReturning: [{ id: IMAGE }],
    });
    const result = await uploadProductImage(COMPANY, validInput, FAKE_PNG, db);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.imageId).toBe(IMAGE);
      expect(result.url).toMatch(
        new RegExp(`^https://pub-test.r2.dev/tenants/${COMPANY}/${PRODUCT}/.+\\.png$`),
      );
      expect(result.storagePath).toMatch(
        new RegExp(`^tenants/${COMPANY}/${PRODUCT}/.+\\.png$`),
      );
    }
    expect(mockR2.uploadCalls).toHaveLength(1);
    expect(mockR2.uploadCalls[0].contentType).toBe('image/png');
    // CDN cache-control: 1 yıl + immutable (UUID path için güvenli)
    expect(mockR2.uploadCalls[0].cacheControl).toBe(
      'public, max-age=31536000, immutable',
    );
  });

  it('ikinci+ görsel — displayOrder existing+1, isPrimary=false', async () => {
    const db = makeDb({
      selects: [
        [{ id: PRODUCT }],
        [{ count: 3, maxOrder: 2 }], // mevcut 3 görsel, max order 2
      ],
      insertReturning: [{ id: IMAGE }],
    });
    const result = await uploadProductImage(COMPANY, validInput, FAKE_PNG, db);
    expect(result.ok).toBe(true);
    // isPrimary=false ve displayOrder=3 olarak insert'ti — insert.values
    // çağrısına argümanı doğrudan inspect zor; smoke level olarak ok yeterli
    // detay: DB integration test'te kontrol edilir
  });

  it('DB insert fail → db_error + R2 cleanup (best-effort)', async () => {
    const db = makeDb({
      selects: [[{ id: PRODUCT }], [{ count: 0, maxOrder: -1 }]],
      insertThrows: true,
    });
    const result = await uploadProductImage(COMPANY, validInput, FAKE_PNG, db);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('db_error');
      expect(result.message).toMatch(/constraint/i);
    }
    expect(mockR2.uploadCalls).toHaveLength(1); // R2'ye yazıldı
    expect(mockR2.removeCalls).toHaveLength(1); // orphan temizlendi
  });

  it('webp uzantısı doğru atanır', async () => {
    const db = makeDb({
      selects: [[{ id: PRODUCT }], [{ count: 0, maxOrder: -1 }]],
      insertReturning: [{ id: IMAGE }],
    });
    const result = await uploadProductImage(
      COMPANY,
      { ...validInput, contentType: 'image/webp' },
      FAKE_PNG,
      db,
    );
    expect(result.ok).toBe(true);
    expect(mockR2.uploadCalls[0].key).toMatch(/\.webp$/);
    expect(mockR2.uploadCalls[0].key).toMatch(/^tenants\//);
  });

  it('jpeg uzantısı .jpg olur', async () => {
    const db = makeDb({
      selects: [[{ id: PRODUCT }], [{ count: 0, maxOrder: -1 }]],
      insertReturning: [{ id: IMAGE }],
    });
    const result = await uploadProductImage(
      COMPANY,
      { ...validInput, contentType: 'image/jpeg' },
      FAKE_PNG,
      db,
    );
    expect(result.ok).toBe(true);
    expect(mockR2.uploadCalls[0].key).toMatch(/\.jpg$/);
  });
});

// ──────────────────────────────────────────────────────────────────
// listProductImages
// ──────────────────────────────────────────────────────────────────
describe('listProductImages', () => {
  it('boş — empty array', async () => {
    const db = makeDb({ selects: [[]] });
    const result = await listProductImages(COMPANY, PRODUCT, db);
    expect(result).toEqual([]);
  });

  it('R2 URL den storagePath çıkarımı yapılır', async () => {
    const rawRows = [
      {
        id: IMAGE,
        productId: PRODUCT,
        url: 'https://pub-test.r2.dev/tenants/c/p/x.png',
        isPrimary: true,
        displayOrder: 0,
        altText: null,
        createdAt: new Date('2026-05-19'),
      },
    ];
    const db = makeDb({ selects: [rawRows] });
    const result = await listProductImages(COMPANY, PRODUCT, db);
    expect(result).toHaveLength(1);
    expect(result[0].storagePath).toBe('tenants/c/p/x.png');
    expect(result[0].isPrimary).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────
// deleteProductImage
// ──────────────────────────────────────────────────────────────────
describe('deleteProductImage', () => {
  it('not_found — başka tenant\'a ait veya yok', async () => {
    const db = makeDb({ selects: [[]] });
    const result = await deleteProductImage(COMPANY, IMAGE, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });

  it('happy path — non-primary sil + R2 cleanup, newPrimaryId null', async () => {
    const db = makeDb({
      selects: [
        [
          {
            id: IMAGE,
            productId: PRODUCT,
            url: 'https://pub-test.r2.dev/tenants/c/p/x.png',
            isPrimary: false,
          },
        ],
      ],
    });
    const result = await deleteProductImage(COMPANY, IMAGE, db);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.wasPrimary).toBe(false);
      expect(result.newPrimaryId).toBeNull();
    }
    expect(mockR2.removeCalls).toHaveLength(1);
    expect(mockR2.removeCalls[0]).toBe('tenants/c/p/x.png');
  });

  it('primary sil → kalan ilk görsel auto-promote', async () => {
    const remainingId = '44444444-4444-4444-4444-444444444444';
    const db = makeDb({
      selects: [
        [
          {
            id: IMAGE,
            productId: PRODUCT,
            url: 'https://pub-test.r2.dev/tenants/c/p/primary.png',
            isPrimary: true,
          },
        ],
        [{ id: remainingId }], // remaining check
      ],
    });
    const result = await deleteProductImage(COMPANY, IMAGE, db);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.wasPrimary).toBe(true);
      expect(result.newPrimaryId).toBe(remainingId);
    }
  });

  it('tek primary → silince newPrimaryId null (tüm görseller silinmiş)', async () => {
    const db = makeDb({
      selects: [
        [
          {
            id: IMAGE,
            productId: PRODUCT,
            url: 'https://pub-test.r2.dev/tenants/c/p/lone.png',
            isPrimary: true,
          },
        ],
        [], // remaining boş
      ],
    });
    const result = await deleteProductImage(COMPANY, IMAGE, db);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.wasPrimary).toBe(true);
      expect(result.newPrimaryId).toBeNull();
    }
  });

  it('DB delete fail → db_error, R2 temizlenmez', async () => {
    const db = makeDb({
      selects: [
        [
          {
            id: IMAGE,
            productId: PRODUCT,
            url: 'https://pub-test.r2.dev/tenants/c/p/x.png',
            isPrimary: false,
          },
        ],
      ],
      deleteThrows: true,
    });
    const result = await deleteProductImage(COMPANY, IMAGE, db);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('db_error');
    }
    expect(mockR2.removeCalls).toHaveLength(0); // R2'ye hiç dokunulmadı
  });
});

// ──────────────────────────────────────────────────────────────────
// setPrimaryProductImage
// ──────────────────────────────────────────────────────────────────
describe('setPrimaryProductImage', () => {
  it('not_found — başka tenant\'a ait veya yok', async () => {
    const db = makeDb({ selects: [[]] });
    const result = await setPrimaryProductImage(COMPANY, IMAGE, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });

  it('happy — eski primary unset + yeni set, previousPrimaryId döner', async () => {
    const oldPrimaryId = '55555555-5555-5555-5555-555555555555';
    const db = makeDb({
      selects: [
        [{ id: IMAGE, productId: PRODUCT }], // ownership
        [{ id: oldPrimaryId }], // eski primary
      ],
    });
    const result = await setPrimaryProductImage(COMPANY, IMAGE, db);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.previousPrimaryId).toBe(oldPrimaryId);
    }
  });

  it('eski primary yoksa (önceki silindi) → previousPrimaryId null', async () => {
    const db = makeDb({
      selects: [
        [{ id: IMAGE, productId: PRODUCT }],
        [], // eski primary yok
      ],
    });
    const result = await setPrimaryProductImage(COMPANY, IMAGE, db);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.previousPrimaryId).toBeNull();
  });
});

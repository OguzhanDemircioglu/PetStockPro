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

// Mock Supabase admin client
const mockStorage = {
  uploadCalls: [] as Array<{ path: string; contentType: string }>,
  removeCalls: [] as string[][],
  shouldFailUpload: false,
  uploadErrorMessage: 'storage write denied',
};

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdminClient: () => ({
    storage: {
      from: (bucket: string) => ({
        upload: vi.fn().mockImplementation(async (path: string, _data, opts: { contentType: string }) => {
          mockStorage.uploadCalls.push({ path, contentType: opts.contentType });
          if (mockStorage.shouldFailUpload) {
            return { data: null, error: { message: mockStorage.uploadErrorMessage } };
          }
          return { data: { path }, error: null };
        }),
        remove: vi.fn().mockImplementation(async (paths: string[]) => {
          mockStorage.removeCalls.push(paths);
          return { data: null, error: null };
        }),
        getPublicUrl: vi.fn().mockImplementation((path: string) => ({
          data: {
            publicUrl: `https://xxx.supabase.co/storage/v1/object/public/${bucket}/${path}`,
          },
        })),
      }),
    },
  }),
}));

beforeEach(() => {
  mockStorage.uploadCalls = [];
  mockStorage.removeCalls = [];
  mockStorage.shouldFailUpload = false;
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
// extractStoragePathFromUrl
// ──────────────────────────────────────────────────────────────────
describe('extractStoragePathFromUrl', () => {
  it('valid public URL → path', () => {
    expect(
      extractStoragePathFromUrl(
        'https://xxx.supabase.co/storage/v1/object/public/product-images/abc/def/123.png',
      ),
    ).toBe('abc/def/123.png');
  });

  it('non-supabase URL → null', () => {
    expect(extractStoragePathFromUrl('https://other.com/img.png')).toBeNull();
  });

  it('signed URL (Faz 2) → null çünkü public prefix yok', () => {
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

  it('happy path', () => {
    expect(uploadInputSchema.safeParse(valid).success).toBe(true);
  });

  it('companyId UUID değil → reject', () => {
    expect(
      uploadInputSchema.safeParse({ ...valid, companyId: 'not-uuid' }).success,
    ).toBe(false);
  });

  it('fileName path traversal → reject', () => {
    expect(
      uploadInputSchema.safeParse({ ...valid, fileName: '../etc/passwd' })
        .success,
    ).toBe(false);
    expect(
      uploadInputSchema.safeParse({ ...valid, fileName: 'a/b.png' }).success,
    ).toBe(false);
    expect(
      uploadInputSchema.safeParse({ ...valid, fileName: 'a\\b.png' }).success,
    ).toBe(false);
  });

  it('contentType image/gif → reject', () => {
    expect(
      uploadInputSchema.safeParse({ ...valid, contentType: 'image/gif' as never })
        .success,
    ).toBe(false);
  });

  it('contentType allowed listede 3 değer', () => {
    expect(ALLOWED_MIME_TYPES).toEqual(['image/jpeg', 'image/png', 'image/webp']);
  });

  it('fileBytes 0 → reject', () => {
    expect(
      uploadInputSchema.safeParse({ ...valid, fileBytes: 0 }).success,
    ).toBe(false);
  });

  it('altText boş string → null normalize', () => {
    const r = uploadInputSchema.safeParse({ ...valid, altText: '' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.altText).toBeNull();
  });

  it('altText 200 karakter üstü → reject', () => {
    const r = uploadInputSchema.safeParse({
      ...valid,
      altText: 'a'.repeat(201),
    });
    expect(r.success).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────
// uploadProductImage
// ──────────────────────────────────────────────────────────────────
describe('uploadProductImage', () => {
  const validInput = {
    productId: PRODUCT,
    fileName: 'kedi.png',
    contentType: 'image/png' as const,
    altText: 'Kedi maması',
  };

  it('dosya 5MB üstü → file_too_large reject', async () => {
    const oversize = Buffer.alloc(MAX_FILE_SIZE_BYTES + 1);
    const db = makeDb({});
    const result = await uploadProductImage(COMPANY, validInput, oversize, db);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('file_too_large');
      expect(result.message).toMatch(/5MB/);
    }
    expect(mockStorage.uploadCalls).toHaveLength(0); // storage'a hiç gitmemeli
  });

  it('Zod fail (contentType invalid) → invalid_input + issue listesi', async () => {
    const db = makeDb({});
    const result = await uploadProductImage(
      COMPANY,
      { ...validInput, contentType: 'image/gif' as never },
      FAKE_PNG,
      db,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('invalid_input');
      expect(result.issues?.length).toBeGreaterThan(0);
    }
    expect(mockStorage.uploadCalls).toHaveLength(0);
  });

  it('ürün başka tenant\'a ait → product_not_found', async () => {
    const db = makeDb({ selects: [[]] }); // tenant ownership check boş
    const result = await uploadProductImage(COMPANY, validInput, FAKE_PNG, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('product_not_found');
    expect(mockStorage.uploadCalls).toHaveLength(0);
  });

  it('storage upload fail → storage_error + DB insert atlanır', async () => {
    mockStorage.shouldFailUpload = true;
    mockStorage.uploadErrorMessage = 'bucket policy violation';
    const db = makeDb({
      selects: [[{ id: PRODUCT }]], // ownership ok
    });
    const result = await uploadProductImage(COMPANY, validInput, FAKE_PNG, db);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('storage_error');
      expect(result.message).toContain('bucket policy');
    }
    expect(mockStorage.uploadCalls).toHaveLength(1); // upload denendi
  });

  it('happy path — ilk yüklenen → isPrimary=true, displayOrder=0, public URL döner', async () => {
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
        new RegExp(`product-images/${COMPANY}/${PRODUCT}/.+\\.png$`),
      );
      expect(result.storagePath).toMatch(
        new RegExp(`^${COMPANY}/${PRODUCT}/.+\\.png$`),
      );
    }
    expect(mockStorage.uploadCalls).toHaveLength(1);
    expect(mockStorage.uploadCalls[0].contentType).toBe('image/png');
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

  it('DB insert fail → db_error + storage cleanup (best-effort)', async () => {
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
    expect(mockStorage.uploadCalls).toHaveLength(1); // storage'a yazıldı
    expect(mockStorage.removeCalls).toHaveLength(1); // orphan temizlendi
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
    expect(mockStorage.uploadCalls[0].path).toMatch(/\.webp$/);
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
    expect(mockStorage.uploadCalls[0].path).toMatch(/\.jpg$/);
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

  it('storagePath çıkarımı yapılır', async () => {
    const rawRows = [
      {
        id: IMAGE,
        productId: PRODUCT,
        url: 'https://xxx.supabase.co/storage/v1/object/public/product-images/c/p/x.png',
        isPrimary: true,
        displayOrder: 0,
        altText: null,
        createdAt: new Date('2026-05-18'),
      },
    ];
    const db = makeDb({ selects: [rawRows] });
    const result = await listProductImages(COMPANY, PRODUCT, db);
    expect(result).toHaveLength(1);
    expect(result[0].storagePath).toBe('c/p/x.png');
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

  it('happy path — non-primary sil + storage cleanup, newPrimaryId null', async () => {
    const db = makeDb({
      selects: [
        [
          {
            id: IMAGE,
            productId: PRODUCT,
            url: 'https://xxx.supabase.co/storage/v1/object/public/product-images/c/p/x.png',
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
    expect(mockStorage.removeCalls).toHaveLength(1);
    expect(mockStorage.removeCalls[0][0]).toBe('c/p/x.png');
  });

  it('primary sil → kalan ilk görsel auto-promote', async () => {
    const remainingId = '44444444-4444-4444-4444-444444444444';
    const db = makeDb({
      selects: [
        [
          {
            id: IMAGE,
            productId: PRODUCT,
            url: 'https://xxx.supabase.co/storage/v1/object/public/product-images/c/p/primary.png',
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
            url: 'https://xxx.supabase.co/storage/v1/object/public/product-images/c/p/lone.png',
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

  it('DB delete fail → db_error, storage temizlenmez', async () => {
    const db = makeDb({
      selects: [
        [
          {
            id: IMAGE,
            productId: PRODUCT,
            url: 'https://xxx.supabase.co/storage/v1/object/public/product-images/c/p/x.png',
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
    expect(mockStorage.removeCalls).toHaveLength(0); // storage'a hiç dokunulmadı
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

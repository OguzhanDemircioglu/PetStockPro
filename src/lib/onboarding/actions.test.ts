import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createFirstBranch,
  saveStorefront,
  completeOnboarding,
} from './actions';
import type { DbClient } from '@/lib/db/client';

interface MockOpts {
  cityExists?: boolean;
  districtMatches?: boolean;
  insertThrows?: boolean;
  storefrontSlugTakenByOther?: boolean;
}

function makeMockDb(opts: MockOpts = {}): DbClient {
  // 4 farklı select chain çağrılır (city, district, companies-slug). Her birinde limit() resolve eder.
  const cityRow = opts.cityExists !== false ? [{ id: 1 }] : [];
  const districtRow = opts.districtMatches !== false ? [{ id: 'distr-uuid' }] : [];
  const slugOwnerRow = opts.storefrontSlugTakenByOther ? [{ id: 'other-company' }] : [];

  let selectCallIndex = 0;
  const selectReturns = [cityRow, districtRow, slugOwnerRow];

  const selectFn = vi.fn().mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockImplementation(async () => {
          return selectReturns[selectCallIndex++] ?? [];
        }),
      }),
    }),
  }));

  const insertReturning = vi.fn().mockImplementation(async () => {
    if (opts.insertThrows) throw new Error('DB constraint');
    return [{ id: 'branch-uuid-1' }];
  });
  const insertFn = vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({ returning: insertReturning }),
  });

  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const updateFn = vi.fn().mockReturnValue({ set: updateSet });

  const db = {
    select: selectFn,
    insert: insertFn,
    update: updateFn,
  } as unknown as DbClient;
  // createFirstBranch'in companies.whatsappPhone update'ini doğrulamak için set spy'ı sız.
  (db as unknown as { _updateSet: typeof updateSet })._updateSet = updateSet;
  return db;
}

beforeEach(() => vi.clearAllMocks());

describe('createFirstBranch', () => {
  const validInput = {
    name: 'Merkez Şube',
    cityId: 1,
    districtId: '11111111-1111-1111-1111-111111111111',
    address: 'Atatürk Cad. No:42',
    whatsappPhone: '0532 555 0042',
  };

  // AUTH-056
  it('Geçerli input → branch INSERT + branchId döner', async () => {
    const db = makeMockDb();
    const result = await createFirstBranch('comp-1', validInput, db);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.branchId).toBe('branch-uuid-1');
  });

  it('Şube adı çok kısa → issues', async () => {
    const db = makeMockDb();
    const result = await createFirstBranch('comp-1', { ...validInput, name: 'A' }, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((i) => i.includes('en az 2'))).toBe(true);
  });

  it('cityId aralık dışı (82) → issues', async () => {
    const db = makeMockDb();
    const result = await createFirstBranch('comp-1', { ...validInput, cityId: 82 }, db);
    expect(result.ok).toBe(false);
  });

  it('District ID DB\'de yoksa → issues "İlçe bu ile ait değil"', async () => {
    const db = makeMockDb({ districtMatches: false });
    const result = await createFirstBranch('comp-1', validInput, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((i) => i.includes('İlçe'))).toBe(true);
  });

  it('City DB\'de yoksa → issues "İl bulunamadı"', async () => {
    const db = makeMockDb({ cityExists: false });
    const result = await createFirstBranch('comp-1', validInput, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((i) => i.includes('İl'))).toBe(true);
  });

  it('Insert hatası → ok=false generic mesaj', async () => {
    const db = makeMockDb({ insertThrows: true });
    const result = await createFirstBranch('comp-1', validInput, db);
    expect(result.ok).toBe(false);
  });

  it('WhatsApp telefonu boş → issues (artık zorunlu)', async () => {
    const db = makeMockDb();
    const result = await createFirstBranch('comp-1', { ...validInput, whatsappPhone: '' }, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((i) => i.includes('WhatsApp'))).toBe(true);
  });

  it('WhatsApp telefonu geçersiz (kısa / harf) → issues', async () => {
    const db = makeMockDb();
    const tooShort = await createFirstBranch('comp-1', { ...validInput, whatsappPhone: '12345' }, db);
    expect(tooShort.ok).toBe(false);
    const letters = await createFirstBranch('comp-1', { ...validInput, whatsappPhone: 'telefonum' }, db);
    expect(letters.ok).toBe(false);
  });

  it('Telefon temizlenip companies.whatsappPhone\'a yazılır (boşluk/tire strip)', async () => {
    const db = makeMockDb();
    const result = await createFirstBranch(
      'comp-1',
      { ...validInput, whatsappPhone: '0532-555 00 42' },
      db,
    );
    expect(result.ok).toBe(true);
    const setSpy = (db as unknown as { _updateSet: ReturnType<typeof vi.fn> })._updateSet;
    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({ whatsappPhone: '05325550042' }),
    );
  });
});

/** saveStorefront sadece 1 select yapar (companies.slug). Branch mock'tan farklı. */
function makeSlugMockDb(slugOwnerRow: { id: string }[]): DbClient {
  return {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(slugOwnerRow),
        }),
      }),
    })),
    insert: vi.fn(),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  } as unknown as DbClient;
}

describe('saveStorefront', () => {
  // AUTH-058
  it('Geçerli slug → DB update + slug döner', async () => {
    const db = makeSlugMockDb([]);
    const result = await saveStorefront('comp-1', { slug: 'mavi-pet-shop' }, db);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.slug).toBe('mavi-pet-shop');
  });

  it('Slug büyük harf içerir → Zod regex reject', async () => {
    const db = makeSlugMockDb([]);
    const result = await saveStorefront('comp-1', { slug: 'MAVI PET' }, db);
    expect(result.ok).toBe(false);
  });

  it('Çok kısa slug (< 3) → issues', async () => {
    const db = makeSlugMockDb([]);
    const result = await saveStorefront('comp-1', { slug: 'ab' }, db);
    expect(result.ok).toBe(false);
  });

  it('Başka tenant aynı slug → ok=false "başka pet shop"', async () => {
    const db = makeSlugMockDb([{ id: 'other-company' }]);
    const result = await saveStorefront('comp-1', { slug: 'mavi-pet-shop' }, db);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.includes('başka'))).toBe(true);
    }
  });

  it('Aynı tenant kendi slug\'ını re-save edebilir', async () => {
    const db = makeSlugMockDb([{ id: 'comp-1' }]);
    const result = await saveStorefront('comp-1', { slug: 'mavi-pet-shop' }, db);
    expect(result.ok).toBe(true);
  });
});

describe('completeOnboarding', () => {
  it('users.onboardingCompletedAt set + completedAt döner', async () => {
    const db = makeMockDb();
    const now = new Date('2026-05-15T10:00:00Z');
    const result = await completeOnboarding('user-1', db, now);

    expect(result.ok).toBe(true);
    expect(result.completedAt).toEqual(now);
  });
});

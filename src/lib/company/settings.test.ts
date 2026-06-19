import { describe, it, expect, vi } from 'vitest';
import {
  updateCompanyProfile,
  verifyAndSaveVatNo,
  companyProfileSchema,
} from './settings';
import type { DbClient } from '@/lib/db/client';

const COMPANY = 'company-uuid';
const NOW = new Date('2026-05-15T12:00:00Z');

function makeSelectChain(responses: unknown[][]) {
  let i = 0;
  return vi.fn().mockImplementation(() => {
    const data = responses[i++] ?? [];
    const makeNode = (): {
      from: ReturnType<typeof vi.fn>;
      where: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
      then: (cb: (rows: unknown[]) => unknown) => Promise<unknown>;
    } => {
      const node: ReturnType<typeof makeNode> = {
        from: vi.fn(() => makeNode()),
        where: vi.fn(() => makeNode()),
        limit: vi.fn(() => makeNode()),
        then: (cb) => Promise.resolve(data).then(cb),
      };
      return node;
    };
    return makeNode();
  });
}

describe('companyProfileSchema', () => {
  it('minimum — name', () => {
    const r = companyProfileSchema.safeParse({ name: 'Mavi Pet Shop' });
    expect(r.success).toBe(true);
  });

  it('vatNo 10 hane VKN', () => {
    const r = companyProfileSchema.safeParse({
      name: 'Test',
      vatNo: '1234567890',
    });
    expect(r.success).toBe(true);
  });

  it('vatNo 11 hane TC', () => {
    const r = companyProfileSchema.safeParse({
      name: 'Test',
      vatNo: '12345678901',
    });
    expect(r.success).toBe(true);
  });

  it('vatNo 9 hane reddedilir', () => {
    const r = companyProfileSchema.safeParse({
      name: 'Test',
      vatNo: '123456789',
    });
    expect(r.success).toBe(false);
  });

  it('vatNo boş string → null', () => {
    const r = companyProfileSchema.safeParse({ name: 'Test', vatNo: '' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.vatNo).toBeNull();
  });

  it('cityId 82 reddedilir', () => {
    const r = companyProfileSchema.safeParse({ name: 'Test', cityId: 82 });
    expect(r.success).toBe(false);
  });

  it('whatsappPhone format yanlış', () => {
    const r = companyProfileSchema.safeParse({
      name: 'Test',
      whatsappPhone: 'abc',
    });
    expect(r.success).toBe(false);
  });
});

describe('updateCompanyProfile', () => {
  it('happy path — vat_no ekle (ilk kez) → vat_required_at set', async () => {
    const select = makeSelectChain([[{ id: COMPANY, vatNo: null }]]);
    const setFn = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const update = vi.fn().mockReturnValue({ set: setFn });
    const db = { select, update } as unknown as DbClient;

    const result = await updateCompanyProfile(
      COMPANY,
      { name: 'Mavi Pet', vatNo: '1234567890' },
      db,
      NOW,
    );
    expect(result).toEqual({ ok: true });
    const setArgs = setFn.mock.calls[0][0];
    expect(setArgs.vatNo).toBe('1234567890');
    expect(setArgs.vatRequiredAt).toEqual(NOW); // ilk kez set
  });

  it('zaten vat_no varsa vatRequiredAt update edilmez (undefined)', async () => {
    const select = makeSelectChain([[{ id: COMPANY, vatNo: '0000000000' }]]);
    const setFn = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const update = vi.fn().mockReturnValue({ set: setFn });
    const db = { select, update } as unknown as DbClient;

    await updateCompanyProfile(
      COMPANY,
      { name: 'Mavi Pet', vatNo: '1111111111' },
      db,
      NOW,
    );
    const setArgs = setFn.mock.calls[0][0];
    expect(setArgs.vatRequiredAt).toBeUndefined();
  });

  it('not_found', async () => {
    const select = makeSelectChain([[]]);
    const db = { select } as unknown as DbClient;
    const result = await updateCompanyProfile(COMPANY, { name: 'Mavi Pet' }, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });

  it('Zod fail — name < 2', async () => {
    const db = { select: vi.fn() } as unknown as DbClient;
    const result = await updateCompanyProfile(COMPANY, { name: 'X' }, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_input');
  });

  it('VKN değişince Nilvera doğrulama durumu sıfırlanır', async () => {
    const select = makeSelectChain([[{ id: COMPANY, vatNo: '1111111111' }]]);
    const setFn = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    const update = vi.fn().mockReturnValue({ set: setFn });
    const db = { select, update } as unknown as DbClient;

    await updateCompanyProfile(COMPANY, { name: 'Mavi Pet', vatNo: '1234567890' }, db, NOW);
    const setArgs = setFn.mock.calls[0][0];
    expect(setArgs.vatNoStatus).toBeNull();
    expect(setArgs.vatNoTitle).toBeNull();
    expect(setArgs.vatNoVerifiedAt).toBeNull();
  });
});

describe('verifyAndSaveVatNo', () => {
  function makeDb(existingVatNo: string | null) {
    const select = makeSelectChain([[{ vatNo: existingVatNo }]]);
    const setFn = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    const update = vi.fn().mockReturnValue({ set: setFn });
    const db = { select, update } as unknown as DbClient;
    return { db, setFn };
  }

  it('e-Fatura mükellefi → status efatura + ünvan + vatNo + ilk kez vatRequiredAt', async () => {
    const { db, setFn } = makeDb(null);
    const check = vi.fn().mockResolvedValue({ kind: 'efatura', title: 'ABC A.Ş.', alias: 'urn:x' });
    const r = await verifyAndSaveVatNo(COMPANY, '1234567890', db, { checkTaxpayer: check, now: NOW });
    expect(r).toEqual({ ok: true, kind: 'efatura', title: 'ABC A.Ş.' });
    const set = setFn.mock.calls[0][0];
    expect(set.vatNoStatus).toBe('efatura');
    expect(set.vatNoTitle).toBe('ABC A.Ş.');
    expect(set.vatNo).toBe('1234567890');
    expect(set.vatRequiredAt).toEqual(NOW);
  });

  it('e-Arşiv → status earsiv, vatNo kaydedilir', async () => {
    const { db, setFn } = makeDb('1234567890');
    const check = vi.fn().mockResolvedValue({ kind: 'earsiv', title: null, alias: null });
    const r = await verifyAndSaveVatNo(COMPANY, '1234567890', db, { checkTaxpayer: check, now: NOW });
    expect(r).toEqual({ ok: true, kind: 'earsiv', title: null });
    expect(setFn.mock.calls[0][0].vatNo).toBe('1234567890');
  });

  it('geçersiz → status invalid, vatNo KAYDEDİLMEZ', async () => {
    const { db, setFn } = makeDb(null);
    const check = vi.fn().mockResolvedValue({ kind: 'invalid', title: null, alias: null });
    const r = await verifyAndSaveVatNo(COMPANY, '9999999999', db, { checkTaxpayer: check, now: NOW });
    expect(r.ok && r.kind).toBe('invalid');
    const set = setFn.mock.calls[0][0];
    expect(set.vatNoStatus).toBe('invalid');
    expect('vatNo' in set).toBe(false);
  });

  it('boş → reason empty (Nilvera çağrılmaz)', async () => {
    const { db } = makeDb(null);
    const check = vi.fn();
    const r = await verifyAndSaveVatNo(COMPANY, '   ', db, { checkTaxpayer: check, now: NOW });
    expect(r).toEqual({ ok: false, reason: 'empty' });
    expect(check).not.toHaveBeenCalled();
  });

  it('Nilvera ağ hatası → reason network', async () => {
    const { db } = makeDb(null);
    const check = vi.fn().mockRejectedValue(new Error('boom'));
    const r = await verifyAndSaveVatNo(COMPANY, '1234567890', db, { checkTaxpayer: check, now: NOW });
    expect(r).toEqual({ ok: false, reason: 'network' });
  });
});

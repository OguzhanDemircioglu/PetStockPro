import { describe, it, expect, vi } from 'vitest';
import { storefrontSettingsSchema, upsertStorefrontSettings } from './settings';
import type { DbClient } from '@/lib/db/client';

const COMPANY = '11111111-1111-1111-1111-111111111111';
const NOW = new Date('2026-05-16T12:00:00Z');

function makeMockDb(
  shouldThrow = false,
  currentStorefrontStatus: string = 'disabled',
) {
  const calls = {
    inserts: 0,
    valuesArg: null as Record<string, unknown> | null,
    conflict: null as Record<string, unknown> | null,
    companyUpdateSet: null as Record<string, unknown> | null,
    companyUpdateCount: 0,
  };
  const insert = vi.fn().mockImplementation(() => ({
    values: vi.fn().mockImplementation((v) => {
      calls.inserts++;
      calls.valuesArg = v;
      return {
        onConflictDoUpdate: vi.fn().mockImplementation((c) => {
          calls.conflict = c;
          return shouldThrow ? Promise.reject(new Error('fail')) : Promise.resolve();
        }),
      };
    }),
  }));
  // select(companies.storefront_status) → bir satır
  const select = vi.fn().mockImplementation(() => ({
    from: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => ({
        limit: vi
          .fn()
          .mockResolvedValue([{ status: currentStorefrontStatus }]),
      })),
    })),
  }));
  // update(companies) chain
  const update = vi.fn().mockImplementation(() => ({
    set: vi.fn().mockImplementation((v) => {
      calls.companyUpdateSet = v;
      calls.companyUpdateCount++;
      return { where: vi.fn().mockResolvedValue(undefined) };
    }),
  }));
  return {
    db: { insert, select, update } as unknown as DbClient,
    calls,
  };
}

describe('storefrontSettingsSchema', () => {
  it('boş input valid (her şey opsiyonel)', () => {
    const r = storefrontSettingsSchema.safeParse({ isEnabled: false });
    expect(r.success).toBe(true);
  });

  it('email format yanlış reject', () => {
    const r = storefrontSettingsSchema.safeParse({
      isEnabled: false,
      contactEmail: 'invalid-email',
    });
    expect(r.success).toBe(false);
  });

  it('email boş string → null transform', () => {
    const r = storefrontSettingsSchema.safeParse({
      isEnabled: false,
      contactEmail: '',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.contactEmail).toBeNull();
  });

  it('WhatsApp +90 format kabul', () => {
    const r = storefrontSettingsSchema.safeParse({
      isEnabled: true,
      contactWhatsapp: '+905339998877',
    });
    expect(r.success).toBe(true);
  });

  it('WhatsApp yanlış format reject', () => {
    const r = storefrontSettingsSchema.safeParse({
      isEnabled: true,
      contactWhatsapp: '1234',
    });
    expect(r.success).toBe(false);
  });

  it('aboutContent 2000+ karakter reject', () => {
    const r = storefrontSettingsSchema.safeParse({
      isEnabled: true,
      aboutContent: 'a'.repeat(2001),
    });
    expect(r.success).toBe(false);
  });

  it('Instagram username valid', () => {
    const r = storefrontSettingsSchema.safeParse({
      isEnabled: true,
      socialInstagram: 'mavipetshop.izmir',
    });
    expect(r.success).toBe(true);
  });

  it('metaDescription 300+ reject', () => {
    const r = storefrontSettingsSchema.safeParse({
      isEnabled: true,
      metaDescription: 'a'.repeat(301),
    });
    expect(r.success).toBe(false);
  });
});

describe('upsertStorefrontSettings', () => {
  it('happy path → insert + onConflictDoUpdate set fields', async () => {
    const { db, calls } = makeMockDb();
    const result = await upsertStorefrontSettings(
      COMPANY,
      {
        isEnabled: true,
        aboutContent: 'Pet shop İzmir merkezde',
        contactWhatsapp: '+905339998877',
        socialInstagram: 'mavipet.izmir',
      },
      db,
      NOW,
    );
    expect(result.ok).toBe(true);
    expect(calls.inserts).toBe(1);
    expect(calls.valuesArg).toMatchObject({
      companyId: COMPANY,
      isEnabled: true,
      aboutContent: 'Pet shop İzmir merkezde',
      contactWhatsapp: '+905339998877',
      socialInstagram: 'mavipet.izmir',
      updatedAt: NOW,
    });
    expect(calls.conflict).toMatchObject({
      target: expect.anything(),
      set: expect.objectContaining({
        isEnabled: true,
        aboutContent: 'Pet shop İzmir merkezde',
      }),
    });
  });

  it('boş optional → null insert', async () => {
    const { db, calls } = makeMockDb();
    await upsertStorefrontSettings(COMPANY, { isEnabled: false }, db, NOW);
    expect(calls.valuesArg?.aboutContent).toBeNull();
    expect(calls.valuesArg?.contactEmail).toBeNull();
    expect(calls.valuesArg?.socialInstagram).toBeNull();
  });

  it('Zod fail → invalid_input + issues array', async () => {
    const { db } = makeMockDb();
    const result = await upsertStorefrontSettings(
      COMPANY,
      { isEnabled: true, contactEmail: 'not-email' },
      db,
    );
    expect(result.ok).toBe(false);
    if (!result.ok && result.reason === 'invalid_input') {
      expect(result.issues.length).toBeGreaterThan(0);
    } else {
      throw new Error('expected invalid_input');
    }
  });

  it('DB hata → unknown', async () => {
    const { db } = makeMockDb(true);
    const result = await upsertStorefrontSettings(COMPANY, { isEnabled: false }, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unknown');
  });

  it('isEnabled=true → companies.storefrontStatus auto-approve (otomatik onay)', async () => {
    const { db, calls } = makeMockDb(false, 'disabled');
    await upsertStorefrontSettings(COMPANY, { isEnabled: true }, db, NOW);
    expect(calls.companyUpdateCount).toBe(1);
    expect(calls.companyUpdateSet).toMatchObject({
      storefrontStatus: 'approved',
      updatedAt: NOW,
    });
  });

  it('isEnabled=false → companies.storefrontStatus disabled set', async () => {
    const { db, calls } = makeMockDb(false, 'approved');
    await upsertStorefrontSettings(COMPANY, { isEnabled: false }, db, NOW);
    expect(calls.companyUpdateSet).toMatchObject({
      storefrontStatus: 'disabled',
    });
  });

  it('status=rejected → otomatik onay bypass (manuel müdahale gerek)', async () => {
    const { db, calls } = makeMockDb(false, 'rejected');
    await upsertStorefrontSettings(COMPANY, { isEnabled: true }, db, NOW);
    expect(calls.companyUpdateCount).toBe(0);
  });

  it('status=auto_suspended → otomatik onay bypass', async () => {
    const { db, calls } = makeMockDb(false, 'auto_suspended');
    await upsertStorefrontSettings(COMPANY, { isEnabled: true }, db, NOW);
    expect(calls.companyUpdateCount).toBe(0);
  });
});

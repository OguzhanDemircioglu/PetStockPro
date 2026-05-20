import { describe, it, expect } from 'vitest';
import {
  inviteUserSchema,
  ROLE_VALUES,
  INVITE_TTL_MS,
  ROLE_LABELS,
} from './manage';

const BRANCH_ID = '11111111-1111-1111-1111-111111111111';

describe('inviteUserSchema', () => {
  it('valid STAFF input — email + role (branchId opsiyonel)', () => {
    expect(
      inviteUserSchema.safeParse({
        email: 'staff@petshop.com',
        role: 'STAFF',
      }).success,
    ).toBe(true);
  });

  it('valid OBSERVER input — branchId zorunlu (legacy SUBE_MUDURU davranışı)', () => {
    expect(
      inviteUserSchema.safeParse({
        email: 'mudur@petshop.com',
        role: 'OBSERVER',
        branchId: BRANCH_ID,
      }).success,
    ).toBe(true);
  });

  it('OBSERVER branchId yoksa reject', () => {
    expect(
      inviteUserSchema.safeParse({
        email: 'mudur@petshop.com',
        role: 'OBSERVER',
      }).success,
    ).toBe(false);
  });

  it('OBSERVER branchId boş string ise reject', () => {
    expect(
      inviteUserSchema.safeParse({
        email: 'mudur@petshop.com',
        role: 'OBSERVER',
        branchId: '',
      }).success,
    ).toBe(false);
  });

  it('email lowercased', () => {
    const r = inviteUserSchema.safeParse({
      email: 'STAFF@PetShop.COM',
      role: 'STAFF',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('staff@petshop.com');
  });

  it('invalid email reject', () => {
    expect(
      inviteUserSchema.safeParse({
        email: 'not-an-email',
        role: 'STAFF',
      }).success,
    ).toBe(false);
  });

  it('BAYI_SAHIBI role reject (sadece OBSERVER/STAFF davet edilebilir)', () => {
    expect(
      inviteUserSchema.safeParse({
        email: 'x@y.com',
        role: 'BAYI_SAHIBI',
      }).success,
    ).toBe(false);
  });

  it('SUPERADMIN role reject', () => {
    expect(
      inviteUserSchema.safeParse({
        email: 'x@y.com',
        role: 'SUPERADMIN',
      }).success,
    ).toBe(false);
  });

  it('branchId UUID değil → reject', () => {
    expect(
      inviteUserSchema.safeParse({
        email: 'x@y.com',
        role: 'STAFF',
        branchId: 'not-uuid',
      }).success,
    ).toBe(false);
  });

  it('isim opsiyonel', () => {
    expect(
      inviteUserSchema.safeParse({
        email: 'x@y.com',
        role: 'STAFF',
        name: 'Ahmet Yıldız',
      }).success,
    ).toBe(true);
  });

  it('isim >120 char reject', () => {
    expect(
      inviteUserSchema.safeParse({
        email: 'x@y.com',
        role: 'STAFF',
        name: 'a'.repeat(121),
      }).success,
    ).toBe(false);
  });
});

describe('Davet constants (link-only, 2026-05-20 revize; Faz 1 OBSERVER rename)', () => {
  it('ROLE_VALUES = OBSERVER + STAFF', () => {
    expect(ROLE_VALUES).toEqual(['OBSERVER', 'STAFF']);
  });

  it('INVITE_TTL_MS = 24 saat (email kaldırıldı, link tek yöntem)', () => {
    expect(INVITE_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });

  it('ROLE_LABELS Türkçe — Faz 3 etiket güncellemesi', () => {
    expect(ROLE_LABELS.OBSERVER).toBe('İzleyici');
    expect(ROLE_LABELS.STAFF).toBe('Çalışan');
  });
});

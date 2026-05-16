import { describe, it, expect } from 'vitest';
import {
  inviteUserSchema,
  ROLE_VALUES,
  INVITE_METHOD_VALUES,
  INVITE_TTL_BY_METHOD,
  ROLE_LABELS,
} from './manage';

describe('inviteUserSchema', () => {
  it('valid input — email + role + method', () => {
    expect(
      inviteUserSchema.safeParse({
        email: 'staff@petshop.com',
        role: 'STAFF',
        method: 'link',
      }).success,
    ).toBe(true);
  });

  it('email lowercased', () => {
    const r = inviteUserSchema.safeParse({
      email: 'STAFF@PetShop.COM',
      role: 'STAFF',
      method: 'email',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('staff@petshop.com');
  });

  it('invalid email reject', () => {
    expect(
      inviteUserSchema.safeParse({
        email: 'not-an-email',
        role: 'STAFF',
        method: 'email',
      }).success,
    ).toBe(false);
  });

  it('BAYI_SAHIBI role reject (sadece SUBE_MUDURU/STAFF davet edilebilir)', () => {
    expect(
      inviteUserSchema.safeParse({
        email: 'x@y.com',
        role: 'BAYI_SAHIBI',
        method: 'email',
      }).success,
    ).toBe(false);
  });

  it('SUPERADMIN role reject', () => {
    expect(
      inviteUserSchema.safeParse({
        email: 'x@y.com',
        role: 'SUPERADMIN',
        method: 'email',
      }).success,
    ).toBe(false);
  });

  it('method dışında bir değer reject', () => {
    expect(
      inviteUserSchema.safeParse({
        email: 'x@y.com',
        role: 'STAFF',
        method: 'sms',
      }).success,
    ).toBe(false);
  });

  it('isim opsiyonel', () => {
    expect(
      inviteUserSchema.safeParse({
        email: 'x@y.com',
        role: 'STAFF',
        method: 'link',
      }).success,
    ).toBe(true);
    expect(
      inviteUserSchema.safeParse({
        email: 'x@y.com',
        role: 'STAFF',
        method: 'link',
        name: 'Ahmet Yıldız',
      }).success,
    ).toBe(true);
  });

  it('isim >120 char reject', () => {
    expect(
      inviteUserSchema.safeParse({
        email: 'x@y.com',
        role: 'STAFF',
        method: 'link',
        name: 'a'.repeat(121),
      }).success,
    ).toBe(false);
  });
});

describe('Davet constants', () => {
  it('ROLE_VALUES = SUBE_MUDURU + STAFF', () => {
    expect(ROLE_VALUES).toEqual(['SUBE_MUDURU', 'STAFF']);
  });

  it('INVITE_METHOD_VALUES = email + link', () => {
    expect(INVITE_METHOD_VALUES).toEqual(['email', 'link']);
  });

  it('Email TTL 7 gün', () => {
    expect(INVITE_TTL_BY_METHOD.email).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('Link TTL 24 saat', () => {
    expect(INVITE_TTL_BY_METHOD.link).toBe(24 * 60 * 60 * 1000);
  });

  it('Email TTL link TTL\'den 7x büyük', () => {
    expect(INVITE_TTL_BY_METHOD.email / INVITE_TTL_BY_METHOD.link).toBe(7);
  });

  it('ROLE_LABELS Türkçe', () => {
    expect(ROLE_LABELS.SUBE_MUDURU).toBe('Şube Müdürü');
    expect(ROLE_LABELS.STAFF).toBe('Kasiyer (STAFF)');
  });
});

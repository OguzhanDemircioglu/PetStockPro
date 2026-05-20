import { describe, it, expect } from 'vitest';
import { assertNotObserver, isObserver, ObserverReadOnlyError, type RoleSession } from './role-gate';

function makeSession(role: string | undefined): RoleSession {
  return {
    user: { role: role ?? null },
  };
}

describe('assertNotObserver', () => {
  it('BAYI_SAHIBI → pass (mutation izinli)', () => {
    expect(() => assertNotObserver(makeSession('BAYI_SAHIBI'))).not.toThrow();
  });

  it('SUPERADMIN → pass', () => {
    expect(() => assertNotObserver(makeSession('SUPERADMIN'))).not.toThrow();
  });

  it('STAFF → pass (granular permission tabi)', () => {
    expect(() => assertNotObserver(makeSession('STAFF'))).not.toThrow();
  });

  it('OBSERVER → throw ObserverReadOnlyError', () => {
    expect(() => assertNotObserver(makeSession('OBSERVER'))).toThrow(ObserverReadOnlyError);
  });

  it('OBSERVER throw: error.code = observer_read_only', () => {
    try {
      assertNotObserver(makeSession('OBSERVER'));
    } catch (e) {
      expect(e).toBeInstanceOf(ObserverReadOnlyError);
      if (e instanceof ObserverReadOnlyError) {
        expect(e.code).toBe('observer_read_only');
      }
    }
  });

  it('null/undefined session → pass (auth() upstream halleder)', () => {
    expect(() => assertNotObserver(null)).not.toThrow();
    expect(() => assertNotObserver(undefined)).not.toThrow();
  });
});

describe('isObserver', () => {
  it('OBSERVER session → true', () => {
    expect(isObserver(makeSession('OBSERVER'))).toBe(true);
  });

  it('Diğer roller → false', () => {
    expect(isObserver(makeSession('BAYI_SAHIBI'))).toBe(false);
    expect(isObserver(makeSession('STAFF'))).toBe(false);
    expect(isObserver(makeSession('SUPERADMIN'))).toBe(false);
    expect(isObserver(makeSession(undefined))).toBe(false);
    expect(isObserver(null)).toBe(false);
  });
});

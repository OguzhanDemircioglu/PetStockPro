import { describe, it, expect } from 'vitest';
import { computeEffectiveThreshold } from './order-suggestions';

describe('computeEffectiveThreshold', () => {
  it('branchThresholds boş → default döner', () => {
    expect(computeEffectiveThreshold(10, null, 'branch-1')).toBe(10);
  });

  it('branchThresholds yok → default', () => {
    expect(computeEffectiveThreshold(5, undefined, 'branch-1')).toBe(5);
  });

  it('override var → override döner', () => {
    expect(
      computeEffectiveThreshold(10, { 'branch-1': 20, 'branch-2': 30 }, 'branch-2'),
    ).toBe(30);
  });

  it('override yok (farklı branch) → default', () => {
    expect(
      computeEffectiveThreshold(10, { 'branch-1': 20 }, 'branch-3'),
    ).toBe(10);
  });

  it('override 0 ise kabul edilir (yasak değil)', () => {
    expect(computeEffectiveThreshold(10, { 'b1': 0 }, 'b1')).toBe(0);
  });

  it('override NaN/Infinity → default', () => {
    expect(computeEffectiveThreshold(10, { 'b1': NaN }, 'b1')).toBe(10);
    expect(computeEffectiveThreshold(10, { 'b1': Infinity }, 'b1')).toBe(10);
  });

  it('override string ise reddedilir (type-safe)', () => {
    expect(computeEffectiveThreshold(10, { 'b1': '20' }, 'b1')).toBe(10);
  });

  it('array gelirse default', () => {
    expect(computeEffectiveThreshold(10, [1, 2, 3], 'b1')).toBe(10);
  });
});

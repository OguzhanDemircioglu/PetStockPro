import { describe, it, expect } from 'vitest';
import { makeBrandSlug } from './brand-listings';

describe('makeBrandSlug', () => {
  it.each([
    ['Royal Canin', 'royal-canin'],
    ['Pro Plan', 'pro-plan'],
    ['Catit', 'catit'],
    ['Hill\'s Science Plan', 'hill-s-science-plan'],
    ['Brit Care', 'brit-care'],
    ['Versele-Laga', 'versele-laga'],
    ['Reflex Plus', 'reflex-plus'],
    ['N&D', 'n-d'],
    ['Whiskas', 'whiskas'],
  ])('%s → %s', (input, expected) => {
    expect(makeBrandSlug(input)).toBe(expected);
  });

  it('TR karakterleri normalize eder (köpek → kopek)', () => {
    expect(makeBrandSlug('Köpek Şampuanı Çişgöz')).toBe('kopek-sampuani-cisgoz');
  });

  it('whitespace trim + multiple boşluk tek dash', () => {
    expect(makeBrandSlug('  Royal   Canin  ')).toBe('royal-canin');
  });

  it('aynı isim → aynı slug (deterministik)', () => {
    expect(makeBrandSlug('Royal Canin')).toBe(makeBrandSlug('Royal Canin'));
  });

  it('case-insensitive', () => {
    expect(makeBrandSlug('ROYAL CANIN')).toBe('royal-canin');
    expect(makeBrandSlug('royal canin')).toBe('royal-canin');
  });
});

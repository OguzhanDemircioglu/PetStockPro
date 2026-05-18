import { describe, it, expect } from 'vitest';
import { parseSearchQuery } from './search';

describe('parseSearchQuery', () => {
  it('boş/null/undefined → invalid', () => {
    expect(parseSearchQuery(null)).toEqual({ raw: '', ilikePattern: '', valid: false });
    expect(parseSearchQuery(undefined)).toEqual({ raw: '', ilikePattern: '', valid: false });
    expect(parseSearchQuery('')).toEqual({ raw: '', ilikePattern: '', valid: false });
    expect(parseSearchQuery('   ')).toEqual({ raw: '', ilikePattern: '', valid: false });
  });

  it('1 karakter → invalid (min 2)', () => {
    expect(parseSearchQuery('a').valid).toBe(false);
    expect(parseSearchQuery(' a ').valid).toBe(false);
  });

  it('2+ karakter → valid + ilikePattern', () => {
    const r = parseSearchQuery('mama');
    expect(r.valid).toBe(true);
    expect(r.raw).toBe('mama');
    expect(r.ilikePattern).toBe('%mama%');
  });

  it('trim whitespace', () => {
    expect(parseSearchQuery('  royal canin  ')).toEqual({
      raw: 'royal canin',
      ilikePattern: '%royal canin%',
      valid: true,
    });
  });

  it('SQL wildcard karakterleri (% _) escape edilir', () => {
    expect(parseSearchQuery('100%')).toEqual({
      raw: '100%',
      ilikePattern: '%100\\%%',
      valid: true,
    });
    expect(parseSearchQuery('a_b')).toEqual({
      raw: 'a_b',
      ilikePattern: '%a\\_b%',
      valid: true,
    });
  });

  it('backslash escape', () => {
    const r = parseSearchQuery('a\\b');
    expect(r.ilikePattern).toBe('%a\\\\b%');
    expect(r.valid).toBe(true);
  });

  it('Türkçe karakterler korunur', () => {
    expect(parseSearchQuery('köpek maması')).toEqual({
      raw: 'köpek maması',
      ilikePattern: '%köpek maması%',
      valid: true,
    });
  });

  it('barkod sayısal query çalışır', () => {
    expect(parseSearchQuery('3182550702683')).toEqual({
      raw: '3182550702683',
      ilikePattern: '%3182550702683%',
      valid: true,
    });
  });
});

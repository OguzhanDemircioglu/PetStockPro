import { describe, it, expect } from 'vitest';
import { formatChangePct } from './period-comparison';

describe('formatChangePct', () => {
  it('null → "yeni" / new', () => {
    expect(formatChangePct(null)).toEqual({ label: 'yeni', tone: 'new' });
  });

  it('0 → "—" / neutral', () => {
    expect(formatChangePct(0)).toEqual({ label: '—', tone: 'neutral' });
  });

  it('+25 → "+%25" / up', () => {
    expect(formatChangePct(25)).toEqual({ label: '+%25', tone: 'up' });
  });

  it('-30 → "%-30" / down', () => {
    expect(formatChangePct(-30)).toEqual({ label: '%-30', tone: 'down' });
  });

  it('0.5 rounds → "+%1" up', () => {
    expect(formatChangePct(0.5)).toEqual({ label: '+%1', tone: 'up' });
  });

  it('-0.7 rounds → "%-1" down', () => {
    expect(formatChangePct(-0.7)).toEqual({ label: '%-1', tone: 'down' });
  });

  it('100 → "+%100"', () => {
    expect(formatChangePct(100)).toEqual({ label: '+%100', tone: 'up' });
  });

  it('-100 → "%-100"', () => {
    expect(formatChangePct(-100)).toEqual({ label: '%-100', tone: 'down' });
  });
});

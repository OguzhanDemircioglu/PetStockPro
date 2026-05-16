import { describe, it, expect } from 'vitest';
import { buildWhatsappLink } from './public';

describe('buildWhatsappLink', () => {
  it('null/undefined → null', () => {
    expect(buildWhatsappLink(null)).toBeNull();
    expect(buildWhatsappLink(undefined)).toBeNull();
    expect(buildWhatsappLink('')).toBeNull();
  });

  it('+90 ile başlayan numarayı normalize', () => {
    expect(buildWhatsappLink('+905321112233')).toBe('https://wa.me/905321112233');
  });

  it('0 ile başlayan numarayı +90 ekle', () => {
    expect(buildWhatsappLink('05321112233')).toBe('https://wa.me/905321112233');
  });

  it('10 haneli (5321112233) → 90 ekle', () => {
    expect(buildWhatsappLink('5321112233')).toBe('https://wa.me/905321112233');
  });

  it('boşluk + tire içeren formatı temizler', () => {
    expect(buildWhatsappLink('+90 532 111 22 33')).toBe(
      'https://wa.me/905321112233',
    );
    expect(buildWhatsappLink('0532-111-22-33')).toBe(
      'https://wa.me/905321112233',
    );
  });

  it('mesaj prefilled URL', () => {
    const url = buildWhatsappLink('+905321112233', 'Selam, ürün var mı?');
    expect(url).toBe(
      'https://wa.me/905321112233?text=' +
        encodeURIComponent('Selam, ürün var mı?'),
    );
  });

  it('çok kısa numara → null', () => {
    expect(buildWhatsappLink('123')).toBeNull();
  });

  it('sadece harf → null', () => {
    expect(buildWhatsappLink('abc')).toBeNull();
  });
});

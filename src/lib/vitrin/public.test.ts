import { describe, it, expect } from 'vitest';
import {
  buildWhatsappLink,
  parseSortParam,
  STOREFRONT_SORTS,
} from './public';

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

describe('parseSortParam', () => {
  it('null/undefined → name_asc default', () => {
    expect(parseSortParam(null)).toBe('name_asc');
    expect(parseSortParam(undefined)).toBe('name_asc');
    expect(parseSortParam('')).toBe('name_asc');
  });

  it('geçerli sort değerleri kabul edilir', () => {
    expect(parseSortParam('name_asc')).toBe('name_asc');
    expect(parseSortParam('recent')).toBe('recent');
    expect(parseSortParam('products_desc')).toBe('products_desc');
  });

  it('bilinmeyen değer → name_asc fallback', () => {
    expect(parseSortParam('price_asc')).toBe('name_asc');
    expect(parseSortParam('random')).toBe('name_asc');
    expect(parseSortParam('NAME_ASC')).toBe('name_asc'); // case-sensitive
  });

  it('STOREFRONT_SORTS exhaustive — 3 değer', () => {
    expect(STOREFRONT_SORTS).toEqual(['name_asc', 'recent', 'products_desc']);
    expect(STOREFRONT_SORTS).toHaveLength(3);
  });

  it('STOREFRONT_SORTS değerleri parseSortParam ile uyumlu', () => {
    for (const s of STOREFRONT_SORTS) {
      expect(parseSortParam(s)).toBe(s);
    }
  });
});

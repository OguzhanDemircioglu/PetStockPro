import { describe, it, expect } from 'vitest';
import {
  parsePagination,
  buildPageMeta,
  buildPageUrl,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
} from './pagination';

describe('parsePagination', () => {
  it('boş → defaults (page=1, pageSize=50)', () => {
    expect(parsePagination(undefined)).toEqual({ page: 1, pageSize: 50, limit: 50, offset: 0 });
    expect(parsePagination({})).toEqual({ page: 1, pageSize: 50, limit: 50, offset: 0 });
  });

  it('?page=3&pageSize=100 → offset hesabı', () => {
    expect(parsePagination({ page: '3', pageSize: '100' })).toEqual({
      page: 3,
      pageSize: 100,
      limit: 100,
      offset: 200,
    });
  });

  it('geçersiz page → 1', () => {
    expect(parsePagination({ page: '0' }).page).toBe(1);
    expect(parsePagination({ page: '-5' }).page).toBe(1);
    expect(parsePagination({ page: 'abc' }).page).toBe(1);
  });

  it('float page → floor', () => {
    expect(parsePagination({ page: '2.7' }).page).toBe(2);
  });

  it('izin verilmeyen pageSize → DEFAULT (50)', () => {
    expect(parsePagination({ pageSize: '17' }).pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePagination({ pageSize: '500' }).pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePagination({ pageSize: '0' }).pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it('array string param → ilk eleman', () => {
    expect(parsePagination({ page: ['2', '3'], pageSize: ['100'] }).page).toBe(2);
  });

  it('PAGE_SIZE_OPTIONS = [50,100,200]', () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([50, 100, 200]);
  });
});

describe('buildPageMeta', () => {
  it('totalRows=0 → fromRow=0, toRow=0, totalPages=1', () => {
    const m = buildPageMeta({ page: 1, pageSize: 50, limit: 50, offset: 0 }, 0);
    expect(m.totalPages).toBe(1);
    expect(m.fromRow).toBe(0);
    expect(m.toRow).toBe(0);
    expect(m.hasPrev).toBe(false);
    expect(m.hasNext).toBe(false);
  });

  it('page 1 / 200 satır / pageSize 50 → 4 sayfa, fromRow=1, toRow=50', () => {
    const m = buildPageMeta({ page: 1, pageSize: 50, limit: 50, offset: 0 }, 200);
    expect(m.totalPages).toBe(4);
    expect(m.fromRow).toBe(1);
    expect(m.toRow).toBe(50);
    expect(m.hasPrev).toBe(false);
    expect(m.hasNext).toBe(true);
  });

  it('page 3 / 200 satır / pageSize 50 → fromRow=101, toRow=150', () => {
    const m = buildPageMeta({ page: 3, pageSize: 50, limit: 50, offset: 100 }, 200);
    expect(m.fromRow).toBe(101);
    expect(m.toRow).toBe(150);
    expect(m.hasPrev).toBe(true);
    expect(m.hasNext).toBe(true);
  });

  it('son sayfa kısmı dolu → toRow=totalRows', () => {
    // 175 satır, pageSize 50, son sayfa = 4 (151..175)
    const m = buildPageMeta({ page: 4, pageSize: 50, limit: 50, offset: 150 }, 175);
    expect(m.totalPages).toBe(4);
    expect(m.fromRow).toBe(151);
    expect(m.toRow).toBe(175);
    expect(m.hasNext).toBe(false);
  });
});

describe('buildPageUrl', () => {
  it('page=2 → URL?page=2', () => {
    expect(buildPageUrl('/admin/products', new URLSearchParams(), 2)).toBe('/admin/products?page=2');
  });

  it('page=1 → page query silinir (clean URL)', () => {
    expect(buildPageUrl('/admin/products', new URLSearchParams('page=3'), 1)).toBe('/admin/products');
  });

  it('mevcut query param korunur', () => {
    expect(
      buildPageUrl('/admin/products', new URLSearchParams('search=mama&pageSize=100'), 2),
    ).toContain('search=mama');
  });
});

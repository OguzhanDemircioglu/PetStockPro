import { describe, it, expect } from 'vitest';
import {
  haversineDistanceKm,
  parseLocationQuery,
  buildLocationFilter,
  DEFAULT_RADIUS_KM,
  MIN_RADIUS_KM,
  MAX_RADIUS_KM,
} from './geolocation';

describe('haversineDistanceKm', () => {
  it('aynı nokta → 0', () => {
    expect(haversineDistanceKm(41.0082, 28.9784, 41.0082, 28.9784)).toBe(0);
  });

  it('İstanbul Taksim → Ankara Kızılay ≈ 350 km', () => {
    // Taksim 41.0369, 28.9850 → Kızılay 39.9208, 32.8541
    const d = haversineDistanceKm(41.0369, 28.985, 39.9208, 32.8541);
    expect(d).toBeGreaterThan(340);
    expect(d).toBeLessThan(360);
  });

  it('İzmir Konak → Karşıyaka ≈ 5-7 km', () => {
    const d = haversineDistanceKm(38.4192, 27.1287, 38.4636, 27.1119);
    expect(d).toBeGreaterThan(4);
    expect(d).toBeLessThan(8);
  });

  it('NaN/Infinity input → Infinity', () => {
    expect(haversineDistanceKm(NaN, 0, 0, 0)).toBe(Infinity);
    expect(haversineDistanceKm(0, Infinity, 0, 0)).toBe(Infinity);
  });

  it('symmetric — (a,b) === (b,a)', () => {
    const d1 = haversineDistanceKm(40, 30, 41, 31);
    const d2 = haversineDistanceKm(41, 31, 40, 30);
    expect(Math.abs(d1 - d2)).toBeLessThan(0.0001);
  });
});

describe('parseLocationQuery', () => {
  it('boş input → null', () => {
    expect(parseLocationQuery(null, null, null)).toBeNull();
    expect(parseLocationQuery('41', null, null)).toBeNull();
    expect(parseLocationQuery(null, '28', null)).toBeNull();
  });

  it('NaN input → null', () => {
    expect(parseLocationQuery('abc', '28', null)).toBeNull();
    expect(parseLocationQuery('41', 'xyz', null)).toBeNull();
  });

  it('TR sınırları dışında → null', () => {
    expect(parseLocationQuery('30', '28', null)).toBeNull(); // güneyde
    expect(parseLocationQuery('50', '28', null)).toBeNull(); // kuzeyde
    expect(parseLocationQuery('41', '10', null)).toBeNull(); // batıda
    expect(parseLocationQuery('41', '60', null)).toBeNull(); // doğuda
  });

  it('TR içi geçerli koordinat → parse', () => {
    const r = parseLocationQuery('41.0082', '28.9784', null);
    expect(r).toEqual({
      lat: 41.0082,
      lng: 28.9784,
      radiusKm: DEFAULT_RADIUS_KM,
    });
  });

  it('radius parse — clamp [1, 200]', () => {
    expect(parseLocationQuery('41', '28', '50')?.radiusKm).toBe(50);
    expect(parseLocationQuery('41', '28', '500')?.radiusKm).toBe(MAX_RADIUS_KM);
    expect(parseLocationQuery('41', '28', '0.5')?.radiusKm).toBe(MIN_RADIUS_KM);
    expect(parseLocationQuery('41', '28', 'abc')?.radiusKm).toBe(DEFAULT_RADIUS_KM);
  });

  it('TR sınır kenarı — kabul', () => {
    // Hatay civarı
    expect(parseLocationQuery('36.2', '36.1', null)).not.toBeNull();
    // Edirne civarı
    expect(parseLocationQuery('41.6', '26.5', null)).not.toBeNull();
  });
});

describe('buildLocationFilter', () => {
  it('SQL builder döner — where + distanceKm', () => {
    const r = buildLocationFilter(41.0082, 28.9784, 25);
    expect(r.where).toBeDefined();
    expect(r.distanceKm).toBeDefined();
    // SQL template'lerin objesi olduğu doğrulanır (string serialize değil)
    expect(typeof r.where).toBe('object');
  });
});

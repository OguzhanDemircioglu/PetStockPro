import { describe, it, expect } from 'vitest';
import { isValidTcNo, isValidVkn, isValidVatNo, detectVatNoType } from './vatNo';

describe('isValidTcNo (11 hane TC kimlik checksum)', () => {
  // Hesap doğrulaması:
  // 12345678950 → oddSum (1+3+5+7+9)*7 - evenSum (2+4+6+8) = 175-20 = 155 → 155 % 10 = 5 (d[9]=5 ✓)
  //               sumFirst10 = 50 → 50 % 10 = 0 (d[10]=0 ✓)
  it('algoritmik geçerli TC kimliği kabul eder', () => {
    expect(isValidTcNo('12345678950')).toBe(true);
  });

  it('0 ile başlayan TC kimlik reddeder', () => {
    expect(isValidTcNo('01234567890')).toBe(false);
  });

  it('10 hane ise reddeder', () => {
    expect(isValidTcNo('1234567890')).toBe(false);
  });

  it('12 hane ise reddeder', () => {
    expect(isValidTcNo('123456789012')).toBe(false);
  });

  it('harf içeriyorsa reddeder', () => {
    expect(isValidTcNo('1234567890a')).toBe(false);
  });

  it('checksum hatalıysa reddeder', () => {
    expect(isValidTcNo('12345678951')).toBe(false);
  });

  it('boş string reddeder', () => {
    expect(isValidTcNo('')).toBe(false);
  });
});

describe('isValidVkn (10 hane VKN checksum)', () => {
  // Hesap doğrulaması:
  // 1234567890 → tüm i için (d+9-i) % 10 = 0 → sum = 0 → check = (10-0) % 10 = 0 (d[9]=0 ✓)
  it('algoritmik geçerli VKN kabul eder', () => {
    expect(isValidVkn('1234567890')).toBe(true);
  });

  it('11 hane ise reddeder', () => {
    expect(isValidVkn('12345678901')).toBe(false);
  });

  it('9 hane ise reddeder', () => {
    expect(isValidVkn('123456789')).toBe(false);
  });

  it('harf içeriyorsa reddeder', () => {
    expect(isValidVkn('123456789a')).toBe(false);
  });

  it('checksum hatalıysa reddeder', () => {
    expect(isValidVkn('1234567891')).toBe(false);
  });
});

describe('isValidVatNo (genel — TC veya VKN)', () => {
  it('geçerli TC (11 hane) kabul eder', () => {
    expect(isValidVatNo('12345678950')).toBe(true);
  });

  it('geçerli VKN (10 hane) kabul eder', () => {
    expect(isValidVatNo('1234567890')).toBe(true);
  });

  it('boşlukları temizler ve doğrular', () => {
    expect(isValidVatNo('123 456 78 90')).toBe(true);
  });

  it('uzunluk yanlışsa reddeder', () => {
    expect(isValidVatNo('1234')).toBe(false);
    expect(isValidVatNo('1234567890123')).toBe(false);
  });

  it('boş string reddeder', () => {
    expect(isValidVatNo('')).toBe(false);
  });
});

describe('detectVatNoType', () => {
  it('geçerli TC için "tc" döner', () => {
    expect(detectVatNoType('12345678950')).toBe('tc');
  });

  it('geçerli VKN için "vkn" döner', () => {
    expect(detectVatNoType('1234567890')).toBe('vkn');
  });

  it('geçersiz girdi için "invalid" döner', () => {
    expect(detectVatNoType('123')).toBe('invalid');
    expect(detectVatNoType('abc')).toBe('invalid');
    expect(detectVatNoType('')).toBe('invalid');
  });
});

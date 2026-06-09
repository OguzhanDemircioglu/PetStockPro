import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  buildPaytrTokenHash,
  buildPaytrRecurringHash,
  verifyPaytrCallbackHash,
  type PaytrTokenHashInput,
} from './hash';

const MERCHANT_KEY = 'test-merchant-key-XXXX';
const MERCHANT_SALT = 'test-merchant-salt-YYYY';

const TOKEN_INPUT: PaytrTokenHashInput = {
  merchantId: '123456',
  userIp: '1.2.3.4',
  merchantOid: 'PSP1715789432000',
  email: 'tenant@petshop.com',
  paymentAmount: '120000', // 1.200,00 ₺ (kuruş)
  userBasket: Buffer.from(
    JSON.stringify([['PetStockPro PRO planı', '1200.00', 1]]),
  ).toString('base64'),
  noInstallment: '0',
  maxInstallment: '0',
  currency: 'TL',
  testMode: '1',
};

/**
 * PayTR dokümanındaki formülü TESTTE bağımsız olarak kurar — fonksiyondaki alan
 * sırası yanlışlıkla değişirse bu beklenen değer eşleşmez.
 *   token = base64( HMAC_SHA256(hash_str + salt, key) )
 */
function expectedTokenHash(i: PaytrTokenHashInput, key: string, salt: string): string {
  const hashStr =
    i.merchantId +
    i.userIp +
    i.merchantOid +
    i.email +
    i.paymentAmount +
    i.userBasket +
    i.noInstallment +
    i.maxInstallment +
    i.currency +
    i.testMode;
  return crypto.createHmac('sha256', key).update(hashStr + salt, 'utf8').digest('base64');
}

/** Callback: base64( HMAC_SHA256(merchant_oid + salt + status + total_amount, key) ) */
function makeCallbackHash(
  merchantOid: string,
  status: string,
  totalAmount: string,
  key: string,
  salt: string,
): string {
  const hashStr = merchantOid + salt + status + totalAmount;
  return crypto.createHmac('sha256', key).update(hashStr, 'utf8').digest('base64');
}

describe('buildPaytrTokenHash', () => {
  it('PayTR formülüyle birebir eşleşir (alan sırası dahil)', () => {
    const token = buildPaytrTokenHash(TOKEN_INPUT, MERCHANT_KEY, MERCHANT_SALT);
    expect(token).toBe(expectedTokenHash(TOKEN_INPUT, MERCHANT_KEY, MERCHANT_SALT));
  });

  it('deterministik — aynı girdi aynı token', () => {
    const a = buildPaytrTokenHash(TOKEN_INPUT, MERCHANT_KEY, MERCHANT_SALT);
    const b = buildPaytrTokenHash(TOKEN_INPUT, MERCHANT_KEY, MERCHANT_SALT);
    expect(a).toBe(b);
  });

  it('base64 çıktı üretir', () => {
    const token = buildPaytrTokenHash(TOKEN_INPUT, MERCHANT_KEY, MERCHANT_SALT);
    expect(token).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  });

  it('tek alan değişince token değişir (merchant_oid)', () => {
    const base = buildPaytrTokenHash(TOKEN_INPUT, MERCHANT_KEY, MERCHANT_SALT);
    const changed = buildPaytrTokenHash(
      { ...TOKEN_INPUT, merchantOid: 'PSP-DIFFERENT' },
      MERCHANT_KEY,
      MERCHANT_SALT,
    );
    expect(changed).not.toBe(base);
  });

  it('tutar değişince token değişir (payment_amount)', () => {
    const base = buildPaytrTokenHash(TOKEN_INPUT, MERCHANT_KEY, MERCHANT_SALT);
    const changed = buildPaytrTokenHash(
      { ...TOKEN_INPUT, paymentAmount: '240000' },
      MERCHANT_KEY,
      MERCHANT_SALT,
    );
    expect(changed).not.toBe(base);
  });

  it('salt mesajın parçası — farklı salt farklı token', () => {
    const a = buildPaytrTokenHash(TOKEN_INPUT, MERCHANT_KEY, MERCHANT_SALT);
    const b = buildPaytrTokenHash(TOKEN_INPUT, MERCHANT_KEY, 'different-salt');
    expect(a).not.toBe(b);
  });

  it('farklı key farklı token', () => {
    const a = buildPaytrTokenHash(TOKEN_INPUT, MERCHANT_KEY, MERCHANT_SALT);
    const b = buildPaytrTokenHash(TOKEN_INPUT, 'different-key', MERCHANT_SALT);
    expect(a).not.toBe(b);
  });

  it('merchant_key eksik → throw (fail-fast)', () => {
    expect(() => buildPaytrTokenHash(TOKEN_INPUT, '', MERCHANT_SALT)).toThrow(/merchant_key/);
  });

  it('merchant_salt eksik → throw', () => {
    expect(() => buildPaytrTokenHash(TOKEN_INPUT, MERCHANT_KEY, '')).toThrow(/merchant_salt/);
  });
});

describe('verifyPaytrCallbackHash', () => {
  const OID = 'PSP1715789432000';

  it('geçerli callback hash → true (success)', () => {
    const hash = makeCallbackHash(OID, 'success', '120000', MERCHANT_KEY, MERCHANT_SALT);
    expect(
      verifyPaytrCallbackHash(
        { merchantOid: OID, status: 'success', totalAmount: '120000', receivedHash: hash },
        MERCHANT_KEY,
        MERCHANT_SALT,
      ),
    ).toBe(true);
  });

  it('geçerli callback hash → true (failed)', () => {
    const hash = makeCallbackHash(OID, 'failed', '0', MERCHANT_KEY, MERCHANT_SALT);
    expect(
      verifyPaytrCallbackHash(
        { merchantOid: OID, status: 'failed', totalAmount: '0', receivedHash: hash },
        MERCHANT_KEY,
        MERCHANT_SALT,
      ),
    ).toBe(true);
  });

  it('status tamper → false (success→failed enjeksiyon)', () => {
    const hash = makeCallbackHash(OID, 'failed', '0', MERCHANT_KEY, MERCHANT_SALT);
    expect(
      verifyPaytrCallbackHash(
        { merchantOid: OID, status: 'success', totalAmount: '0', receivedHash: hash },
        MERCHANT_KEY,
        MERCHANT_SALT,
      ),
    ).toBe(false);
  });

  it('total_amount tamper → false', () => {
    const hash = makeCallbackHash(OID, 'success', '120000', MERCHANT_KEY, MERCHANT_SALT);
    expect(
      verifyPaytrCallbackHash(
        { merchantOid: OID, status: 'success', totalAmount: '999999', receivedHash: hash },
        MERCHANT_KEY,
        MERCHANT_SALT,
      ),
    ).toBe(false);
  });

  it('merchant_oid tamper → false', () => {
    const hash = makeCallbackHash(OID, 'success', '120000', MERCHANT_KEY, MERCHANT_SALT);
    expect(
      verifyPaytrCallbackHash(
        { merchantOid: 'OTHER-OID', status: 'success', totalAmount: '120000', receivedHash: hash },
        MERCHANT_KEY,
        MERCHANT_SALT,
      ),
    ).toBe(false);
  });

  it('farklı salt ile imzalanmış → false (forge)', () => {
    const hash = makeCallbackHash(OID, 'success', '120000', MERCHANT_KEY, 'attacker-salt');
    expect(
      verifyPaytrCallbackHash(
        { merchantOid: OID, status: 'success', totalAmount: '120000', receivedHash: hash },
        MERCHANT_KEY,
        MERCHANT_SALT,
      ),
    ).toBe(false);
  });

  it('boş hash → false', () => {
    expect(
      verifyPaytrCallbackHash(
        { merchantOid: OID, status: 'success', totalAmount: '120000', receivedHash: '' },
        MERCHANT_KEY,
        MERCHANT_SALT,
      ),
    ).toBe(false);
  });

  it('timing-safe: kısa hash → false, throw yok', () => {
    expect(
      verifyPaytrCallbackHash(
        { merchantOid: OID, status: 'success', totalAmount: '120000', receivedHash: 'short' },
        MERCHANT_KEY,
        MERCHANT_SALT,
      ),
    ).toBe(false);
  });

  it('timing-safe: uzun hash → false', () => {
    const hash = makeCallbackHash(OID, 'success', '120000', MERCHANT_KEY, MERCHANT_SALT);
    expect(
      verifyPaytrCallbackHash(
        { merchantOid: OID, status: 'success', totalAmount: '120000', receivedHash: hash + 'extra' },
        MERCHANT_KEY,
        MERCHANT_SALT,
      ),
    ).toBe(false);
  });

  it('merchant_key eksik → throw', () => {
    expect(() =>
      verifyPaytrCallbackHash(
        { merchantOid: OID, status: 'success', totalAmount: '120000', receivedHash: 'x' },
        '',
        MERCHANT_SALT,
      ),
    ).toThrow(/merchant_key/);
  });
});

describe('buildPaytrRecurringHash', () => {
  const RINPUT = {
    merchantId: '123456',
    userIp: '1.2.3.4',
    merchantOid: 'PSPREC1715789432000',
    email: 'tenant@petshop.com',
    paymentAmount: '120000',
    paymentType: 'card',
    installmentCount: '0',
    currency: 'TL',
    testMode: '1',
    non3d: '1',
  };

  function expectedRecurring(i: typeof RINPUT, key: string, salt: string): string {
    const hashStr =
      i.merchantId +
      i.userIp +
      i.merchantOid +
      i.email +
      i.paymentAmount +
      i.paymentType +
      i.installmentCount +
      i.currency +
      i.testMode +
      i.non3d;
    return crypto.createHmac('sha256', key).update(hashStr + salt, 'utf8').digest('base64');
  }

  it('recurring formülüyle birebir eşleşir (alan sırası)', () => {
    expect(buildPaytrRecurringHash(RINPUT, MERCHANT_KEY, MERCHANT_SALT)).toBe(
      expectedRecurring(RINPUT, MERCHANT_KEY, MERCHANT_SALT),
    );
  });

  it('recurring hash ≠ get-token hash (farklı formül)', () => {
    const rec = buildPaytrRecurringHash(RINPUT, MERCHANT_KEY, MERCHANT_SALT);
    const tok = buildPaytrTokenHash(
      {
        merchantId: RINPUT.merchantId,
        userIp: RINPUT.userIp,
        merchantOid: RINPUT.merchantOid,
        email: RINPUT.email,
        paymentAmount: RINPUT.paymentAmount,
        userBasket: 'x',
        noInstallment: '1',
        maxInstallment: '0',
        currency: RINPUT.currency,
        testMode: RINPUT.testMode,
      },
      MERCHANT_KEY,
      MERCHANT_SALT,
    );
    expect(rec).not.toBe(tok);
  });

  it('tek alan değişince hash değişir (payment_amount)', () => {
    const base = buildPaytrRecurringHash(RINPUT, MERCHANT_KEY, MERCHANT_SALT);
    const changed = buildPaytrRecurringHash(
      { ...RINPUT, paymentAmount: '240000' },
      MERCHANT_KEY,
      MERCHANT_SALT,
    );
    expect(changed).not.toBe(base);
  });

  it('farklı salt/key farklı hash', () => {
    const base = buildPaytrRecurringHash(RINPUT, MERCHANT_KEY, MERCHANT_SALT);
    expect(buildPaytrRecurringHash(RINPUT, MERCHANT_KEY, 'other-salt')).not.toBe(base);
    expect(buildPaytrRecurringHash(RINPUT, 'other-key', MERCHANT_SALT)).not.toBe(base);
  });

  it('merchant_key eksik → throw', () => {
    expect(() => buildPaytrRecurringHash(RINPUT, '', MERCHANT_SALT)).toThrow(/merchant_key/);
  });
});

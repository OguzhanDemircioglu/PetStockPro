import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createPaytrIframeToken,
  chargeSavedCard,
  listSavedCards,
  paytrIframeUrl,
  PaytrApiError,
} from './client';
import { buildPaytrTokenHash, buildPaytrRecurringHash, buildPaytrSavedCardsHash } from './hash';
import { _resetPaytrConfigCache } from './config';
import type { PaytrBasketItem } from './types';

const MERCHANT_ID = '123456';
const MERCHANT_KEY = 'test-merchant-key';
const MERCHANT_SALT = 'test-merchant-salt';

const PARAMS = {
  merchantOid: 'PSP1715789432000',
  email: 'tenant@petshop.com',
  paymentAmount: 120000,
  userIp: '1.2.3.4',
  userName: 'Test Tenant',
  userAddress: 'İstanbul',
  userPhone: '+905551112233',
  basket: [['PetStockPro PRO planı', '1200.00', 1]] as PaytrBasketItem[],
  okUrl: 'https://petstockpro.com/admin/settings/billing?paytr=ok',
  failUrl: 'https://petstockpro.com/admin/settings/billing?paytr=fail',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function lastFetchBody(): URLSearchParams {
  const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
  const init = calls[calls.length - 1][1] as RequestInit;
  return new URLSearchParams(init.body as string);
}

describe('createPaytrIframeToken', () => {
  beforeEach(() => {
    vi.stubEnv('PAYTR_MERCHANT_ID', MERCHANT_ID);
    vi.stubEnv('PAYTR_MERCHANT_KEY', MERCHANT_KEY);
    vi.stubEnv('PAYTR_MERCHANT_SALT', MERCHANT_SALT);
    vi.stubEnv('PAYTR_TEST_MODE', '1');
    vi.stubEnv('PAYTR_BASE_URL', 'https://www.paytr.com');
    _resetPaytrConfigCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    _resetPaytrConfigCache();
  });

  it('status:success → token döner', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ status: 'success', token: 'iframe-token-abc' }),
    );

    const token = await createPaytrIframeToken(PARAMS);
    expect(token).toBe('iframe-token-abc');
  });

  it('doğru endpoint + form-urlencoded content-type', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ status: 'success', token: 't' }));

    await createPaytrIframeToken(PARAMS);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://www.paytr.com/odeme/api/get-token');
    expect((init as RequestInit).method).toBe('POST');
    expect(((init as RequestInit).headers as Record<string, string>)['Content-Type']).toBe(
      'application/x-www-form-urlencoded',
    );
  });

  it('gönderilen paytr_token, hash.ts ile birebir aynı (uçtan uca tutarlılık)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ status: 'success', token: 't' }),
    );

    await createPaytrIframeToken(PARAMS);
    const body = lastFetchBody();

    const userBasket = body.get('user_basket')!;
    const expected = buildPaytrTokenHash(
      {
        merchantId: MERCHANT_ID,
        userIp: PARAMS.userIp,
        merchantOid: PARAMS.merchantOid,
        email: PARAMS.email,
        paymentAmount: '120000',
        userBasket,
        noInstallment: '1',
        maxInstallment: '0',
        currency: 'TL',
        testMode: '1',
      },
      MERCHANT_KEY,
      MERCHANT_SALT,
    );
    expect(body.get('paytr_token')).toBe(expected);
  });

  it('user_basket = base64(JSON) + temel alanlar set', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ status: 'success', token: 't' }),
    );

    await createPaytrIframeToken(PARAMS);
    const body = lastFetchBody();

    const decoded = JSON.parse(Buffer.from(body.get('user_basket')!, 'base64').toString('utf8'));
    expect(decoded).toEqual([['PetStockPro PRO planı', '1200.00', 1]]);
    expect(body.get('merchant_id')).toBe(MERCHANT_ID);
    expect(body.get('merchant_oid')).toBe(PARAMS.merchantOid);
    expect(body.get('payment_amount')).toBe('120000');
    expect(body.get('test_mode')).toBe('1');
    expect(body.get('no_installment')).toBe('1'); // abonelik → taksit yok
    expect(body.get('merchant_ok_url')).toBe(PARAMS.okUrl);
  });

  it('test modunda debug_on=1 default', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ status: 'success', token: 't' }),
    );
    await createPaytrIframeToken(PARAMS);
    expect(lastFetchBody().get('debug_on')).toBe('1');
  });

  it('storeCard+utoken POST alanında + paytr_token hash dışı (değişmez)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ status: 'success', token: 't' }));

    await createPaytrIframeToken({ ...PARAMS, storeCard: 1, utoken: 'utok-123' });
    const body = lastFetchBody();

    expect(body.get('store_card')).toBe('1');
    expect(body.get('utoken')).toBe('utok-123');

    // store_card/utoken get-token hash formülünde YOK → token sadece 10 sabit alandan üretilir
    const expected = buildPaytrTokenHash(
      {
        merchantId: MERCHANT_ID,
        userIp: PARAMS.userIp,
        merchantOid: PARAMS.merchantOid,
        email: PARAMS.email,
        paymentAmount: '120000',
        userBasket: body.get('user_basket')!,
        noInstallment: '1',
        maxInstallment: '0',
        currency: 'TL',
        testMode: '1',
      },
      MERCHANT_KEY,
      MERCHANT_SALT,
    );
    expect(body.get('paytr_token')).toBe(expected);
  });

  it('status:failed → PaytrApiError + reason', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ status: 'failed', reason: 'merchant_oid tekrarlı' }),
    );

    await expect(createPaytrIframeToken(PARAMS)).rejects.toMatchObject({
      name: 'PaytrApiError',
      reason: 'merchant_oid tekrarlı',
    });
  });

  it('JSON dışı yanıt → PaytrApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html>error</html>', { status: 200 }),
    );
    await expect(createPaytrIframeToken(PARAMS)).rejects.toBeInstanceOf(PaytrApiError);
  });

  it('ağ hatası → PaytrApiError (fetch reject)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(createPaytrIframeToken(PARAMS)).rejects.toBeInstanceOf(PaytrApiError);
  });

  it('yapılandırma eksik → fetch çağrılmadan throw', async () => {
    vi.stubEnv('PAYTR_MERCHANT_ID', '');
    _resetPaytrConfigCache();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(createPaytrIframeToken(PARAMS)).rejects.toThrow(/PAYTR_MERCHANT_ID/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('paytrIframeUrl', () => {
  beforeEach(() => {
    vi.stubEnv('PAYTR_BASE_URL', 'https://www.paytr.com');
    _resetPaytrConfigCache();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    _resetPaytrConfigCache();
  });

  it('token → /odeme/guvenli/<token>', () => {
    expect(paytrIframeUrl('abc123')).toBe('https://www.paytr.com/odeme/guvenli/abc123');
  });

  it('baseUrl override', () => {
    expect(paytrIframeUrl('abc', 'https://test.example.com')).toBe(
      'https://test.example.com/odeme/guvenli/abc',
    );
  });
});

describe('chargeSavedCard', () => {
  const CHARGE = {
    merchantOid: 'PSPREC1715789432000',
    email: 'tenant@petshop.com',
    paymentAmount: 120000,
    userIp: '1.2.3.4',
    utoken: 'utok-123',
    ctoken: 'ctok-456',
    userName: 'Test Tenant',
    userAddress: 'İstanbul',
    userPhone: '+905551112233',
    okUrl: 'https://petstockpro.com/ok',
    failUrl: 'https://petstockpro.com/fail',
  };

  beforeEach(() => {
    vi.stubEnv('PAYTR_MERCHANT_ID', MERCHANT_ID);
    vi.stubEnv('PAYTR_MERCHANT_KEY', MERCHANT_KEY);
    vi.stubEnv('PAYTR_MERCHANT_SALT', MERCHANT_SALT);
    vi.stubEnv('PAYTR_TEST_MODE', '1');
    vi.stubEnv('PAYTR_BASE_URL', 'https://www.paytr.com');
    _resetPaytrConfigCache();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    _resetPaytrConfigCache();
  });

  it('status:success → yanıtı döner', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ status: 'success' }));
    const res = await chargeSavedCard(CHARGE);
    expect(res.status).toBe('success');
  });

  it('endpoint /odeme + recurring alanları + paytr_token recurring hash ile eşleşir', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ status: 'success' }));
    await chargeSavedCard(CHARGE);

    expect(fetchSpy.mock.calls[0][0]).toBe('https://www.paytr.com/odeme');

    const body = lastFetchBody();
    expect(body.get('non_3d')).toBe('1');
    expect(body.get('recurring_payment')).toBe('1');
    expect(body.get('utoken')).toBe('utok-123');
    expect(body.get('ctoken')).toBe('ctok-456');

    const expected = buildPaytrRecurringHash(
      {
        merchantId: MERCHANT_ID,
        userIp: CHARGE.userIp,
        merchantOid: CHARGE.merchantOid,
        email: CHARGE.email,
        paymentAmount: '120000',
        paymentType: 'card',
        installmentCount: '0',
        currency: 'TL',
        testMode: '1',
        non3d: '1',
      },
      MERCHANT_KEY,
      MERCHANT_SALT,
    );
    expect(body.get('paytr_token')).toBe(expected);
  });

  it('status:failed → throw DEĞİL, yanıtı döner (dunning sinyali)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ status: 'failed', err_msg: 'yetersiz bakiye' }),
    );
    const res = await chargeSavedCard(CHARGE);
    expect(res.status).toBe('failed');
    expect(res.err_msg).toBe('yetersiz bakiye');
  });

  it('status:wait_callback → yanıtı döner', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ status: 'wait_callback' }));
    const res = await chargeSavedCard(CHARGE);
    expect(res.status).toBe('wait_callback');
  });

  it('ağ hatası → PaytrApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(chargeSavedCard(CHARGE)).rejects.toBeInstanceOf(PaytrApiError);
  });

  it('config eksik → fetch çağrılmadan throw', async () => {
    vi.stubEnv('PAYTR_MERCHANT_KEY', '');
    _resetPaytrConfigCache();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await expect(chargeSavedCard(CHARGE)).rejects.toBeInstanceOf(PaytrApiError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('listSavedCards', () => {
  beforeEach(() => {
    vi.stubEnv('PAYTR_MERCHANT_ID', MERCHANT_ID);
    vi.stubEnv('PAYTR_MERCHANT_KEY', MERCHANT_KEY);
    vi.stubEnv('PAYTR_MERCHANT_SALT', MERCHANT_SALT);
    vi.stubEnv('PAYTR_TEST_MODE', '1');
    vi.stubEnv('PAYTR_BASE_URL', 'https://www.paytr.com');
    _resetPaytrConfigCache();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    _resetPaytrConfigCache();
  });

  it('success → kart listesi + endpoint /odeme/capi/list + doğru hash', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ status: 'success', cards: [{ ctoken: 'ctok-1', last_4: '1234', c_brand: 'visa' }] }));

    const cards = await listSavedCards('utok-1');

    expect(cards).toHaveLength(1);
    expect(cards[0].ctoken).toBe('ctok-1');
    expect(fetchSpy.mock.calls[0][0]).toBe('https://www.paytr.com/odeme/capi/list');
    const body = lastFetchBody();
    expect(body.get('utoken')).toBe('utok-1');
    expect(body.get('paytr_token')).toBe(buildPaytrSavedCardsHash('utok-1', MERCHANT_KEY, MERCHANT_SALT));
  });

  // PayTR'ın DOKÜMANLI gerçek başarı biçimi: kartların DÜZ DİZİSİ (üstte status yok).
  // Eski şema bunu reddedip "beklenmedik yanıt biçimi (HTTP 200)" throw ediyordu (prod bug).
  it('PayTR gerçek format: düz kart dizisi → parse edilir (regresyon: prod 500)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse([
        { ctoken: 'ctok-A', last_4: '0008', month: '05', year: '28', c_bank: 'Yapı Kredi', schema: 'VISA' },
        { ctoken: 'ctok-B', last_4: '4242', schema: 'MASTERCARD' },
      ]),
    );
    const cards = await listSavedCards('utok-1');
    expect(cards).toHaveLength(2);
    expect(cards[0].ctoken).toBe('ctok-A');
    expect(cards[1].ctoken).toBe('ctok-B');
  });

  it('cards yoksa (obje sarmalı) → boş dizi', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ status: 'success' }));
    expect(await listSavedCards('utok-1')).toEqual([]);
  });

  it('eşleşme yoksa boş JSON {} → boş dizi', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({}));
    expect(await listSavedCards('utok-1')).toEqual([]);
  });

  it('boş dizi [] → boş dizi', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([]));
    expect(await listSavedCards('utok-1')).toEqual([]);
  });

  it('status error → PaytrApiError (err_msg mesaja girer)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ status: 'error', err_msg: 'utoken yok' }));
    await expect(listSavedCards('utok-1')).rejects.toThrow(/utoken yok/);
  });

  it('ağ hatası → PaytrApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(listSavedCards('utok-1')).rejects.toBeInstanceOf(PaytrApiError);
  });

  it('config eksik → fetch çağrılmadan throw', async () => {
    vi.stubEnv('PAYTR_MERCHANT_KEY', '');
    _resetPaytrConfigCache();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await expect(listSavedCards('utok-1')).rejects.toBeInstanceOf(PaytrApiError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  checkTaxpayer,
  getNilveraSellerCompany,
  NIHAI_TUKETICI_TAX_NUMBER,
} from './lookup';
import { _setBackoffForTesting } from './client';
import { _resetNilveraConfigCache } from './config';

// Checksum'u geçen gerçek numaralar:
const VALID_VKN = '1234567890'; // geçerli VKN checksum
const VALID_TCKN = '10000000146'; // geçerli TC kimlik checksum
const INVALID_VKN = '1234567891'; // VKN checksum bozuk (son hane)

function makeMockResponse(status: number, body: unknown): Response {
  const text = body === null ? '' : JSON.stringify(body);
  return new Response(text, { status, headers: { 'Content-Type': 'application/json' } });
}

describe('checkTaxpayer', () => {
  beforeEach(() => {
    vi.stubEnv('NILVERA_API_KEY', 'test-api-key');
    vi.stubEnv('NILVERA_SELLER_VKN', '1234567890');
    vi.stubEnv('NILVERA_BASE_URL', 'https://api.nilvera.com');
    _resetNilveraConfigCache();
    _setBackoffForTesting(() => 1);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    _resetNilveraConfigCache();
    _setBackoffForTesting(null);
  });

  it('geçersiz checksum VKN → invalid, Nilvera çağrılmaz', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const res = await checkTaxpayer(INVALID_VKN);
    expect(res.kind).toBe('invalid');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('boş/çöp giriş → invalid, çağrı yok', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect((await checkTaxpayer('')).kind).toBe('invalid');
    expect((await checkTaxpayer('abc')).kind).toBe('invalid');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('geçerli TCKN (11 hane) → earsiv, Nilvera çağrılmaz (bireysel)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const res = await checkTaxpayer(VALID_TCKN);
    expect(res).toEqual({ kind: 'earsiv', title: null, alias: null });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('boşluk/tire içeren TCKN normalize edilir → earsiv', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const res = await checkTaxpayer('100 000 001-46');
    expect(res.kind).toBe('earsiv');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('geçerli VKN + Nilvera kayıt dönerse → efatura + ünvan + alias', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeMockResponse(200, [
        {
          TaxNumber: VALID_VKN,
          Title: 'ABC Petshop Ticaret A.Ş.',
          Name: 'urn:mail:defaultpk@abc.com',
          Type: 'PK',
          DocumentType: 'Invoice',
        },
      ]),
    );
    const res = await checkTaxpayer(VALID_VKN);
    expect(res.kind).toBe('efatura');
    expect(res.title).toBe('ABC Petshop Ticaret A.Ş.');
    expect(res.alias).toBe('urn:mail:defaultpk@abc.com');
  });

  it('VKN sorgu URL + globalUserType=Invoice doğru kurulur', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(makeMockResponse(200, []));
    await checkTaxpayer(VALID_VKN);
    const url = (fetchSpy.mock.calls[0][0] as URL | string).toString();
    expect(url).toContain('/general/GlobalCompany/Check/TaxNumber/1234567890');
    expect(url).toContain('globalUserType=Invoice');
  });

  it('geçerli VKN + boş dizi → earsiv (mükellef değil)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeMockResponse(200, []));
    const res = await checkTaxpayer(VALID_VKN);
    expect(res.kind).toBe('earsiv');
    expect(res.title).toBeNull();
    expect(res.alias).toBeNull();
  });

  it('geçerli VKN + 404 → earsiv (kayıt yok)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeMockResponse(404, { Message: 'not found' }),
    );
    const res = await checkTaxpayer(VALID_VKN);
    expect(res.kind).toBe('earsiv');
  });

  it('geçerli VKN + Nilvera 400 → invalid', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeMockResponse(400, { Message: 'invalid tax number' }),
    );
    const res = await checkTaxpayer(VALID_VKN);
    expect(res.kind).toBe('invalid');
  });

  it('çok etiket dönerse PK tipi tercih edilir', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeMockResponse(200, [
        { Title: 'X', Name: 'urn:mail:gb@x.com', Type: 'GB' },
        { Title: 'X', Name: 'urn:mail:pk@x.com', Type: 'PK' },
      ]),
    );
    const res = await checkTaxpayer(VALID_VKN);
    expect(res.alias).toBe('urn:mail:pk@x.com');
  });

  it('5xx/ağ hatası → throw (caller best-effort)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeMockResponse(500, { e: 1 }));
    await expect(checkTaxpayer(VALID_VKN)).rejects.toBeTruthy();
  });

  it('nihai tüketici sabiti GİB konvansiyonu', () => {
    expect(NIHAI_TUKETICI_TAX_NUMBER).toBe('11111111111');
  });
});

describe('getNilveraSellerCompany', () => {
  beforeEach(() => {
    vi.stubEnv('NILVERA_API_KEY', 'test-api-key');
    vi.stubEnv('NILVERA_SELLER_VKN', '1234567890');
    vi.stubEnv('NILVERA_BASE_URL', 'https://api.nilvera.com');
    _resetNilveraConfigCache();
    _setBackoffForTesting(() => 1);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    _resetNilveraConfigCache();
    _setBackoffForTesting(null);
  });

  it('GET /general/Company → profil parse edilir', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeMockResponse(200, {
        Name: 'PetStockPro Yazılım A.Ş.',
        TaxNumber: '1234567890',
        City: 'İstanbul',
        IsActive: true,
        ExtraField: 'passthrough-ok',
      }),
    );
    const res = await getNilveraSellerCompany();
    expect(res.Name).toBe('PetStockPro Yazılım A.Ş.');
    expect(res.TaxNumber).toBe('1234567890');
    expect(res.IsActive).toBe(true);
    const url = (fetchSpy.mock.calls[0][0] as URL | string).toString();
    expect(url).toContain('/general/Company');
  });

  it('401 → NilveraApiError fırlatır (anahtar yanlış)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      makeMockResponse(401, { Message: 'unauthorized' }),
    );
    await expect(getNilveraSellerCompany()).rejects.toBeTruthy();
  });
});

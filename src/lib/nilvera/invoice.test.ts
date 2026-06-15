import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createNilveraInvoice,
  retrieveNilveraInvoice,
  cancelNilveraInvoice,
} from './invoice';
import { _resetNilveraConfigCache } from './config';
import type { NilveraInvoiceCreateRequest } from './types';

function makeMockResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// externalRef bir UUID → Nilvera ETTN olarak aynen kullanılır (idempotency)
const INVOICE_UUID = '0edee3ab-0915-483d-8880-c402404f2cdd';

const validInvoiceInput: NilveraInvoiceCreateRequest = {
  externalRef: INVOICE_UUID,
  invoiceDate: '2026-05-15T10:00:00Z',
  series: 'ABC',
  customer: {
    taxNumber: '1234567890',
    title: 'Mavi Pet Shop',
    address: 'Üsküdar, Mimar Sinan Mh.',
    city: 'İstanbul',
  },
  lines: [
    {
      name: 'PetStockPro PRO plan - Aylık abonelik',
      quantity: 1,
      unitPrice: 8.33, // KDV hariç (matrah)
      vatRate: 20,
    },
  ],
};

const validSendResponse = {
  UUID: 'nv-ettn-uuid-123',
  InvoiceNumber: 'ABC2026000147',
};

describe('nilvera invoice operations', () => {
  beforeEach(() => {
    vi.stubEnv('NILVERA_API_KEY', 'test-key');
    vi.stubEnv('NILVERA_SELLER_VKN', '1234567890');
    vi.stubEnv('NILVERA_BASE_URL', 'https://apitest.nilvera.com');
    vi.stubEnv('NILVERA_SERIE', 'PSP');
    _resetNilveraConfigCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    _resetNilveraConfigCache();
  });

  // ────────────────────────────────────────────────────────────────
  // createNilveraInvoice
  // ────────────────────────────────────────────────────────────────

  describe('createNilveraInvoice', () => {
    it('başarılı POST → /earchive/Send/Model + UUID/InvoiceNumber döner', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        makeMockResponse(200, validSendResponse),
      );

      const result = await createNilveraInvoice(validInvoiceInput);

      expect(result.invoiceId).toBe('nv-ettn-uuid-123');
      expect(result.invoiceNumber).toBe('ABC2026000147');
      expect(result.externalRef).toBe(INVOICE_UUID);
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://apitest.nilvera.com/earchive/Send/Model',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('ArchiveInvoice modeli: seri + UUID + KDV hesabı doğru', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        makeMockResponse(200, validSendResponse),
      );

      await createNilveraInvoice(validInvoiceInput);

      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      const inv = body.ArchiveInvoice;
      expect(inv.InvoiceInfo.InvoiceSerieOrNumber).toBe('ABC');
      expect(inv.InvoiceInfo.InvoiceType).toBe('SATIS');
      expect(inv.InvoiceInfo.UUID).toBe(INVOICE_UUID); // externalRef UUID → ETTN
      expect(inv.InvoiceInfo.LineExtensionAmount).toBe(8.33);
      expect(inv.InvoiceInfo.KdvTotal).toBe(1.67);
      expect(inv.InvoiceInfo.PayableAmount).toBe(10);
      expect(inv.InvoiceInfo.GeneralKDV20Total).toBe(1.67);
      expect(inv.CustomerInfo.TaxNumber).toBe('1234567890');
      expect(inv.InvoiceLines[0].KDVTotal).toBe(1.67);
      expect(inv.InvoiceLines[0].Taxes[0].TaxCode).toBe('0015');
    });

    it('series input yoksa NILVERA_SERIE env kullanılır', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        makeMockResponse(200, validSendResponse),
      );

      const { series: _omit, ...noSeries } = validInvoiceInput;
      await createNilveraInvoice(noSeries);

      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.ArchiveInvoice.InvoiceInfo.InvoiceSerieOrNumber).toBe('PSP'); // env
    });

    it('hiçbir seri yoksa (input + env) → throw, fetch yok', async () => {
      vi.stubEnv('NILVERA_SERIE', '');
      _resetNilveraConfigCache();
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const { series: _omit, ...noSeries } = validInvoiceInput;
      await expect(createNilveraInvoice(noSeries)).rejects.toThrow(/seri/i);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('externalRef UUID değilse yeni UUID üretilir', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        makeMockResponse(200, validSendResponse),
      );

      await createNilveraInvoice({ ...validInvoiceInput, externalRef: 'sub_123_2026-05' });

      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.ArchiveInvoice.InvoiceInfo.UUID).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(body.ArchiveInvoice.InvoiceInfo.UUID).not.toBe('sub_123_2026-05');
    });

    it('input validation: lines boş → Zod reject (fetch yok)', async () => {
      const invalid = { ...validInvoiceInput, lines: [] };
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      await expect(createNilveraInvoice(invalid)).rejects.toThrow();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('input validation: vatRate negatif → reject', async () => {
      const invalid = {
        ...validInvoiceInput,
        lines: [{ ...validInvoiceInput.lines[0], vatRate: -1 }],
      };
      await expect(createNilveraInvoice(invalid)).rejects.toThrow();
    });

    it('input validation: customer.taxNumber 10-11 hane dışı → reject', async () => {
      const invalid = {
        ...validInvoiceInput,
        customer: { ...validInvoiceInput.customer, taxNumber: '123' },
      };
      await expect(createNilveraInvoice(invalid)).rejects.toThrow();
    });

    it('response validation: UUID eksik → Zod throw', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        makeMockResponse(200, { InvoiceNumber: 'ABC2026000147' }),
      );

      await expect(createNilveraInvoice(validInvoiceInput)).rejects.toThrow();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // retrieveNilveraInvoice (GET /earchive/Invoices/{UUID}/Status)
  // ────────────────────────────────────────────────────────────────

  describe('retrieveNilveraInvoice', () => {
    it('durum bilgisini döner', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        makeMockResponse(200, { StatusCode: 'succeed', CancelStatus: false, ReportStatus: 'Reported' }),
      );

      const result = await retrieveNilveraInvoice('nv-ettn-uuid-123');

      expect(result.StatusCode).toBe('succeed');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://apitest.nilvera.com/earchive/Invoices/nv-ettn-uuid-123/Status',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('boş uuid → erken throw (fetch yok)', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      await expect(retrieveNilveraInvoice('')).rejects.toThrow(/zorunlu/);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('uuid encode edilir (özel karakter güvenliği)', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        makeMockResponse(200, { StatusCode: 'waiting' }),
      );

      await retrieveNilveraInvoice('nv/abc?evil');

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('nv%2Fabc%3Fevil');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // cancelNilveraInvoice (PUT /earchive/Invoices/{UUID}/Cancel)
  // ────────────────────────────────────────────────────────────────

  describe('cancelNilveraInvoice', () => {
    it('başarılı iptal → PUT + mesaj listesi döner', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        makeMockResponse(200, ['Fatura iptal edildi']),
      );

      const result = await cancelNilveraInvoice('nv-ettn-uuid-123');

      expect(result).toEqual(['Fatura iptal edildi']);
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://apitest.nilvera.com/earchive/Invoices/nv-ettn-uuid-123/Cancel',
        expect.objectContaining({ method: 'PUT' }),
      );
    });

    it('boş uuid → throw', async () => {
      await expect(cancelNilveraInvoice('')).rejects.toThrow(/zorunlu/);
    });
  });
});

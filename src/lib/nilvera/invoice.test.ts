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

const validInvoiceInput: NilveraInvoiceCreateRequest = {
  externalRef: 'sub_123_period_2026-05',
  invoiceDate: '2026-05-15T10:00:00Z',
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
      unitPrice: 625, // KDV hariç
      vatRate: 20,
    },
  ],
};

const validInvoiceResponse = {
  invoiceId: 'nv_abc123',
  invoiceNumber: 'PSP2026000147',
  externalRef: 'sub_123_period_2026-05',
  status: 'PENDING',
  pdfUrl: 'https://nilvera.com/invoices/nv_abc123.pdf',
  createdAt: '2026-05-15T10:00:00Z',
  totalAmount: 750,
  vatTotal: 125,
};

describe('nilvera invoice operations', () => {
  beforeEach(() => {
    vi.stubEnv('NILVERA_API_KEY', 'test-key');
    vi.stubEnv('NILVERA_SELLER_VKN', '1234567890');
    vi.stubEnv('NILVERA_BASE_URL', 'https://api.nilvera.com');
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
    it('başarılı POST → invoice response döner', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        makeMockResponse(200, validInvoiceResponse),
      );

      const result = await createNilveraInvoice(validInvoiceInput);

      expect(result.invoiceId).toBe('nv_abc123');
      expect(result.invoiceNumber).toBe('PSP2026000147');
      expect(result.status).toBe('PENDING');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.nilvera.com/api/v1/invoices',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('input validation: lines boş → Zod reject', async () => {
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

    it('response validation: status geçersiz enum → Zod throw', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        makeMockResponse(200, { ...validInvoiceResponse, status: 'INVALID_STATUS' }),
      );

      await expect(createNilveraInvoice(validInvoiceInput)).rejects.toThrow();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // retrieveNilveraInvoice
  // ────────────────────────────────────────────────────────────────

  describe('retrieveNilveraInvoice', () => {
    it('mevcut faturayı döner', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        makeMockResponse(200, { ...validInvoiceResponse, status: 'ACCEPTED' }),
      );

      const result = await retrieveNilveraInvoice('nv_abc123');

      expect(result.status).toBe('ACCEPTED');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.nilvera.com/api/v1/invoices/nv_abc123',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('boş invoiceId → erken throw (fetch yok)', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      await expect(retrieveNilveraInvoice('')).rejects.toThrow(/zorunlu/);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('invoiceId encode edilir (özel karakter güvenliği)', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        makeMockResponse(200, validInvoiceResponse),
      );

      await retrieveNilveraInvoice('nv/abc?evil');

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('nv%2Fabc%3Fevil');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // cancelNilveraInvoice
  // ────────────────────────────────────────────────────────────────

  describe('cancelNilveraInvoice', () => {
    it('başarılı iptal → status=CANCELLED', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        makeMockResponse(200, { ...validInvoiceResponse, status: 'CANCELLED' }),
      );

      const result = await cancelNilveraInvoice('nv_abc123', 'Yanlış müşteri bilgisi');

      expect(result.status).toBe('CANCELLED');
    });

    it('reason verilmediyse default kullanılır', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        makeMockResponse(200, { ...validInvoiceResponse, status: 'CANCELLED' }),
      );

      await cancelNilveraInvoice('nv_abc123');

      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.reason).toBe('Manual cancellation');
    });

    it('boş invoiceId → throw', async () => {
      await expect(cancelNilveraInvoice('')).rejects.toThrow(/zorunlu/);
    });
  });
});

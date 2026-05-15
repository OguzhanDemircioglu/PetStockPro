import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sendBrevoEmail, BrevoSendError } from './client';
import { _resetBrevoConfigCache } from './config';

describe('sendBrevoEmail', () => {
  beforeEach(() => {
    _resetBrevoConfigCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    _resetBrevoConfigCache();
  });

  describe('mock mode (no API key)', () => {
    it('configured değil + dev mode → console.log + ok=true mock=true', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('BREVO_API_KEY', '');
      _resetBrevoConfigCache();
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const result = await sendBrevoEmail({
        to: { email: 'test@x.com', name: 'Test' },
        subject: 'Test',
        htmlContent: '<p>Hello</p>',
        tags: ['test'],
      });

      expect(result.ok).toBe(true);
      expect(result.mock).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalled();
    });

    it('configured değil + production → throw', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('BREVO_API_KEY', '');
      _resetBrevoConfigCache();

      await expect(
        sendBrevoEmail({
          to: { email: 'test@x.com' },
          subject: 'Test',
          htmlContent: '<p>Hello</p>',
        }),
      ).rejects.toThrow(/BREVO_API_KEY.*zorunlu/);
    });
  });

  describe('real API mode (with key)', () => {
    beforeEach(() => {
      vi.stubEnv('BREVO_API_KEY', 'test-key');
      vi.stubEnv('BREVO_SENDER_EMAIL', 'info@petstockpro.com');
      vi.stubEnv('BREVO_SENDER_NAME', 'PetStockPro');
      _resetBrevoConfigCache();
    });

    it('başarılı POST → mock=false + messageId', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ messageId: '<abc@brevo>' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const result = await sendBrevoEmail({
        to: { email: 'test@x.com', name: 'Test' },
        subject: 'Welcome',
        htmlContent: '<p>Hi</p>',
        textContent: 'Hi',
        tags: ['welcome'],
      });

      expect(result.ok).toBe(true);
      expect(result.mock).toBe(false);
      expect(result.messageId).toBe('<abc@brevo>');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.brevo.com/v3/smtp/email',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('api-key header gönderilir', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('{}', { status: 201 }),
      );
      await sendBrevoEmail({
        to: { email: 'a@b.com' },
        subject: 'X',
        htmlContent: '<p>X</p>',
      });
      const init = fetchSpy.mock.calls[0][1] as RequestInit;
      const headers = init.headers as Record<string, string>;
      expect(headers['api-key']).toBe('test-key');
    });

    it('sender bilgisi config\'ten gelir', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('{}', { status: 201 }),
      );
      await sendBrevoEmail({
        to: { email: 'a@b.com' },
        subject: 'X',
        htmlContent: '<p>X</p>',
      });
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.sender).toEqual({ name: 'PetStockPro', email: 'info@petstockpro.com' });
    });

    it('API hatası (400) → BrevoSendError', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ code: 'invalid_to', message: 'Bad email' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await expect(
        sendBrevoEmail({
          to: { email: 'bad' },
          subject: 'X',
          htmlContent: '<p>X</p>',
        }),
      ).rejects.toBeInstanceOf(BrevoSendError);
    });

    it('BrevoSendError fields (status + responseBody)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ code: 'rate_limit' }), { status: 429 }),
      );

      try {
        await sendBrevoEmail({ to: { email: 'a@b.com' }, subject: 'X', htmlContent: '<p>X</p>' });
        expect.fail('throw etmedi');
      } catch (err) {
        expect(err).toBeInstanceOf(BrevoSendError);
        expect((err as BrevoSendError).status).toBe(429);
        expect((err as BrevoSendError).responseBody).toMatchObject({ code: 'rate_limit' });
      }
    });
  });
});

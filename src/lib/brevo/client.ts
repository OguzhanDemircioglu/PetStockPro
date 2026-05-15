/**
 * Brevo Transactional Email Client
 *
 * Production: Brevo REST API (https://api.brevo.com/v3/smtp/email)
 * Development/no-key: console.log mock fallback (geliştirici email içeriğini görür)
 *
 * Pattern Nilvera client ile aynı — fetch + structured errors + retry yok
 * (email gönderim retry'ı queue/cron işi, inline yapmıyoruz).
 */

import { getBrevoConfig, isBrevoConfigured } from './config';

export class BrevoSendError extends Error {
  readonly status: number;
  readonly responseBody: unknown;

  constructor(status: number, responseBody: unknown, message?: string) {
    super(message ?? `Brevo API HTTP ${status}`);
    this.name = 'BrevoSendError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

export interface BrevoEmailRequest {
  to: { email: string; name?: string };
  subject: string;
  htmlContent: string;
  textContent?: string; // text fallback (recommended for deliverability)
  tags?: string[];      // örn ['verify-email', 'tenant-onboarding']
}

export interface BrevoSendResult {
  ok: boolean;
  messageId?: string;
  mock?: boolean; // true = console.log fallback, false = real API
}

/**
 * Test'lerde fetch mock'lanır. Production'da gerçek API çağrısı.
 * isConfigured=false ise console.log mock + DB log (Sprint 2.3c'de
 * audit_logs'a send event yazılır).
 */
export async function sendBrevoEmail(req: BrevoEmailRequest): Promise<BrevoSendResult> {
  if (!isBrevoConfigured()) {
    // Mock mode — dev'de email içeriği console'a, prod'da kabul edilmez (config'ten throw)
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'BREVO_API_KEY production\'da zorunlu — env değişkenini ayarla',
      );
    }
    console.log(
      `[brevo:mock] To: ${req.to.email} | Subject: "${req.subject}" | Tags: ${req.tags?.join(',') ?? 'none'}`,
    );
    return { ok: true, mock: true };
  }

  const cfg = getBrevoConfig();

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': cfg.BREVO_API_KEY!,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: cfg.BREVO_SENDER_NAME, email: cfg.BREVO_SENDER_EMAIL },
      to: [req.to],
      subject: req.subject,
      htmlContent: req.htmlContent,
      textContent: req.textContent,
      tags: req.tags,
    }),
  });

  const text = await response.text();
  const body = text.length > 0 ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new BrevoSendError(response.status, body);
  }

  return {
    ok: true,
    messageId: (body as { messageId?: string } | null)?.messageId,
    mock: false,
  };
}

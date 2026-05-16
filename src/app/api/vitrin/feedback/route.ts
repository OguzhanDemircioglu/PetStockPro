/**
 * Vitrin WhatsApp feedback POST endpoint (Sprint 12 ext).
 *
 * Public — auth yok. Sticky balon komponentinden çağrılır.
 * Body: { companyId, status, rating?, branchId?, vitrinEventId? }
 * Anti-spam: helper içinde 1 IP × 1 tenant × 24h (status upgrade pattern).
 *
 * sendBeacon "dismissed" event'i için Content-Type: text/plain kabul edilir.
 */

import { db } from '@/lib/db/client';
import { submitFeedback } from '@/lib/vitrin/feedback';

export const runtime = 'nodejs';

function getIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return '0.0.0.0';
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    // sendBeacon Blob ile text/plain gönderebilir — content-type ne olursa olsun
    // JSON parse dene.
    const text = await req.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return Response.json(
      { ok: false, reason: 'invalid_json' },
      { status: 400 },
    );
  }

  const ip = getIp(req);
  const ua = req.headers.get('user-agent') ?? null;

  // Zod schema bütün geçersiz field'ları yakalar; cast OK.
  const result = await submitFeedback(
    body as Parameters<typeof submitFeedback>[0],
    {
      ipAddress: ip,
      userAgent: ua,
      countryCode: req.headers.get('cf-ipcountry') ?? null,
    },
    db,
  );

  if (result.ok) {
    return Response.json(result, { status: 200 });
  }

  const httpStatus: Record<string, number> = {
    invalid_input: 400,
    inconsistent: 400,
    rate_limit_24h: 429,
    unknown: 500,
  };
  return Response.json(result, {
    status: httpStatus[result.reason] ?? 400,
  });
}

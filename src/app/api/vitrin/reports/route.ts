/**
 * Vitrin şikayet POST endpoint (Sprint 12 ext).
 *
 * Public — auth yok. "🚩 Bildir" butonundan çağrılır.
 * Body: { companyId, targetType, productId?, reason, note? }
 */

import { db } from '@/lib/db/client';
import { submitReport } from '@/lib/vitrin/reports';

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
    const text = await req.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return Response.json(
      { ok: false, reason: 'invalid_json' },
      { status: 400 },
    );
  }

  const ip = getIp(req);
  const ua = req.headers.get('user-agent') ?? undefined;

  const result = await submitReport(
    body as Parameters<typeof submitReport>[0],
    {
      ipAddress: ip,
      userAgent: ua,
      countryCode: req.headers.get('cf-ipcountry') ?? undefined,
    },
    db,
  );

  if (result.ok) {
    return Response.json(result, { status: 200 });
  }

  const httpStatus: Record<string, number> = {
    invalid_input: 400,
    rate_limit_exceeded: 429,
    unknown: 500,
  };
  return Response.json(result, {
    status: httpStatus[result.reason] ?? 400,
  });
}

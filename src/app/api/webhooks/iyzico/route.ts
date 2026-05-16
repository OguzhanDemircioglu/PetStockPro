/**
 * POST /api/webhooks/iyzico — iyzico subscription webhook endpoint.
 *
 * Sprint 13 (signature + parse + idempotency key) + Sprint 14 (orchestrator).
 * iyzico Merchant Panel → Webhook → URL alanına bu endpoint girilir + secret oluşturulur.
 *
 * Flow:
 *   1. raw body + X-IYZ-SIGNATURE header oku
 *   2. verifyIyzicoSignature → invalid ise 401 (iyzico retry'a göndermez ama signature
 *      kontrolüne girer ki saldırgan rastgele payload gönderemez)
 *   3. parseIyzicoWebhookPayload → schema invalid ise 400 (iyzico'nun API'sinde değişiklik
 *      olmuş olabilir, manuel inceleme gerek)
 *   4. processIyzicoWebhookEvent → orchestrator (idempotency + DB + Nilvera + audit)
 *   5. Her zaman 200 OK döner (orchestration outcome'u response'a yansır ama HTTP'de
 *      gözükmez) — iyzico retry spam'ini önlemek için: bizim DB'mizdeki bug iyzico'yu
 *      sürekli retry'a sokmamalı. Outcome 'duplicate' veya 'subscription_not_found' bile
 *      olsa 200 OK döner; Sentry log ile takip ederiz.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  verifyIyzicoSignature,
  parseIyzicoWebhookPayload,
} from '@/lib/iyzico/webhook';
import { processIyzicoWebhookEvent } from '@/lib/billing/orchestrator';
import { createNilveraInvoice } from '@/lib/nilvera/invoice';
import { db } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // crypto.timingSafeEqual + postgres-js Node API

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const signature = req.headers.get('x-iyz-signature');

  // 1. Signature verify
  let valid: boolean;
  try {
    valid = verifyIyzicoSignature(rawBody, signature);
  } catch {
    // IYZICO_WEBHOOK_SECRET env yok — config hatası, retry boş yere olmasın
    return NextResponse.json({ error: 'webhook_secret_missing' }, { status: 500 });
  }
  if (!valid) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  // 2. Parse payload
  let payload;
  try {
    payload = parseIyzicoWebhookPayload(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  // 3. Orchestrate
  let outcome: string;
  try {
    const result = await processIyzicoWebhookEvent(payload, {
      db,
      nilvera: { createInvoice: createNilveraInvoice },
    });
    outcome = result.outcome;
  } catch (err) {
    // Beklenmedik exception: 500 değil 200 dön (iyzico retry spam'i engelle).
    // Audit yazılmamış olabilir, Sentry/Logflare manuel inspection için bayrak.
    console.error('[iyzico webhook] orchestration failed:', err);
    return NextResponse.json({ ok: false, error: 'orchestration_failed' }, { status: 200 });
  }

  // 4. 200 OK her zaman
  return NextResponse.json({ ok: true, outcome }, { status: 200 });
}

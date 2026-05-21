/**
 * /api/vitrin/track — Client-side vitrin event tracking endpoint.
 *
 * Tur 1 (P0-1 performance fix): Tracking server-side'dan client-side'a
 * taşındı. Bu sayede /vitrin/* sayfaları force-dynamic değil, Cloudflare
 * CDN cache aktive (revalidate + Cache-Control).
 *
 * Akış: client component (TrackPageView) mount sonrası POST eder.
 * Body: { companyId, eventType, branchId?, productId?, variantId?,
 * searchQuery?, utm? }. IP + UA server'da extract edilir (KVKK anonim).
 *
 * Fire-and-forget: client.fetch().catch() ile hata yutulur. Tracking
 * başarısızlığı UX'i bozmaz.
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { trackVitrinEvent, type VitrinEventType } from '@/lib/vitrin/track';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Tur 7 YT7-7 (2026-05-22): Basit in-memory rate-limit — IP başına 60 req/dk.
 * Worker single-instance memory; production'da Cloudflare KV / Durable Object
 * ile genişletilir (Sprint 14 deploy sonrası). Bot/spammer 1K rps spam
 * vektörünü ilk savunma katmanı kapatır.
 *
 * Sliding window basit: timestamp listesi tut, 60 sn'den eski olanları temizle.
 * Limit aşılırsa 429 döner — client `fetch().catch()` ile zaten sessiz yutar.
 */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = rateLimitMap.get(ip) ?? [];
  const recent = timestamps.filter((t) => t > cutoff);
  if (recent.length >= RATE_LIMIT_MAX) {
    return false;
  }
  recent.push(now);
  rateLimitMap.set(ip, recent);
  // Memory leak guard — eski IP'leri temizle (Map > 10K entry'de tut)
  if (rateLimitMap.size > 10_000) {
    for (const [k, ts] of rateLimitMap) {
      if (ts.length === 0 || ts[ts.length - 1] < cutoff) rateLimitMap.delete(k);
    }
  }
  return true;
}

const EVENT_TYPES = [
  'home_view',
  'profile_view',
  'product_view',
  'whatsapp_click',
  'phone_click',
  'telegram_click',
  'directions_click',
  'listing_impression',
  'search',
  'category_view',
  'feedback_balloon_shown',
  'feedback_submitted',
  'feedback_closed_manually',
  'feedback_dismissed',
] as const;

const bodySchema = z.object({
  companyId: z.string().uuid(),
  eventType: z.enum(EVENT_TYPES),
  branchId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),
  searchQuery: z.string().max(200).optional(),
  referrerUrl: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const hdrs = await headers();
  const xff = hdrs.get('x-forwarded-for') ?? hdrs.get('x-real-ip');
  const ip = xff ? xff.split(',')[0].trim() : undefined;
  const ua = hdrs.get('user-agent') ?? undefined;

  // Rate-limit: IP başına 60 req/dk (Tur 7 YT7-7)
  if (ip && !checkRateLimit(ip)) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  await trackVitrinEvent(
    {
      companyId: parsed.companyId,
      eventType: parsed.eventType as VitrinEventType,
      branchId: parsed.branchId,
      productId: parsed.productId,
      variantId: parsed.variantId,
      searchQuery: parsed.searchQuery,
      referrerUrl: parsed.referrerUrl,
      ipAddress: ip,
      userAgent: ua,
    },
    db,
  );

  return NextResponse.json({ ok: true });
}

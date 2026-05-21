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
  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const hdrs = await headers();
  const xff = hdrs.get('x-forwarded-for') ?? hdrs.get('x-real-ip');
  const ip = xff ? xff.split(',')[0].trim() : undefined;
  const ua = hdrs.get('user-agent') ?? undefined;

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

/**
 * Vitrin events tracking — KVKK uyumlu anonim analytics (Sprint 12).
 *
 * IP doğrudan saklanmaz; SHA256(IP + daily_salt) hash'lenir (1 gün rotation).
 * city/country MaxMind GeoLite2 ileride doldurulabilir; MVP'de NULL.
 *
 * Fire-and-forget: caller'ı bekletmez, hata sessizce yutulur.
 *
 * Event tipleri (vitrinEventTypeEnum):
 *   - home_view, profile_view, product_view, listing_impression,
 *     category_view, search, whatsapp_click, phone_click, telegram_click,
 *     directions_click, feedback_balloon_shown, feedback_submitted,
 *     feedback_closed_manually, feedback_dismissed
 */

import { createHash } from 'node:crypto';
import type { DbClient } from '@/lib/db/client';
import { vitrinEvents } from '@/db/schema';

export type VitrinEventType =
  | 'home_view'
  | 'profile_view'
  | 'product_view'
  | 'listing_impression'
  | 'category_view'
  | 'search'
  | 'whatsapp_click'
  | 'phone_click'
  | 'telegram_click'
  | 'directions_click'
  | 'feedback_balloon_shown'
  | 'feedback_submitted'
  | 'feedback_closed_manually'
  | 'feedback_dismissed';

export interface TrackVitrinEventInput {
  companyId: string;
  eventType: VitrinEventType;
  productId?: string | null;
  variantId?: string | null;
  branchId?: string | null;
  searchQuery?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  referrerUrl?: string | null;
}

/**
 * Günlük rotating salt — IP hash'i 1 gün sonra eşleştirilemez.
 *
 * Production'da `process.env.VITRIN_IP_HASH_SALT` ile prefix yapılır
 * (cross-day analytics istenirse).
 */
function dailySalt(now: Date = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  const baseSalt = process.env.VITRIN_IP_HASH_SALT ?? 'petstockpro-dev';
  return `${baseSalt}:${day}`;
}

function hashIp(ip: string, now: Date = new Date()): string {
  return createHash('sha256').update(`${dailySalt(now)}:${ip}`).digest('hex');
}

/**
 * Vitrin event kaydet — fire-and-forget. Hata caller'ı etkilemez.
 */
export function trackVitrinEventAsync(
  input: TrackVitrinEventInput,
  db: DbClient,
): void {
  void trackVitrinEvent(input, db).catch(() => {
    // Sessiz — production'da Sentry'ye gider
  });
}

/**
 * Vitrin event kaydet — async, hata atar. UI bekletmek istenirse kullanılır.
 */
export async function trackVitrinEvent(
  input: TrackVitrinEventInput,
  db: DbClient,
  now: Date = new Date(),
): Promise<{ ok: boolean }> {
  try {
    await db.insert(vitrinEvents).values({
      companyId: input.companyId,
      branchId: input.branchId ?? null,
      productId: input.productId ?? null,
      variantId: input.variantId ?? null,
      eventType: input.eventType,
      visitorIpHash: input.ipAddress ? hashIp(input.ipAddress, now) : null,
      userAgent: input.userAgent ?? null,
      referrerUrl: input.referrerUrl ?? null,
      searchQuery: input.searchQuery ?? null,
      visitorCityId: null, // GeoIP Faz 2
      visitorCountry: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      createdAt: now,
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

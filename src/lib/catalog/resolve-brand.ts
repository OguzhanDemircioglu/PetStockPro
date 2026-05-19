/**
 * Tenant brand resolver — autocomplete'ten gelen brand string'ini tenant'ın
 * `brands` tablosuna bağlar.
 *
 * Akış:
 *   1. Tenant'ta aynı isimde brand var mı (case-insensitive)? → id döner
 *   2. Yoksa yeni brand oluştur (slug otomatik) → yeni id döner + created=true
 *
 * Race condition: aynı brand iki request'te paralel oluşturulursa unique constraint
 * (idx_brands_company_slug) ikinci'yi reddeder. Caller bunu yakalayıp tekrar
 * lookup yapmalı veya transaction içine almalı.
 */

import { and, eq, sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { brands } from '@/db/schema';
import { makeSlug } from '@/lib/utils/slug';
import { checkBlacklist } from '@/lib/moderation/blacklist';

export interface ResolvedBrand {
  id: string;
  created: boolean;
  /** Küfür/uygunsuz içerik nedeniyle reject edildi (oluşturma yapılmadı). */
  rejected?: 'profanity' | 'too_long' | 'empty';
}

export async function resolveTenantBrand(
  companyId: string,
  brandName: string,
  db: DbClient,
): Promise<ResolvedBrand | null> {
  const trimmed = brandName.trim();
  if (!trimmed) return null;
  if (trimmed.length > 100) {
    return { id: '', created: false, rejected: 'too_long' };
  }

  // Küfür/uygunsuz içerik kontrolü (blacklist sync) — catalog auto-create
  // akışı kullanıcı UI'sından bağımsız çalıştığı için tespit edilen küfürlü
  // marka adlarını hiç oluşturmayız.
  const bl = checkBlacklist(trimmed);
  if (bl.matches.length > 0) {
    return { id: '', created: false, rejected: 'profanity' };
  }

  // 1. Mevcut brand var mı? (case-insensitive name match)
  const existing = await db
    .select({ id: brands.id })
    .from(brands)
    .where(
      and(
        eq(brands.companyId, companyId),
        sql`lower(${brands.name}) = lower(${trimmed})`,
      ),
    )
    .limit(1);
  if (existing.length > 0) {
    return { id: existing[0].id, created: false };
  }

  // 2. Yoksa oluştur
  const slug = makeSlug(trimmed).slice(0, 100);
  try {
    const [row] = await db
      .insert(brands)
      .values({
        companyId,
        name: trimmed,
        slug,
      })
      .returning({ id: brands.id });
    return { id: row.id, created: true };
  } catch (err) {
    // Race condition: paralel insert → unique violation
    // Tekrar lookup yap
    const retry = await db
      .select({ id: brands.id })
      .from(brands)
      .where(
        and(
          eq(brands.companyId, companyId),
          sql`lower(${brands.name}) = lower(${trimmed})`,
        ),
      )
      .limit(1);
    if (retry.length > 0) {
      return { id: retry[0].id, created: false };
    }
    throw err; // Beklenmeyen hata
  }
}

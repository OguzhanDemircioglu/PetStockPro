/**
 * Global brand resolver (Migration 0026, 2026-05-22)
 *
 * 2026-05-22: brands GLOBAL — bu helper sadece var olan brand'i lookup eder.
 * Eğer brand yoksa NULL döner (caller brand olmadan product oluşturur).
 * BAYI_SAHIBI yeni brand ekleyemez — sadece SUPERADMIN ekler (admin/brands UI).
 *
 * Akış:
 *   1. brandName'e göre var olan brand'i bul (case-insensitive)
 *   2. Yoksa NULL döner — caller handle eder
 */

import { sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { brands } from '@/db/schema';
import { checkBlacklist } from '@/lib/moderation/blacklist';

export interface ResolvedBrand {
  id: string;
  created: boolean;
  /** Küfür/uygunsuz içerik (caller brand olmadan oluştur). */
  rejected?: 'profanity' | 'too_long' | 'empty';
}

export async function resolveGlobalBrand(
  brandName: string,
  db: DbClient,
): Promise<ResolvedBrand | null> {
  const trimmed = brandName.trim();
  if (!trimmed) return null;
  if (trimmed.length > 100) {
    return { id: '', created: false, rejected: 'too_long' };
  }

  // Küfür/uygunsuz içerik kontrolü
  const bl = checkBlacklist(trimmed);
  if (bl.matches.length > 0) {
    return { id: '', created: false, rejected: 'profanity' };
  }

  // Mevcut global brand var mı? (case-insensitive name match)
  const existing = await db
    .select({ id: brands.id })
    .from(brands)
    .where(sql`lower(${brands.name}) = lower(${trimmed})`)
    .limit(1);
  if (existing.length > 0) {
    return { id: existing[0].id, created: false };
  }

  // Brand global listede yok — caller brand olmadan ürün oluştursun
  // (SUPERADMIN admin/brands UI'sından eklerse, sonra ürüne atanabilir).
  return null;
}

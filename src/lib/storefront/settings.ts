/**
 * Storefront settings — Sprint 12 partial (admin profil yönetimi)
 *
 * getStorefrontSettings: yoksa default empty döner (upsert pattern UI tarafında).
 * upsertStorefrontSettings: insert-or-update tek action.
 *
 * isEnabled toggle: false → vitrin'de görünmez (companies.storefrontStatus + bu birlikte kontrol).
 */

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { moderateFields } from '@/lib/moderation/check';
import type { ModerationFlagsResult } from '@/lib/moderation/redirect-suffix';
import type { TenantDb } from '@/lib/db/with-tenant';
import { companies, storefrontSettings } from '@/db/schema';

const phoneRegex = /^(\+90|0)?\s?(5\d{2})\s?\d{3}\s?\d{2}\s?\d{2}$/;
const usernameRegex = /^[A-Za-z0-9._-]{0,100}$/;

export const storefrontSettingsSchema = z.object({
  isEnabled: z.boolean().default(false),
  aboutContent: z
    .string()
    .max(2000, 'Hakkında en fazla 2000 karakter')
    .optional()
    .nullable()
    .transform((v) => (v === '' ? null : v ?? null)),
  contactPhone: z
    .string()
    .regex(phoneRegex, 'Telefon formatı: +90 5XX XXX XX XX')
    .optional()
    .nullable()
    .or(z.literal('').transform(() => null)),
  contactWhatsapp: z
    .string()
    .regex(phoneRegex, 'WhatsApp formatı: +90 5XX XXX XX XX')
    .optional()
    .nullable()
    .or(z.literal('').transform(() => null)),
  contactTelegram: z
    .string()
    .regex(usernameRegex, 'Telegram kullanıcı adı geçersiz')
    .optional()
    .nullable()
    .or(z.literal('').transform(() => null)),
  contactEmail: z
    .string()
    .email('Geçerli email gir')
    .optional()
    .nullable()
    .or(z.literal('').transform(() => null)),
  socialInstagram: z
    .string()
    .regex(usernameRegex, 'Instagram kullanıcı adı geçersiz')
    .optional()
    .nullable()
    .or(z.literal('').transform(() => null)),
  socialFacebook: z
    .string()
    .max(100)
    .optional()
    .nullable()
    .or(z.literal('').transform(() => null)),
  socialTwitter: z
    .string()
    .regex(usernameRegex, 'Twitter/X kullanıcı adı geçersiz')
    .optional()
    .nullable()
    .or(z.literal('').transform(() => null)),
  socialTiktok: z
    .string()
    .regex(usernameRegex, 'TikTok kullanıcı adı geçersiz')
    .optional()
    .nullable()
    .or(z.literal('').transform(() => null)),
  metaDescription: z
    .string()
    .max(300, 'SEO açıklaması en fazla 300 karakter')
    .optional()
    .nullable()
    .or(z.literal('').transform(() => null)),
});

export type StorefrontSettingsInput = z.input<typeof storefrontSettingsSchema>;

export interface StorefrontSettingsRow {
  companyId: string;
  isEnabled: boolean;
  aboutContent: string | null;
  contactPhone: string | null;
  contactWhatsapp: string | null;
  contactTelegram: string | null;
  contactEmail: string | null;
  socialInstagram: string | null;
  socialFacebook: string | null;
  socialTwitter: string | null;
  socialTiktok: string | null;
  metaDescription: string | null;
  updatedAt: Date;
}

export async function getStorefrontSettings(
  companyId: string,
  db: TenantDb,
): Promise<StorefrontSettingsRow | null> {
  const rows = await db
    .select()
    .from(storefrontSettings)
    .where(eq(storefrontSettings.companyId, companyId))
    .limit(1);
  return rows[0] ?? null;
}

export type UpsertResult =
  | { ok: true; moderationFlags?: ModerationFlagsResult }
  | { ok: false; reason: 'invalid_input'; issues: string[] }
  | { ok: false; reason: 'unknown' };

/**
 * Tek action ile upsert — yoksa INSERT, varsa UPDATE.
 * Drizzle ON CONFLICT companyId PK çakışması → set all fields.
 */
export async function upsertStorefrontSettings(
  companyId: string,
  input: StorefrontSettingsInput,
  db: TenantDb,
  now: Date = new Date(),
): Promise<UpsertResult> {
  const parsed = storefrontSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const data = parsed.data;

  try {
    await db
      .insert(storefrontSettings)
      .values({
        companyId,
        isEnabled: data.isEnabled,
        aboutContent: data.aboutContent ?? null,
        contactPhone: data.contactPhone ?? null,
        contactWhatsapp: data.contactWhatsapp ?? null,
        contactTelegram: data.contactTelegram ?? null,
        contactEmail: data.contactEmail ?? null,
        socialInstagram: data.socialInstagram ?? null,
        socialFacebook: data.socialFacebook ?? null,
        socialTwitter: data.socialTwitter ?? null,
        socialTiktok: data.socialTiktok ?? null,
        metaDescription: data.metaDescription ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: storefrontSettings.companyId,
        set: {
          isEnabled: data.isEnabled,
          aboutContent: data.aboutContent ?? null,
          contactPhone: data.contactPhone ?? null,
          contactWhatsapp: data.contactWhatsapp ?? null,
          contactTelegram: data.contactTelegram ?? null,
          contactEmail: data.contactEmail ?? null,
          socialInstagram: data.socialInstagram ?? null,
          socialFacebook: data.socialFacebook ?? null,
          socialTwitter: data.socialTwitter ?? null,
          socialTiktok: data.socialTiktok ?? null,
          metaDescription: data.metaDescription ?? null,
          updatedAt: now,
        },
      });

    // companies.storefrontStatus'u senkronize et (Sprint 12 — otomatik onay).
    // EKRAN-SUPERADMIN §2.5: rejected/auto_suspended manuel müdahale
    // gerektirir, otomatik bypass etmez — sadece disabled/pending/approved
    // arasında geçişi otomatize ediyoruz.
    const currentStatus = await db
      .select({ status: companies.storefrontStatus })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    const moderation = await moderateFields({
      ...(data.aboutContent ? { 'Hakkımızda metni': data.aboutContent } : {}),
      ...(data.metaDescription ? { 'Vitrin açıklaması (meta)': data.metaDescription } : {}),
    });
    const moderationFlags = moderation.flagged
      ? {
          moderationFlags: {
            flagged: true as const,
            fieldsFlagged: moderation.fieldsFlagged,
            reasons: moderation.reasons,
          },
        }
      : {};

    const status = currentStatus[0]?.status;
    if (status === 'rejected' || status === 'auto_suspended') {
      // Manuel onay bekleyen / askıya alınmış — kullanıcı toggle etse de
      // status değişmesin. UI banner'ı gösterilebilir (Faz 2).
      return { ok: true, ...moderationFlags };
    }
    await db
      .update(companies)
      .set({
        storefrontStatus: data.isEnabled ? 'approved' : 'disabled',
        updatedAt: now,
      })
      .where(eq(companies.id, companyId));
    return { ok: true, ...moderationFlags };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

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
import type { DbClient } from '@/lib/db/client';
import { storefrontSettings } from '@/db/schema';

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
  db: DbClient,
): Promise<StorefrontSettingsRow | null> {
  const rows = await db
    .select()
    .from(storefrontSettings)
    .where(eq(storefrontSettings.companyId, companyId))
    .limit(1);
  return rows[0] ?? null;
}

export type UpsertResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_input'; issues: string[] }
  | { ok: false; reason: 'unknown' };

/**
 * Tek action ile upsert — yoksa INSERT, varsa UPDATE.
 * Drizzle ON CONFLICT companyId PK çakışması → set all fields.
 */
export async function upsertStorefrontSettings(
  companyId: string,
  input: StorefrontSettingsInput,
  db: DbClient,
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
    return { ok: true };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

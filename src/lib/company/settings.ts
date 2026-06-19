/**
 * Company Settings — Sprint 10
 *
 * getCompanyProfile + updateCompanyProfile.
 *
 * Vat no eklenince Doğrula validation pass eder (Satışa Aç için zorunlu).
 * Bu yüzden bu form Doğrula gate'inin "Şirket bilgileri eksik" CTA'sından
 * yönlendirilen kritik akış.
 */

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { moderateFields } from '@/lib/moderation/check';
import type { ModerationFlagsResult } from '@/lib/moderation/redirect-suffix';
import type { TenantDb } from '@/lib/db/with-tenant';
import { companies } from '@/db/schema';
import { checkTaxpayer, type TaxpayerKind } from '@/lib/nilvera/lookup';

export interface CompanyProfile {
  id: string;
  name: string;
  slug: string;
  vatNo: string | null;
  vatRequiredAt: Date | null;
  /** Nilvera mükellef sorgusu sonucu: 'efatura' | 'earsiv' | 'invalid' | null (doğrulanmadı). */
  vatNoStatus: string | null;
  /** e-Fatura mükellefinin GİB'de kayıtlı resmi ünvanı. */
  vatNoTitle: string | null;
  vatNoVerifiedAt: Date | null;
  /** Fatura adresi (açık adres satırı). */
  billingAddress: string | null;
  whatsappPhone: string | null;
  cityId: number | null;
  districtId: string | null;
  storefrontStatus: 'disabled' | 'pending' | 'approved' | 'rejected' | 'auto_suspended';
  plan: 'FREE' | 'PRO' | 'PRO_PLUS';
  locationLat: string | null;
  locationLng: string | null;
}

export async function getCompanyProfile(
  companyId: string,
  db: TenantDb,
): Promise<CompanyProfile | null> {
  const rows = await db
    .select({
      id: companies.id,
      name: companies.name,
      slug: companies.slug,
      vatNo: companies.vatNo,
      vatRequiredAt: companies.vatRequiredAt,
      vatNoStatus: companies.vatNoStatus,
      vatNoTitle: companies.vatNoTitle,
      vatNoVerifiedAt: companies.vatNoVerifiedAt,
      billingAddress: companies.billingAddress,
      whatsappPhone: companies.whatsappPhone,
      cityId: companies.cityId,
      districtId: companies.districtId,
      storefrontStatus: companies.storefrontStatus,
      plan: companies.plan,
      locationLat: companies.locationLat,
      locationLng: companies.locationLng,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  return rows[0] ?? null;
}

export const companyProfileSchema = z.object({
  name: z.string().min(2, 'Firma adı en az 2 karakter').max(255),
  vatNo: z
    .string()
    .regex(/^\d{10,11}$/, 'VKN 10 hane veya TC 11 hane olmalı')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  whatsappPhone: z
    .string()
    .max(20)
    .regex(/^\+?\d{10,15}$/, 'Geçerli WhatsApp telefonu (+90... veya 0...)')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  billingAddress: z
    .string()
    .max(500, 'Fatura adresi en fazla 500 karakter')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  cityId: z
    .number()
    .int()
    .min(1)
    .max(81)
    .nullable()
    .optional(),
  districtId: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  // TR sınırları içi lat 35-43, lng 25-45. Browser geolocation veya
  // Google Maps'ten kopyala. Ondalık nokta, 7 hane precision.
  locationLat: z
    .union([
      z
        .number()
        .min(35, 'Enlem TR sınırı dışında')
        .max(43, 'Enlem TR sınırı dışında'),
      z
        .string()
        .regex(/^-?\d+(\.\d{1,7})?$/, 'Geçerli enlem (örn 41.0082)')
        .transform((v) => parseFloat(v))
        .refine((v) => v >= 35 && v <= 43, 'Enlem TR sınırı dışında'),
    ])
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  locationLng: z
    .union([
      z
        .number()
        .min(25, 'Boylam TR sınırı dışında')
        .max(45, 'Boylam TR sınırı dışında'),
      z
        .string()
        .regex(/^-?\d+(\.\d{1,7})?$/, 'Geçerli boylam (örn 28.9784)')
        .transform((v) => parseFloat(v))
        .refine((v) => v >= 25 && v <= 45, 'Boylam TR sınırı dışında'),
    ])
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
});

export type CompanyProfileInput = z.input<typeof companyProfileSchema>;

export type UpdateCompanyResult =
  | { ok: true; moderationFlags?: ModerationFlagsResult }
  | { ok: false; reason: 'invalid_input' | 'not_found' | 'unknown'; issues?: string[] };

export async function updateCompanyProfile(
  companyId: string,
  input: CompanyProfileInput,
  db: TenantDb,
  now: Date = new Date(),
): Promise<UpdateCompanyResult> {
  const parsed = companyProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const data = parsed.data;

  const existing = await db
    .select({ id: companies.id, vatNo: companies.vatNo })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (existing.length === 0) return { ok: false, reason: 'not_found' };

  // İlk kez vat_no ekleniyorsa vatRequiredAt'i de set et (Satışa Aç ile ilişki)
  const firstTimeVatNo =
    !existing[0].vatNo && data.vatNo !== null && data.vatNo !== undefined;

  // VKN değişirse önceki Nilvera doğrulaması geçersizleşir → status sıfırla (yeniden Doğrula gerek).
  const vatNoChanged = (data.vatNo ?? null) !== (existing[0].vatNo ?? null);

  try {
    await db
      .update(companies)
      .set({
        name: data.name,
        vatNo: data.vatNo ?? null,
        vatRequiredAt: firstTimeVatNo ? now : undefined,
        ...(vatNoChanged ? { vatNoStatus: null, vatNoTitle: null, vatNoVerifiedAt: null } : {}),
        billingAddress: data.billingAddress ?? null,
        whatsappPhone: data.whatsappPhone ?? null,
        cityId: data.cityId ?? null,
        districtId: data.districtId ?? null,
        locationLat:
          data.locationLat == null ? null : String(data.locationLat),
        locationLng:
          data.locationLng == null ? null : String(data.locationLng),
        updatedAt: now,
      })
      .where(eq(companies.id, companyId));
    const moderation = await moderateFields({ 'Pet shop adı': data.name });
    return {
      ok: true,
      ...(moderation.flagged
        ? {
            moderationFlags: {
              flagged: true,
              fieldsFlagged: moderation.fieldsFlagged,
              reasons: moderation.reasons,
            },
          }
        : {}),
    };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

export type VerifyVatNoResult =
  | { ok: true; kind: TaxpayerKind; title: string | null }
  | { ok: false; reason: 'empty' | 'network' };

/**
 * VKN/TCKN'yi Nilvera'da doğrula + sonucu (status/title/verifiedAt) kaydet.
 * "Doğrula" butonu çağırır. Geçerliyse vatNo'yu da kaydeder (atomik doğrula+kaydet).
 *
 *  - kind 'efatura' → e-Fatura mükellefi (resmi ünvan title'da)
 *  - kind 'earsiv'  → e-Fatura mükellefi değil (e-Arşiv ile faturalanır)
 *  - kind 'invalid' → geçersiz VKN/TCKN → vatNo KAYDEDİLMEZ (yalnız durum)
 *
 * Nilvera ağ hatası → { ok:false, reason:'network' } (kullanıcı sonra tekrar dener).
 */
export async function verifyAndSaveVatNo(
  companyId: string,
  vatNoRaw: string,
  db: TenantDb,
  opts: { checkTaxpayer?: typeof checkTaxpayer; now?: Date } = {},
): Promise<VerifyVatNoResult> {
  const check = opts.checkTaxpayer ?? checkTaxpayer;
  const now = opts.now ?? new Date();
  const vatNo = (vatNoRaw ?? '').replace(/\s+/g, '');
  if (!vatNo) return { ok: false, reason: 'empty' };

  let result;
  try {
    result = await check(vatNo);
  } catch {
    return { ok: false, reason: 'network' };
  }

  const existing = await db
    .select({ vatNo: companies.vatNo })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  const firstTimeVatNo = result.kind !== 'invalid' && !existing[0]?.vatNo;

  await db
    .update(companies)
    .set({
      vatNoStatus: result.kind,
      vatNoTitle: result.title,
      vatNoVerifiedAt: now,
      ...(result.kind !== 'invalid' ? { vatNo } : {}), // geçersizse vatNo'ya dokunma
      ...(firstTimeVatNo ? { vatRequiredAt: now } : {}),
      updatedAt: now,
    })
    .where(eq(companies.id, companyId));

  return { ok: true, kind: result.kind, title: result.title };
}

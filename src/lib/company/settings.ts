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
import type { DbClient } from '@/lib/db/client';
import { companies } from '@/db/schema';

export interface CompanyProfile {
  id: string;
  name: string;
  slug: string;
  vatNo: string | null;
  vatRequiredAt: Date | null;
  whatsappPhone: string | null;
  cityId: number | null;
  districtId: string | null;
  storefrontStatus: 'disabled' | 'pending' | 'approved' | 'rejected' | 'auto_suspended';
  plan: 'FREE' | 'PRO' | 'PRO_PLUS';
}

export async function getCompanyProfile(
  companyId: string,
  db: DbClient,
): Promise<CompanyProfile | null> {
  const rows = await db
    .select({
      id: companies.id,
      name: companies.name,
      slug: companies.slug,
      vatNo: companies.vatNo,
      vatRequiredAt: companies.vatRequiredAt,
      whatsappPhone: companies.whatsappPhone,
      cityId: companies.cityId,
      districtId: companies.districtId,
      storefrontStatus: companies.storefrontStatus,
      plan: companies.plan,
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
});

export type CompanyProfileInput = z.input<typeof companyProfileSchema>;

export type UpdateCompanyResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_input' | 'not_found' | 'unknown'; issues?: string[] };

export async function updateCompanyProfile(
  companyId: string,
  input: CompanyProfileInput,
  db: DbClient,
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

  try {
    await db
      .update(companies)
      .set({
        name: data.name,
        vatNo: data.vatNo ?? null,
        vatRequiredAt: firstTimeVatNo ? now : undefined,
        whatsappPhone: data.whatsappPhone ?? null,
        cityId: data.cityId ?? null,
        districtId: data.districtId ?? null,
        updatedAt: now,
      })
      .where(eq(companies.id, companyId));
    return { ok: true };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

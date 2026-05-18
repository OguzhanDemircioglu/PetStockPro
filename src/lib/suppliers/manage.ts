/**
 * Suppliers CRUD — Sprint 9
 *
 * listSuppliers + addSupplier + updateSupplier + setSupplierActive.
 *
 * Pattern: branches/manage.ts.
 *
 * VKN: 10 hane (kurumsal) veya TC 11 hane (şahıs).
 * paymentTerms enum: 'cash' / 'net_30' / 'net_60' / 'other'.
 * Soft delete (isActive=false) — stok hareketleri korunur.
 */

import { and, asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { moderateFields } from '@/lib/moderation/check';
import type { ModerationFlagsResult } from '@/lib/moderation/redirect-suffix';
import type { DbClient } from '@/lib/db/client';
import { suppliers, stockMovements } from '@/db/schema';

// ─────────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────────

export interface SupplierListItem {
  id: string;
  name: string;
  vatNo: string | null;
  vatOffice: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  district: string | null;
  leadTimeDays: number;
  paymentTerms: 'cash' | 'net_30' | 'net_60' | 'other';
  iban: string | null;
  isActive: boolean;
  totalIncomingQty: number;
  createdAt: Date;
}

export async function listSuppliers(
  companyId: string,
  db: DbClient,
): Promise<SupplierListItem[]> {
  return db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      vatNo: suppliers.vatNo,
      vatOffice: suppliers.vatOffice,
      contactName: suppliers.contactName,
      phone: suppliers.phone,
      email: suppliers.email,
      city: suppliers.city,
      district: suppliers.district,
      leadTimeDays: suppliers.leadTimeDays,
      paymentTerms: suppliers.paymentTerms,
      iban: suppliers.iban,
      isActive: suppliers.isActive,
      createdAt: suppliers.createdAt,
      totalIncomingQty: sql<number>`(
        SELECT COALESCE(SUM(${stockMovements.quantity}), 0)::int
        FROM ${stockMovements}
        WHERE ${stockMovements.supplierId} = ${suppliers.id}
          AND ${stockMovements.type} = 'stock_in'
          AND ${stockMovements.reversedById} IS NULL
      )`,
    })
    .from(suppliers)
    .where(eq(suppliers.companyId, companyId))
    .orderBy(asc(suppliers.name));
}

export async function getSupplierDetail(
  companyId: string,
  supplierId: string,
  db: DbClient,
): Promise<SupplierListItem | null> {
  const rows = await listSuppliers(companyId, db);
  return rows.find((s) => s.id === supplierId) ?? null;
}

// ─────────────────────────────────────────────────────────────────
// CREATE + UPDATE schema
// ─────────────────────────────────────────────────────────────────

export const supplierSchema = z.object({
  name: z.string().min(2, 'Ad en az 2 karakter').max(255),
  vatNo: z
    .string()
    .regex(/^\d{10,11}$/, 'VKN 10 veya TC 11 hane olmalı')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  vatOffice: z.string().max(100).nullable().optional()
    .or(z.literal('').transform(() => null)),
  contactName: z.string().max(100).nullable().optional()
    .or(z.literal('').transform(() => null)),
  phone: z
    .string()
    .max(20)
    .regex(/^\+?\d{10,15}$/, 'Geçerli telefon (+90... veya 0...)')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  email: z.string().email('Geçerli email').max(255).nullable().optional()
    .or(z.literal('').transform(() => null)),
  city: z.string().max(100).nullable().optional()
    .or(z.literal('').transform(() => null)),
  district: z.string().max(100).nullable().optional()
    .or(z.literal('').transform(() => null)),
  leadTimeDays: z.number().int().min(0).max(365).default(7),
  paymentTerms: z.enum(['cash', 'net_30', 'net_60', 'other']).default('net_30'),
  iban: z
    .string()
    .regex(/^TR\d{24}$/, 'IBAN "TR" + 24 hane formatında olmalı')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  note: z.string().max(1000).nullable().optional()
    .or(z.literal('').transform(() => null)),
});

export type SupplierInput = z.input<typeof supplierSchema>;

// ─────────────────────────────────────────────────────────────────
// ADD
// ─────────────────────────────────────────────────────────────────

export type AddSupplierResult =
  | { ok: true; supplierId: string; moderationFlags?: ModerationFlagsResult }
  | { ok: false; reason: 'invalid_input' | 'unknown'; issues?: string[] };

export async function addSupplier(
  companyId: string,
  input: SupplierInput,
  db: DbClient,
): Promise<AddSupplierResult> {
  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const data = parsed.data;

  try {
    const [row] = await db
      .insert(suppliers)
      .values({
        companyId,
        name: data.name,
        vatNo: data.vatNo ?? null,
        vatOffice: data.vatOffice ?? null,
        contactName: data.contactName ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        city: data.city ?? null,
        district: data.district ?? null,
        leadTimeDays: data.leadTimeDays,
        paymentTerms: data.paymentTerms,
        iban: data.iban ?? null,
        note: data.note ?? null,
        isActive: true,
      })
      .returning({ id: suppliers.id });
    const moderation = await moderateFields({
      'Tedarikçi adı': data.name,
      ...(data.contactName ? { 'İletişim kişisi': data.contactName } : {}),
      ...(data.note ? { 'Tedarikçi notu': data.note } : {}),
    });
    return {
      ok: true,
      supplierId: row.id,
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

// ─────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────

export type UpdateSupplierResult =
  | { ok: true; moderationFlags?: ModerationFlagsResult }
  | {
      ok: false;
      reason: 'invalid_input' | 'not_found' | 'unknown';
      issues?: string[];
    };

export async function updateSupplier(
  companyId: string,
  supplierId: string,
  input: SupplierInput,
  db: DbClient,
): Promise<UpdateSupplierResult> {
  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid_input',
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const data = parsed.data;

  const existing = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(
      and(eq(suppliers.id, supplierId), eq(suppliers.companyId, companyId)),
    )
    .limit(1);
  if (existing.length === 0) return { ok: false, reason: 'not_found' };

  try {
    await db
      .update(suppliers)
      .set({
        name: data.name,
        vatNo: data.vatNo ?? null,
        vatOffice: data.vatOffice ?? null,
        contactName: data.contactName ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        city: data.city ?? null,
        district: data.district ?? null,
        leadTimeDays: data.leadTimeDays,
        paymentTerms: data.paymentTerms,
        iban: data.iban ?? null,
        note: data.note ?? null,
      })
      .where(eq(suppliers.id, supplierId));
    const moderation = await moderateFields({
      'Tedarikçi adı': data.name,
      ...(data.contactName ? { 'İletişim kişisi': data.contactName } : {}),
      ...(data.note ? { 'Tedarikçi notu': data.note } : {}),
    });
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

// ─────────────────────────────────────────────────────────────────
// SET ACTIVE
// ─────────────────────────────────────────────────────────────────

export type SetSupplierActiveResult =
  | { ok: true; isActive: boolean }
  | { ok: false; reason: 'not_found' | 'unknown' };

export async function setSupplierActive(
  companyId: string,
  supplierId: string,
  active: boolean,
  db: DbClient,
): Promise<SetSupplierActiveResult> {
  const existing = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(
      and(eq(suppliers.id, supplierId), eq(suppliers.companyId, companyId)),
    )
    .limit(1);
  if (existing.length === 0) return { ok: false, reason: 'not_found' };

  try {
    await db
      .update(suppliers)
      .set({ isActive: active })
      .where(eq(suppliers.id, supplierId));
    return { ok: true, isActive: active };
  } catch {
    return { ok: false, reason: 'unknown' };
  }
}

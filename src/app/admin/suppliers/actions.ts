'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import {
  addSupplier,
  updateSupplier,
  setSupplierActive,
  type SupplierInput,
} from '@/lib/suppliers/manage';
import { writeAuditLogAsync } from '@/lib/audit/log';

export interface SupplierActionState {
  ok: boolean;
  message: string | null;
  issues: string[];
  supplierId: string | null;
}

const EMPTY: SupplierActionState = {
  ok: false,
  message: null,
  issues: [],
  supplierId: null,
};

function asStr(v: FormDataEntryValue | null): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function parseFormInput(formData: FormData): SupplierInput | null {
  const name = asStr(formData.get('name'));
  if (!name) return null;

  const leadTimeRaw = asStr(formData.get('leadTimeDays'));
  const leadTimeDays = leadTimeRaw ? parseInt(leadTimeRaw, 10) : 7;
  const paymentTerms =
    (asStr(formData.get('paymentTerms')) as
      | 'cash'
      | 'net_30'
      | 'net_60'
      | 'other'
      | null) ?? 'net_30';

  return {
    name,
    vatNo: asStr(formData.get('vatNo')),
    vatOffice: asStr(formData.get('vatOffice')),
    contactName: asStr(formData.get('contactName')),
    phone: asStr(formData.get('phone')),
    email: asStr(formData.get('email')),
    city: asStr(formData.get('city')),
    district: asStr(formData.get('district')),
    leadTimeDays: Number.isFinite(leadTimeDays) ? leadTimeDays : 7,
    paymentTerms,
    iban: asStr(formData.get('iban')),
    note: asStr(formData.get('note')),
  };
}

const REASON_MSG: Record<string, string> = {
  invalid_input: 'Geçersiz alan',
  not_found: 'Tedarikçi bulunamadı',
  unknown: 'Kaydedilemedi, tekrar dene',
};

export async function addSupplierAction(
  _prev: SupplierActionState | null,
  formData: FormData,
): Promise<SupplierActionState> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) redirect('/login' as never);

  const input = parseFormInput(formData);
  if (!input) return { ...EMPTY, message: 'Tedarikçi adı zorunlu' };

  const result = await addSupplier(session.user.companyId, input, db);
  if (!result.ok) {
    return {
      ...EMPTY,
      message: REASON_MSG[result.reason] ?? 'Hata',
      issues: result.issues ?? [],
    };
  }

  writeAuditLogAsync(
    {
      companyId: session.user.companyId,
      userId: session.user.id,
      action: 'supplier.created',
      entityType: 'supplier',
      entityId: result.supplierId,
      afterState: { name: input.name, vatNo: input.vatNo },
    },
    db,
  );

  revalidatePath('/admin/suppliers');
  redirect('/admin/suppliers?created=success' as never);
}

export async function updateSupplierAction(
  supplierId: string,
  _prev: SupplierActionState | null,
  formData: FormData,
): Promise<SupplierActionState> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) redirect('/login' as never);

  const input = parseFormInput(formData);
  if (!input) {
    return { ...EMPTY, supplierId, message: 'Tedarikçi adı zorunlu' };
  }

  const result = await updateSupplier(
    session.user.companyId,
    supplierId,
    input,
    db,
  );
  if (!result.ok) {
    return {
      ...EMPTY,
      supplierId,
      message: REASON_MSG[result.reason] ?? 'Hata',
      issues: result.issues ?? [],
    };
  }

  writeAuditLogAsync(
    {
      companyId: session.user.companyId,
      userId: session.user.id,
      action: 'supplier.updated',
      entityType: 'supplier',
      entityId: supplierId,
      afterState: { name: input.name },
    },
    db,
  );

  revalidatePath('/admin/suppliers');
  redirect('/admin/suppliers?updated=success' as never);
}

export async function toggleSupplierActiveAction(
  supplierId: string,
  active: boolean,
): Promise<SupplierActionState> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) redirect('/login' as never);

  const result = await setSupplierActive(
    session.user.companyId,
    supplierId,
    active,
    db,
  );
  if (!result.ok) {
    return {
      ...EMPTY,
      supplierId,
      message: REASON_MSG[result.reason] ?? 'Hata',
    };
  }

  writeAuditLogAsync(
    {
      companyId: session.user.companyId,
      userId: session.user.id,
      action: active ? 'supplier.activated' : 'supplier.deactivated',
      entityType: 'supplier',
      entityId: supplierId,
    },
    db,
  );

  revalidatePath('/admin/suppliers');
  revalidatePath('/admin/stock-movements');
  return {
    ok: true,
    supplierId,
    message: active ? 'Tedarikçi aktif' : 'Tedarikçi pasifleştirildi',
    issues: [],
  };
}

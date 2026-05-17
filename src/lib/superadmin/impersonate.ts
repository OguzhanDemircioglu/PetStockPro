/**
 * Süperadmin Tenant Impersonation
 *
 * "Şu tenant'a gir, onun gibi davran" akışı:
 * - SUPERADMIN bir tenant seçer → `pp-impersonate-tenant` cookie'sine company_id yazılır.
 * - /admin/layout.tsx cookie'yi kontrol eder, varsa session.companyId yerine cookie'den
 *   gelen company_id kullanılır (sadece SUPERADMIN için — non-superadmin'in cookie'si
 *   olsa bile yok sayılır).
 * - Sticky banner her admin sayfasının üstünde görünür ("🎭 X Pet Shop olarak görüyorsun").
 * - Çıkış → cookie silinir, süperadmin tenant listesine redirect.
 *
 * Audit: started/stopped event'leri stock_movements yerine audit_logs'a yazılır
 * (entity_type='company', actor=süperadmin email).
 */

import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/client';
import { companies } from '@/db/schema';
import { writeAuditLogAsync } from '@/lib/audit/log';

const COOKIE_NAME = 'pp-impersonate-tenant';
// 8 saat: bir mesai vardiyası. SUPERADMIN unutursa otomatik düşer.
const COOKIE_MAX_AGE = 60 * 60 * 8;

export interface ImpersonationContext {
  companyId: string;
  companyName: string;
  /** Süperadmin'in kendi user id'si — banner'a yansır. */
  impersonatorUserId: string;
  impersonatorEmail: string;
}

/**
 * Cookie'den aktif impersonation'ı okur.
 * companyId valid ise döner; aksi halde null (cookie silinir).
 *
 * Sadece session.role === 'SUPERADMIN' için anlamlı — caller bunu kontrol etmeli.
 */
export async function readImpersonation(
  superadminUserId: string,
  superadminEmail: string,
): Promise<ImpersonationContext | null> {
  const cookieStore = await cookies();
  const companyId = cookieStore.get(COOKIE_NAME)?.value;
  if (!companyId) return null;

  // Validate company exists.
  const [row] = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (!row) return null;

  return {
    companyId: row.id,
    companyName: row.name,
    impersonatorUserId: superadminUserId,
    impersonatorEmail: superadminEmail,
  };
}

/**
 * Cookie'yi set eder. Sadece SUPERADMIN çağırmalı (server action gate).
 * Audit log entry yazar.
 */
export async function setImpersonationCookie(
  companyId: string,
  superadminUserId: string,
  superadminEmail: string,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, companyId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
  // Audit: superadmin.impersonate.started
  writeAuditLogAsync(
    {
      companyId, // Hedef tenant
      userId: superadminUserId,
      action: 'superadmin.impersonate.started',
      entityType: 'company',
      entityId: companyId,
      performedAsSuperadmin: true,
      afterState: { impersonatorEmail: superadminEmail },
    },
    db,
  );
}

/**
 * Cookie'yi siler. Audit log entry yazar.
 */
export async function clearImpersonationCookie(
  superadminUserId: string,
  superadminEmail: string,
): Promise<void> {
  const cookieStore = await cookies();
  const previousCompanyId = cookieStore.get(COOKIE_NAME)?.value;
  cookieStore.delete(COOKIE_NAME);
  if (previousCompanyId) {
    writeAuditLogAsync(
      {
        companyId: previousCompanyId,
        userId: superadminUserId,
        action: 'superadmin.impersonate.stopped',
        entityType: 'company',
        entityId: previousCompanyId,
        performedAsSuperadmin: true,
        afterState: { impersonatorEmail: superadminEmail },
      },
      db,
    );
  }
}

export { COOKIE_NAME as IMPERSONATE_COOKIE_NAME };

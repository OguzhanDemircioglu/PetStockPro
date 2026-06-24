/**
 * Fatura müşteri bilgisi (CustomerInfo) kurucu — orchestrator + invoice-reconcile paylaşır.
 *
 * Şirket (pet shop = alıcı) satırını Nilvera fatura müşteri girdisine çevirir.
 * cityId/districtId FK'leri il/ilçe ADINA join'lenir (eski '—' placeholder yerine
 * gerçek adres). billingAddress açık adres satırıdır; boşsa invoice.ts orPlaceholder
 * "Belirtilmemiş" kullanır. vatNo null → nihai tüketici (router halleder).
 *
 * email: tenant sahibinin (BAYI_SAHIBI) e-postası — Nilvera CustomerInfo.Mail'e konur,
 * e-Arşiv faturayı alıcıya OTOMATİK e-postalar. Yoksa null → Mail alanı eklenmez.
 */

import { eq, sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { companies, cities, districts, users } from '@/db/schema';
import type { IssueInvoiceInput } from '@/lib/nilvera/invoice';

/**
 * Fatura alıcısı (BAYI_SAHIBI) e-postası — korelasyonlu subquery.
 * leftJoin YERİNE subquery: dış sorguda satır ÇOĞALTMAZ (reconcile tüm pending faturayı
 * tek select'te çeker; join birden çok sahipte faturayı 2× işlerdi). Sahip yoksa null.
 */
export const billingOwnerEmailSql = sql<string | null>`(
  select ${users.email} from ${users}
  where ${users.companyId} = ${companies.id}
    and ${users.role} = 'BAYI_SAHIBI'
  order by ${users.createdAt}
  limit 1
)`;

export interface CompanyInvoiceRow {
  name: string;
  vatNo: string | null;
  billingAddress: string | null;
  cityName: string | null;
  districtName: string | null;
  /** Tenant sahibinin e-postası → Nilvera CustomerInfo.Mail (alıcıya otomatik teslim). */
  email: string | null;
}

/** Şirket satırından Nilvera fatura müşteri (CustomerInfo) bilgisi kur. */
export function buildInvoiceCustomer(row: CompanyInvoiceRow): IssueInvoiceInput['customer'] {
  return {
    taxNumber: row.vatNo, // null → nihai tüketici (resolveAndIssueInvoice halleder)
    title: row.name,
    address: row.billingAddress ?? undefined,
    city: row.cityName ?? undefined,
    district: row.districtName ?? undefined,
    email: row.email ?? undefined, // varsa Nilvera faturayı bu adrese e-postalar
  };
}

/** companyId → fatura müşteri bilgisi (il/ilçe adı join). Şirket yoksa null. */
export async function loadInvoiceCustomer(
  db: DbClient,
  companyId: string,
): Promise<IssueInvoiceInput['customer'] | null> {
  const rows = await db
    .select({
      name: companies.name,
      vatNo: companies.vatNo,
      billingAddress: companies.billingAddress,
      cityName: cities.name,
      districtName: districts.name,
      email: billingOwnerEmailSql,
    })
    .from(companies)
    .leftJoin(cities, eq(cities.id, companies.cityId))
    .leftJoin(districts, eq(districts.id, companies.districtId))
    .where(eq(companies.id, companyId))
    .limit(1);
  const c = rows[0];
  if (!c) return null;
  return buildInvoiceCustomer(c);
}

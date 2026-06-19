/**
 * Fatura müşteri bilgisi (CustomerInfo) kurucu — orchestrator + invoice-reconcile paylaşır.
 *
 * Şirket (pet shop = alıcı) satırını Nilvera fatura müşteri girdisine çevirir.
 * cityId/districtId FK'leri il/ilçe ADINA join'lenir (eski '—' placeholder yerine
 * gerçek adres). billingAddress açık adres satırıdır; boşsa invoice.ts orPlaceholder
 * "Belirtilmemiş" kullanır. vatNo null → nihai tüketici (router halleder).
 */

import { eq } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { companies, cities, districts } from '@/db/schema';
import type { IssueInvoiceInput } from '@/lib/nilvera/invoice';

export interface CompanyInvoiceRow {
  name: string;
  vatNo: string | null;
  billingAddress: string | null;
  cityName: string | null;
  districtName: string | null;
}

/** Şirket satırından Nilvera fatura müşteri (CustomerInfo) bilgisi kur. */
export function buildInvoiceCustomer(row: CompanyInvoiceRow): IssueInvoiceInput['customer'] {
  return {
    taxNumber: row.vatNo, // null → nihai tüketici (resolveAndIssueInvoice halleder)
    title: row.name,
    address: row.billingAddress ?? undefined,
    city: row.cityName ?? undefined,
    district: row.districtName ?? undefined,
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

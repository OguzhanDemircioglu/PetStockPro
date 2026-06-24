'use server';

import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { invoices, companies, subscriptions, cities, districts } from '@/db/schema';
import { requireSuperadmin } from '@/lib/superadmin/access';
import { getNilveraConfig } from '@/lib/nilvera/config';
import { getNilveraSellerCompany } from '@/lib/nilvera/lookup';
import { resolveAndIssueInvoice } from '@/lib/nilvera/invoice';
import { buildInvoiceCustomer, billingOwnerEmailSql } from '@/lib/billing/invoice-customer';
import { SUBSCRIPTION_VAT_RATE } from '@/lib/billing/totals';

export interface NilveraTestResult {
  ok: boolean;
  baseUrl: string;
  /** NILVERA_SERIE env tanımlı mı (e-Arşiv/e-Fatura serisi — yoksa fatura kesilemez). */
  serieSet: boolean;
  /** NILVERA_SELLER_VKN env tanımlı mı. */
  sellerVknSet: boolean;
  /** /general/Company'den dönen satıcı (bizim) hesap profili. */
  account?: {
    name: string | null;
    taxNumber: string | null;
    taxOffice: string | null;
    city: string | null;
    isActive: boolean | null;
  };
  error?: string;
}

/**
 * "Nilvera Bağlantı Testi" — canlı anahtarla GET /general/Company çağırıp
 * satıcı hesabımızın bilgisini gösterir. Anahtarı paylaşmadan canlı kurulumu doğrular.
 */
export async function testNilveraConnectionAction(): Promise<NilveraTestResult> {
  await requireSuperadmin();

  let baseUrl = process.env.NILVERA_BASE_URL || 'https://api.nilvera.com';
  let serieSet = !!process.env.NILVERA_SERIE;
  let sellerVknSet = !!process.env.NILVERA_SELLER_VKN;

  try {
    const cfg = getNilveraConfig();
    baseUrl = cfg.NILVERA_BASE_URL;
    serieSet = !!cfg.NILVERA_SERIE;
    sellerVknSet = !!cfg.NILVERA_SELLER_VKN;
  } catch (e) {
    return {
      ok: false,
      baseUrl,
      serieSet,
      sellerVknSet,
      error: `Config geçersiz: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  try {
    const acc = await getNilveraSellerCompany();
    return {
      ok: true,
      baseUrl,
      serieSet,
      sellerVknSet,
      account: {
        name: acc.Name ?? null,
        taxNumber: acc.TaxNumber ?? null,
        taxOffice: acc.TaxOffice ?? null,
        city: acc.City ?? null,
        isActive: acc.IsActive ?? null,
      },
    };
  } catch (err) {
    return {
      ok: false,
      baseUrl,
      serieSet,
      sellerVknSet,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface InvoiceRetryResult {
  ok: boolean;
  /** Bizim invoice.id. */
  invoiceId?: string;
  /** Nilvera ETTN UUID (başarıda). */
  nilveraId?: string;
  invoiceNumber?: string | null;
  kind?: 'efatura' | 'earsiv';
  /** Hata detayı (Nilvera'nın tam 400 gövdesi dahil) veya bilgi mesajı. */
  message?: string;
}

/**
 * "Bekleyen faturayı yeniden dene" — en son status='pending' faturayı bulup
 * resolveAndIssueInvoice ile yeniden keser. Başarıda issued + Nilvera ref yazar;
 * hatada Nilvera'nın TAM mesajını (NilveraApiError artık gövdeyi içerir) döndürür.
 * Ödeme zaten alınmış, fatura yasal olarak borçlu — yeni tahsilat YOK.
 */
export async function retryPendingInvoiceAction(): Promise<InvoiceRetryResult> {
  await requireSuperadmin();

  const rows = await db
    .select({
      id: invoices.id,
      amountMatrah: invoices.amountMatrah,
      plan: subscriptions.plan,
      name: companies.name,
      vatNo: companies.vatNo,
      billingAddress: companies.billingAddress,
      cityName: cities.name,
      districtName: districts.name,
      email: billingOwnerEmailSql,
    })
    .from(invoices)
    .innerJoin(companies, eq(companies.id, invoices.companyId))
    .innerJoin(subscriptions, eq(subscriptions.id, invoices.subscriptionId))
    .leftJoin(cities, eq(cities.id, companies.cityId))
    .leftJoin(districts, eq(districts.id, companies.districtId))
    .where(eq(invoices.status, 'pending'))
    .orderBy(desc(invoices.createdAt))
    .limit(1);

  const inv = rows[0];
  if (!inv) return { ok: false, message: 'Bekleyen (pending) fatura yok.' };

  const now = new Date();
  try {
    const resp = await resolveAndIssueInvoice({
      externalRef: inv.id,
      invoiceDate: now.toISOString(),
      customer: buildInvoiceCustomer({
        name: inv.name,
        vatNo: inv.vatNo,
        billingAddress: inv.billingAddress,
        cityName: inv.cityName,
        districtName: inv.districtName,
        email: inv.email,
      }),
      lines: [
        {
          name: `PetStockPro ${inv.plan} planı (aylık abonelik)`,
          quantity: 1,
          unitPrice: Number(inv.amountMatrah),
          vatRate: SUBSCRIPTION_VAT_RATE,
        },
      ],
      currency: 'TRY',
    });

    await db
      .update(invoices)
      .set({
        status: 'issued',
        nilveraInvoiceId: resp.invoiceId,
        nilveraInvoiceNumber: resp.invoiceNumber ?? null,
        invoiceKind: resp.kind,
        issuedAt: now,
        lastNilveraError: null,
        updatedAt: now,
      })
      .where(eq(invoices.id, inv.id));

    return {
      ok: true,
      invoiceId: inv.id,
      nilveraId: resp.invoiceId,
      invoiceNumber: resp.invoiceNumber ?? null,
      kind: resp.kind,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(invoices)
      .set({ lastNilveraError: msg.slice(0, 500), updatedAt: now })
      .where(eq(invoices.id, inv.id));
    return { ok: false, invoiceId: inv.id, message: msg };
  }
}

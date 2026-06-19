import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { withTenant } from '@/lib/db/with-tenant';
import { getCompanyProfile } from '@/lib/company/settings';
import { getCurrentSubscription, listInvoices } from '@/lib/billing/billing-view';
import { PLAN_LABELS, PLAN_LIMITS } from '@/lib/constants/plan-limits';
import { SettingsShell } from '@/components/settings-shell';
import { BillingCheckout } from './billing-checkout';
import { SubscriptionActions } from './subscription-actions';

export const dynamic = 'force-dynamic';

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ paytr?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);
  const companyId = session.user.companyId;
  const sp = await searchParams;

  const [profile, sub, invoiceList] = await withTenant(companyId, (tx) =>
    Promise.all([
      getCompanyProfile(companyId, tx),
      getCurrentSubscription(companyId, tx),
      listInvoices(companyId, tx),
    ]),
  );
  if (!profile) notFound();
  const plan = profile.plan as 'FREE' | 'PRO' | 'PRO_PLUS';
  // 'incomplete' = yarım kalmış/terk edilmiş checkout — aktif abonelik DEĞİL.
  // Yükseltme UI'ını bloklamamalı; startPaytrCheckout yeni denemede eski incomplete'i siler.
  const blockingSub = sub && sub.status !== 'incomplete' ? sub : null;
  const showUpgrade = plan === 'FREE' && !blockingSub;

  return (
    <SettingsShell current="billing" title="Abonelik" description={`Mevcut plan: ${PLAN_LABELS[plan]}`}>
      <div className="flex max-w-2xl flex-col gap-6">
        {sp.paytr === 'ok' && (
          <div
            role="status"
            className="rounded-xl border border-cat/30 bg-cat-soft px-4 py-3 text-sm font-medium text-cart"
          >
            ✓ Ödemen alındı. Planın birkaç saniye içinde güncellenecek (sayfayı yenile).
          </div>
        )}
        {sp.paytr === 'fail' && (
          <div
            role="alert"
            className="rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger-7"
          >
            Ödeme tamamlanmadı. Tekrar deneyebilirsin.
          </div>
        )}

        {/* Mevcut plan */}
        <section className="rounded-2xl border border-line bg-paper p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink-4">Mevcut plan</div>
              <div className="text-2xl font-bold text-cart">{PLAN_LABELS[plan]}</div>
            </div>
            <div className="text-right text-sm text-ink-3">
              {plan === 'FREE'
                ? '0 ₺'
                : `${PLAN_LIMITS[plan].priceMonthlyTry.toLocaleString('tr-TR')} ₺/ay`}
            </div>
          </div>

          {blockingSub && (
            <div className="mt-3 flex flex-col gap-1 border-t border-line pt-3 text-sm" data-testid="sub-status">
              {blockingSub.status === 'active' && (
                <p className="font-medium text-cart">✓ Aktif · sonraki yenileme {fmtDate(blockingSub.currentPeriodEnd)}</p>
              )}
              {blockingSub.status === 'past_due' && (
                <p className="font-medium text-danger-7">
                  ⚠ Son ödeme alınamadı ({blockingSub.paymentRetryCount}. deneme). Kartını güncellemen gerekebilir.
                </p>
              )}
              {blockingSub.cancelAtPeriodEnd && (
                <p className="font-medium text-danger-7" data-testid="cancel-scheduled">
                  ⚠ İptal edildi · {fmtDate(blockingSub.currentPeriodEnd)} tarihinde sona erecek.
                </p>
              )}
              {blockingSub.cardMasked && (
                <p className="text-ink-3">
                  {(blockingSub.cardBrand ?? 'Kart').toUpperCase()} · {blockingSub.cardMasked}
                </p>
              )}
            </div>
          )}
          {sub?.status === 'incomplete' && !blockingSub && (
            <p className="mt-3 border-t border-line pt-3 text-sm text-ink-3" data-testid="sub-status">
              ⏳ Önceki ödeme yarım kaldı — aşağıdan tekrar başlatabilirsin.
            </p>
          )}
        </section>

        {/* Yükselt (yalnız FREE) */}
        {showUpgrade && (
          <section>
            <h2 className="mb-3 text-sm font-bold text-cart">Planını yükselt</h2>
            <BillingCheckout />
          </section>
        )}

        {blockingSub && (blockingSub.status === 'active' || blockingSub.status === 'past_due') && blockingSub.plan !== 'FREE' && (
          <SubscriptionActions
            cancelScheduled={blockingSub.cancelAtPeriodEnd}
            currentPlan={blockingSub.plan}
            pendingPlan={blockingSub.pendingPlan === 'PRO' || blockingSub.pendingPlan === 'PRO_PLUS' ? blockingSub.pendingPlan : null}
            periodEndLabel={fmtDate(blockingSub.currentPeriodEnd)}
          />
        )}

        {!profile.vatNo && (
          <div className="rounded-xl border border-line bg-paper px-4 py-3 text-xs text-ink-2">
            ℹ Faturalandırma için VKN/TCKN gerekli. Ödeme yine de çalışır; faturanın kesilmesi için{' '}
            <strong>Firma</strong> ayarlarından vergi numaranı ekle.
          </div>
        )}

        {/* Faturalar */}
        {invoiceList.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-bold text-cart">Faturalar</h2>
            <div className="overflow-hidden rounded-xl border border-line">
              <table className="w-full text-sm">
                <thead className="bg-paper text-left text-[11px] uppercase tracking-wider text-ink-4">
                  <tr>
                    <th className="px-3 py-2 font-bold">Dönem</th>
                    <th className="px-3 py-2 font-bold">Tutar</th>
                    <th className="px-3 py-2 font-bold">Durum</th>
                    <th className="px-3 py-2 font-bold">Fatura</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceList.map((inv) => (
                    <tr key={inv.id} className="border-t border-line">
                      <td className="px-3 py-2 text-ink-2">{fmtDate(inv.periodStart)}</td>
                      <td className="px-3 py-2 text-ink-2">
                        {Number(inv.amountTotal).toLocaleString('tr-TR')} ₺
                      </td>
                      <td className="px-3 py-2 text-ink-3">{inv.status}</td>
                      <td className="px-3 py-2">
                        {inv.pdfUrl ? (
                          <a href={inv.pdfUrl} target="_blank" rel="noreferrer" className="text-cat underline">
                            indir
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </SettingsShell>
  );
}

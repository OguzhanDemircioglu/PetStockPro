/**
 * Billing kullanıcı e-postaları (Brevo) — dunning + downgrade (I1).
 *
 * Fire-and-forget: build + sendBrevoEmail + hata yutulur. Caller (orchestrator
 * post-tx / renewals cron) await etmeden çağırır; email başarısızlığı akışı bozmaz.
 */

import { sendBrevoEmail } from '@/lib/brevo/client';
import {
  buildDunningEmailTemplate,
  buildPlanDowngradedEmailTemplate,
} from '@/lib/brevo/templates';

function billingUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return `${base}/admin/settings/billing`;
}

/** Yenileme ödemesi başarısız → "kartını güncelle" (dunning). */
export function sendDunningEmail(input: { to: string; companyName: string; retryCount: number }): void {
  const t = buildDunningEmailTemplate({
    companyName: input.companyName,
    retryCount: input.retryCount,
    manageUrl: billingUrl(),
  });
  void sendBrevoEmail({
    to: { email: input.to },
    subject: t.subject,
    htmlContent: t.htmlContent,
    textContent: t.textContent,
    tags: ['billing-dunning'],
  }).catch(() => {});
}

/** Abonelik sona erdi → FREE plan + (varsa) vitrin'den çekilen ürün bilgisi. */
export function sendPlanDowngradedEmail(input: {
  to: string;
  companyName: string;
  unpublishedCount: number;
}): void {
  const t = buildPlanDowngradedEmailTemplate({
    companyName: input.companyName,
    unpublishedCount: input.unpublishedCount,
    manageUrl: billingUrl(),
  });
  void sendBrevoEmail({
    to: { email: input.to },
    subject: t.subject,
    htmlContent: t.htmlContent,
    textContent: t.textContent,
    tags: ['billing-downgrade'],
  }).catch(() => {});
}

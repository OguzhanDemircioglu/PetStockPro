/**
 * Billing alert'leri — ödeme akışı anomalilerinde süperadmin Telegram bildirimi.
 *
 * Tasarım: pure builder (test edilebilir) + fire-and-forget wrapper (hata yutulur).
 * Wrapper'lar ASLA throw etmez → alert başarısızlığı ödeme/fatura akışını bozmaz.
 * Caller'lar `await` etmeden çağırabilir (orchestrator tx DIŞINDA, renewals/cron içinde).
 *
 * sendTelegramAlert: env-based süperadmin bot (config yoksa dev'de console mock,
 * production'da throw → burada .catch ile yutulur). Bkz. telegram/client.ts.
 */

import { sendTelegramAlert, type TelegramSendRequest } from '@/lib/telegram/client';

function clip(s: string, n = 200): string {
  return s.slice(0, n).replace(/[<>]/g, '');
}

// ── Ödeme anomalisi (owner yok / tutar uyuşmuyor / abonelik yok) ──────────────

export type PaymentAnomalyKind = 'owner_missing' | 'amount_mismatch' | 'subscription_not_found';

export interface PaymentAnomalyInput {
  kind: PaymentAnomalyKind;
  merchantOid: string;
  companyId?: string;
  subscriptionId?: string;
  detail?: string;
}

const ANOMALY_HEADLINE: Record<PaymentAnomalyKind, string> = {
  owner_missing: '🚨 <b>Ödeme alındı ama tenant sahibi (BAYI_SAHIBI) yok</b>',
  amount_mismatch: '🚨 <b>Ödeme tutarı uyuşmuyor (manipülasyon şüphesi)</b>',
  subscription_not_found: '⚠ <b>Callback geldi ama abonelik bulunamadı</b>',
};

export function buildPaymentAnomalyAlert(input: PaymentAnomalyInput): TelegramSendRequest {
  const critical = input.kind !== 'subscription_not_found';
  const footer =
    input.kind === 'amount_mismatch'
      ? '<i>Tahsilat reddedildi. Para PayTR\'da çekildiyse PayTR panelinden iade gerekebilir.</i>'
      : input.kind === 'owner_missing'
        ? '<i>Ödeme yine de uygulandı (plan + fatura). Tenant sahibi rolünü incele.</i>'
        : '<i>İlgili abonelik kaydı bulunamadı — incele.</i>';

  return {
    text: [
      ANOMALY_HEADLINE[input.kind],
      '',
      `<b>merchant_oid:</b> <code>${clip(input.merchantOid, 80)}</code>`,
      input.companyId ? `<b>Tenant:</b> <code>${input.companyId}</code>` : '',
      input.subscriptionId ? `<b>Abonelik:</b> <code>${input.subscriptionId}</code>` : '',
      input.detail ? `<b>Detay:</b> <code>${clip(input.detail)}</code>` : '',
      '',
      footer,
    ]
      .filter(Boolean)
      .join('\n'),
    parseMode: 'HTML',
    severity: critical ? 'critical' : 'warning',
    disableNotification: false,
  };
}

// ── Nilvera fatura kesilemedi (para alındı, yasal fatura yok) ──────────────────

export interface InvoiceFailedInput {
  invoiceId: string;
  companyId: string;
  retryCount: number;
  error: string;
}

export function buildInvoiceFailedAlert(input: InvoiceFailedInput): TelegramSendRequest {
  return {
    text: [
      '🧾 <b>Fatura kesilemedi (Nilvera) — para alındı</b>',
      '',
      `<b>Fatura:</b> <code>${input.invoiceId}</code>`,
      `<b>Tenant:</b> <code>${input.companyId}</code>`,
      `<b>Deneme:</b> ${input.retryCount}`,
      `<b>Hata:</b> <code>${clip(input.error)}</code>`,
      '',
      '<i>Yasal fatura zorunlu. VKN/Nilvera ayarını kontrol et — mutabakat cron yeniden deneyecek.</i>',
    ].join('\n'),
    parseMode: 'HTML',
    severity: 'critical',
    disableNotification: false,
  };
}

// ── Dunning (yenileme başarısız / retry tükendi) ──────────────────────────────

export interface DunningInput {
  companyId: string;
  subscriptionId: string;
  retryCount: number;
  /** true = retry'lar bitti, abonelik FREE'ye düşecek. */
  exhausted: boolean;
}

export function buildDunningAlert(input: DunningInput): TelegramSendRequest {
  return {
    text: [
      input.exhausted
        ? '🔻 <b>Abonelik ödemesi başarısız — retry tükendi (FREE\'ye düşecek)</b>'
        : '⚠ <b>Abonelik yenileme başarısız (dunning)</b>',
      '',
      `<b>Tenant:</b> <code>${input.companyId}</code>`,
      `<b>Abonelik:</b> <code>${input.subscriptionId}</code>`,
      `<b>Deneme:</b> ${input.retryCount}`,
    ].join('\n'),
    parseMode: 'HTML',
    severity: input.exhausted ? 'critical' : 'warning',
    disableNotification: false,
  };
}

// ── Fire-and-forget wrapper'lar (hata yutulur, asla throw etmez) ───────────────

export function alertPaymentAnomaly(input: PaymentAnomalyInput): void {
  void sendTelegramAlert(buildPaymentAnomalyAlert(input)).catch(() => {});
}

export function alertInvoiceFailed(input: InvoiceFailedInput): void {
  void sendTelegramAlert(buildInvoiceFailedAlert(input)).catch(() => {});
}

export function alertDunning(input: DunningInput): void {
  void sendTelegramAlert(buildDunningAlert(input)).catch(() => {});
}

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PLAN_LABELS } from '@/lib/constants/plan-limits';
import { swalConfirm, swalToast } from '@/lib/ui/swal';
import { PaytrIframeModal } from './paytr-iframe-modal';
import {
  cancelSubscriptionAction,
  reactivateSubscriptionAction,
  schedulePlanChangeAction,
  cancelScheduledPlanChangeAction,
  previewUpgradeNowAction,
  upgradeNowAction,
  startUpgradeCheckoutAction,
} from './actions';

interface Props {
  cancelScheduled: boolean;
  currentPlan: 'PRO' | 'PRO_PLUS';
  /** Dönem sonunda geçilecek plan (H2). null = bekleyen değişiklik yok. */
  pendingPlan: 'PRO' | 'PRO_PLUS' | null;
  /** Dönem bitiş tarihi (lokalize) — "X tarihinde geçecek" için. */
  periodEndLabel: string;
}

export function SubscriptionActions({ cancelScheduled, currentPlan, pendingPlan, periodEndLabel }: Props) {
  const [pending, startTransition] = useTransition();
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const router = useRouter();

  const otherPlan: 'PRO' | 'PRO_PLUS' = currentPlan === 'PRO' ? 'PRO_PLUS' : 'PRO';
  const isUpgrade = otherPlan === 'PRO_PLUS';

  /** Action'ı çalıştır; hatayı sağ üst SWAL toast ile göster (2026-05-20: banner YOK). */
  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else await swalToast(res.error ?? 'İşlem başarısız.', undefined, 'error');
    });
  }

  function doCancel() {
    startTransition(async () => {
      const ok = await swalConfirm(
        'Aboneliği iptal et?',
        'Dönem sonuna kadar aktif kalır, sonra FREE plana düşersin.',
        'Evet, iptal et',
        'Vazgeç',
      );
      if (!ok) return;
      const res = await cancelSubscriptionAction();
      if (res.ok) router.refresh();
      else await swalToast(res.error ?? 'İşlem başarısız.', undefined, 'error');
    });
  }

  /** Upgrade (PRO→PRO+): önce prorated tutarı önizle, sonra onaylayınca kartı ANINDA çek. */
  function doUpgradeNow() {
    startTransition(async () => {
      const preview = await previewUpgradeNowAction(otherPlan);
      if (!preview.ok) {
        await swalToast(preview.error ?? 'İşlem yapılamadı.', undefined, 'error');
        return;
      }
      const amount = (preview.proratedAmount ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 });
      const confirmed = await swalConfirm(
        `${PLAN_LABELS[otherPlan]} planına hemen yükselt`,
        `${PLAN_LABELS[currentPlan]} → ${PLAN_LABELS[otherPlan]} farkı olan ${amount} ₺ hemen tahsil edilecek ve planın anında ${PLAN_LABELS[otherPlan]} olacak. Sonraki yenilemede (~${preview.daysRemaining} gün sonra) tam ${PLAN_LABELS[otherPlan]} ücreti alınır.`,
        'Evet, yükselt',
        'Vazgeç',
        'question',
      );
      if (!confirmed) return;

      // 1) Saklı kart varsa: prorated farkı anında çek + planı uygula.
      const res = await upgradeNowAction(otherPlan);
      if (res.ok) {
        await swalToast('Planın yükseltildi 🎉', undefined, 'success');
        router.refresh();
        return;
      }
      // 2) Saklı kart YOKSA: kart formunu (PayTR iframe) aç — prorated fark iframe'de tahsil edilir.
      if (res.reason === 'no_saved_card') {
        const checkout = await startUpgradeCheckoutAction(otherPlan);
        if (checkout.applied) {
          await swalToast('Planın yükseltildi 🎉', undefined, 'success');
          router.refresh();
        } else if (checkout.ok && checkout.iframeUrl) {
          setIframeUrl(checkout.iframeUrl);
        } else {
          await swalToast(checkout.error ?? 'İşlem başarısız.', undefined, 'error');
        }
        return;
      }
      // 3) Diğer hatalar: sade toast.
      await swalToast(res.error ?? 'İşlem başarısız.', undefined, 'error');
    });
  }

  return (
    <div className="flex flex-col items-start gap-3">
      {/* Plan değişimi (dönem sonu, proration yok) — iptal planlanmadıysa göster */}
      {!cancelScheduled &&
        (pendingPlan ? (
          <div
            data-testid="plan-change-scheduled"
            className="flex flex-col items-start gap-1.5 rounded-xl border border-cat/30 bg-cat-soft px-4 py-3 text-sm text-cart"
          >
            <span>
              📅 <strong>{periodEndLabel}</strong> tarihinde <strong>{PLAN_LABELS[pendingPlan]}</strong>{' '}
              planına geçilecek. Yeni ücret o tarihte tahsil edilir.
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(cancelScheduledPlanChangeAction)}
              data-testid="cancel-plan-change"
              className="text-[13px] font-bold text-cart underline underline-offset-2 hover:no-underline disabled:opacity-50"
            >
              {pending ? '…' : 'Değişikliği iptal et'}
            </button>
          </div>
        ) : isUpgrade ? (
          <button
            type="button"
            disabled={pending}
            onClick={doUpgradeNow}
            data-testid="upgrade-now"
            className="inline-flex items-center rounded-xl bg-cat px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? '…' : `${PLAN_LABELS[otherPlan]} planına hemen yükselt`}
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => schedulePlanChangeAction(otherPlan))}
            data-testid="change-plan"
            className="inline-flex items-center rounded-xl border border-line px-4 py-2 text-sm font-bold text-cart transition hover:border-cat hover:bg-cat-soft disabled:opacity-50"
          >
            {pending ? '…' : `${PLAN_LABELS[otherPlan]} planına geç (dönem sonunda)`}
          </button>
        ))}

      {/* Abonelik iptal / sürdür */}
      {cancelScheduled ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(reactivateSubscriptionAction)}
          data-testid="reactivate-sub"
          className="inline-flex items-center rounded-xl bg-cat px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? '…' : 'Aboneliği sürdür'}
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={doCancel}
          data-testid="cancel-sub"
          className="text-sm text-danger-7 underline underline-offset-2 hover:no-underline disabled:opacity-50"
        >
          {pending ? '…' : 'Aboneliği iptal et'}
        </button>
      )}

      {/* Saklı kart yokken yükseltme: PayTR kart formu (prorated fark) */}
      {iframeUrl && <PaytrIframeModal iframeUrl={iframeUrl} onClose={() => setIframeUrl(null)} />}
    </div>
  );
}

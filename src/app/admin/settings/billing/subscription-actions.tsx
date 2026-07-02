'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PLAN_LABELS } from '@/lib/constants/plan-limits';
import {
  cancelSubscriptionAction,
  reactivateSubscriptionAction,
  schedulePlanChangeAction,
  cancelScheduledPlanChangeAction,
  previewUpgradeNowAction,
  upgradeNowAction,
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
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const otherPlan: 'PRO' | 'PRO_PLUS' = currentPlan === 'PRO' ? 'PRO_PLUS' : 'PRO';
  const isUpgrade = otherPlan === 'PRO_PLUS';

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error ?? 'İşlem başarısız.');
    });
  }

  function doCancel() {
    if (
      !window.confirm(
        'Aboneliğini iptal etmek istediğine emin misin? Dönem sonuna kadar aktif kalır, sonra FREE plana düşersin.',
      )
    )
      return;
    run(cancelSubscriptionAction);
  }

  /** Upgrade (PRO→PRO+): önce prorated tutarı önizle, sonra onaylayınca kartı ANINDA çek. */
  function doUpgradeNow() {
    setError(null);
    startTransition(async () => {
      const preview = await previewUpgradeNowAction(otherPlan);
      if (!preview.ok) {
        setError(preview.error ?? 'İşlem yapılamadı.');
        return;
      }
      const amount = (preview.proratedAmount ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 });
      const confirmed = window.confirm(
        `Kalan ${preview.daysRemaining} gün için ${amount} ₺ kayıtlı kartından hemen çekilecek ve ${PLAN_LABELS[otherPlan]} planına şimdi geçeceksin. Onaylıyor musun?`,
      );
      if (!confirmed) return;
      const res = await upgradeNowAction(otherPlan);
      if (res.ok) router.refresh();
      else setError(res.error ?? 'İşlem başarısız.');
    });
  }

  return (
    <div className="flex flex-col items-start gap-3">
      {error && (
        <p role="alert" data-testid="manage-error" className="text-sm text-danger-7">
          ⚠ {error}
        </p>
      )}

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
    </div>
  );
}

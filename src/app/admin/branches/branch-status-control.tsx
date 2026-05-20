'use client';

/**
 * Faz 4 (2026-05-21) — 3-state şube kontrolü.
 *
 * Liste kartında: kompakt buton grubu (3 buton: 🟢 / 🟡 / ⚫).
 * Edit sayfasında: tam genişlik radio group (RadioRow varyant).
 *
 * Aktif → pasif transition'ında native confirm() ile çift onay (kullanıcı
 * verisi koruması). Tatilde geçişi sessiz (esnek).
 */

import { useState, useTransition } from 'react';
import { setBranchStatusAction } from './actions';
import {
  BRANCH_STATUS_VALUES,
  BRANCH_STATUS_EMOJI,
  BRANCH_STATUS_LABELS,
  type BranchStatus,
} from '@/lib/branches/status';

interface Props {
  branchId: string;
  currentStatus: BranchStatus;
  variant?: 'buttons' | 'radio';
}

const ACTIVE_CLS: Record<BranchStatus, string> = {
  active: 'bg-arrow text-white',
  holiday: 'bg-cat text-white',
  inactive: 'bg-ink-2 text-white',
};

export function BranchStatusControl({
  branchId,
  currentStatus,
  variant = 'buttons',
}: Props) {
  const [status, setStatus] = useState<BranchStatus>(currentStatus);
  const [pending, startTransition] = useTransition();
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const handleChange = (next: BranchStatus) => {
    if (next === status || pending) return;

    if (next === 'inactive') {
      const confirmed = confirm(
        '🚫 Şubeyi PASİFLEŞTİR?\n\n' +
          '• Vitrin\'den tamamen çekilir.\n' +
          '• Bu şube üzerinden TÜM aksiyonlar kilitli olur.\n' +
          '• Atanmış kullanıcılar sadece okuyabilir.\n' +
          '• Stok kayıtları korunur (kayıp YOK).\n\n' +
          'Devam etmek istiyor musun?',
      );
      if (!confirmed) return;
    } else if (next === 'holiday') {
      // Tatilde geçişi sessiz — esnek. Vitrin tarafında rozet görünür,
      // admin operasyonu (sayım, transfer) devam edebilir.
    }

    setErrMsg(null);
    setOkMsg(null);
    startTransition(async () => {
      const result = await setBranchStatusAction(branchId, next);
      if (result.ok) {
        setStatus(next);
        setOkMsg(result.message ?? 'Güncellendi');
        setTimeout(() => setOkMsg(null), 2500);
      } else {
        setErrMsg(result.message ?? 'Güncellenemedi');
      }
    });
  };

  if (variant === 'radio') {
    return (
      <div className="flex flex-col gap-2" data-testid="branch-status-control-radio">
        <div className="grid gap-2 sm:grid-cols-3">
          {BRANCH_STATUS_VALUES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleChange(s)}
              disabled={pending}
              data-testid={`status-radio-${s}`}
              aria-pressed={status === s}
              className={`rounded-xl border-2 px-3 py-3 text-left text-sm font-bold transition-all disabled:opacity-50 ${
                status === s
                  ? `${ACTIVE_CLS[s]} border-transparent shadow-md`
                  : 'border-line bg-paper text-ink hover:border-cat/40 hover:bg-cat-soft/30'
              }`}
            >
              <div className="text-lg leading-none">{BRANCH_STATUS_EMOJI[s]}</div>
              <div className="mt-1">{BRANCH_STATUS_LABELS[s]}</div>
              <div className="mt-1 text-[11px] font-normal opacity-80">
                {s === 'active' && 'Vitrin görünür, tüm aksiyonlar açık'}
                {s === 'holiday' && 'Vitrin "🏖", WhatsApp disabled, admin açık'}
                {s === 'inactive' && 'Vitrin çekilir, admin read-only'}
              </div>
            </button>
          ))}
        </div>
        {okMsg && (
          <div className="text-[12px] font-bold text-arrow-7" data-testid="status-ok">
            ✓ {okMsg}
          </div>
        )}
        {errMsg && (
          <div className="text-[12px] font-bold text-danger-7" data-testid="status-err">
            ✕ {errMsg}
          </div>
        )}
      </div>
    );
  }

  // variant === 'buttons' — kompakt buton grubu (liste kartı için)
  return (
    <div className="flex flex-col items-end gap-1" data-testid="branch-status-control-buttons">
      <div className="inline-flex overflow-hidden rounded border border-line">
        {BRANCH_STATUS_VALUES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => handleChange(s)}
            disabled={pending}
            title={BRANCH_STATUS_LABELS[s]}
            data-testid={`status-quick-${s}`}
            aria-pressed={status === s}
            className={`px-2 py-1 text-[14px] leading-none transition-colors disabled:opacity-50 ${
              status === s
                ? `${ACTIVE_CLS[s]}`
                : 'bg-paper text-ink-3 hover:bg-line-soft'
            }`}
          >
            {BRANCH_STATUS_EMOJI[s]}
          </button>
        ))}
      </div>
      {okMsg && (
        <span className="text-[10.5px] font-bold text-arrow-7" data-testid="status-ok">
          ✓
        </span>
      )}
      {errMsg && (
        <span
          className="rounded bg-danger-soft px-1.5 py-0.5 text-[10.5px] font-bold text-danger-7"
          title={errMsg}
          data-testid="status-err"
        >
          ✕ {errMsg.slice(0, 30)}
        </span>
      )}
    </div>
  );
}

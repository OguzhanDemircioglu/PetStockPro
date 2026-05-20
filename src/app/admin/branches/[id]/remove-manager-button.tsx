'use client';

import { useState, useTransition } from 'react';
import { removeBranchManagerAction } from '../actions';

interface Props {
  branchId: string;
  managerEmail: string;
}

/**
 * "Müdürü kaldır" butonu — BAYI_SAHIBI yetkisi server-side enforce.
 * Sadece kullanıcının branchId'sini NULL yapar; rol SUBE_MUDURU olarak korunur.
 */
export function RemoveManagerButton({ branchId, managerEmail }: Props) {
  const [pending, startTransition] = useTransition();
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const handleClick = () => {
    const confirmed = confirm(
      `Şubenin müdürlüğü kaldırılacak: ${managerEmail}\n\n` +
        '• Kullanıcı tenant\'a bağlı kalır.\n' +
        '• Rolü "Şube Müdürü" olarak korunur (atanmamış).\n' +
        '• Başka şubeye atanması için Kullanıcılar listesinden rol/şube güncelleyin.',
    );
    if (!confirmed) return;
    setErrMsg(null);
    setOkMsg(null);
    startTransition(async () => {
      const result = await removeBranchManagerAction(branchId);
      if (result.ok) {
        setOkMsg(result.message ?? 'Müdür kaldırıldı');
      } else {
        setErrMsg(result.message ?? 'Müdür kaldırılamadı');
      }
    });
  };

  if (okMsg) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-arrow-soft px-3 py-1 text-[12px] font-bold text-arrow-7"
        data-testid="manager-removed-banner"
      >
        ✓ {okMsg}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        data-testid="remove-manager-button"
        className="rounded-lg border border-danger-soft bg-paper px-3 py-1.5 text-[12px] font-bold text-danger-7 transition-colors hover:bg-danger-soft disabled:opacity-50"
      >
        {pending ? '...' : '✕ Müdürü kaldır'}
      </button>
      {errMsg && (
        <span
          className="rounded bg-danger-soft px-2 py-0.5 text-[11.5px] font-bold text-danger-7"
          role="alert"
        >
          {errMsg}
        </span>
      )}
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { toggleSupplierActiveAction } from './actions';

interface Props {
  supplierId: string;
  currentlyActive: boolean;
}

export function ToggleSupplierActive({ supplierId, currentlyActive }: Props) {
  const [active, setActive] = useState(currentlyActive);
  const [pending, startTransition] = useTransition();
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const toggle = () => {
    setErrMsg(null);
    startTransition(async () => {
      const result = await toggleSupplierActiveAction(supplierId, !active);
      if (result.ok) {
        setActive(!active);
      } else if (result.message) {
        setErrMsg(result.message);
      }
    });
  };

  if (errMsg) {
    return (
      <span
        className="rounded bg-danger-soft px-2 py-0.5 text-[10px] font-bold text-danger-7"
        title={errMsg}
      >
        ✕ {errMsg}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      data-testid={`toggle-supplier-${supplierId}`}
      className={`rounded px-2 py-1 text-[10px] font-bold transition-colors disabled:opacity-50 ${
        active
          ? 'bg-white border border-line text-ink-3 hover:bg-line-soft'
          : 'bg-arrow text-white hover:bg-arrow-2'
      }`}
    >
      {pending ? '...' : active ? 'Pasifleştir' : '↺ Aktifleştir'}
    </button>
  );
}

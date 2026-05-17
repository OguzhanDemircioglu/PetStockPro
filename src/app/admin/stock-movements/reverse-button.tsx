'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { reverseMovementAction } from './actions';

interface Props {
  movementId: string;
  withinWindow: boolean;
  isTransfer: boolean;
}

/**
 * Ledger satırında "↶ Geri al" buton.
 * Pencere kontrolü server'da hesaplanır (Date.now() render içinde
 * imkansız — React purity). confirm() ile onay alır.
 * Transfer pair olarak birlikte geri alınır (Sprint 4.6).
 */
export function ReverseButton({ movementId, withinWindow, isTransfer }: Props) {
  const [pending, startTransition] = useTransition();
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const router = useRouter();

  if (!withinWindow) return null;

  const handleReverse = () => {
    const message = isTransfer
      ? 'Transfer geri alınacak — her iki şubede stok eski haline döner. Onaylıyor musun?'
      : 'Bu hareketi geri al? Stok eski haline döner, ledger\'da iz kalır.';
    if (!confirm(message)) {
      return;
    }
    setErrMsg(null);
    startTransition(async () => {
      const result = await reverseMovementAction(movementId);
      if (result.ok) {
        router.refresh();
      } else {
        setErrMsg(result.message);
      }
    });
  };

  if (errMsg) {
    return (
      <span
        className="rounded bg-danger-soft px-1.5 py-0.5 text-[10px] font-bold text-danger-7"
        title={errMsg}
      >
        ✕ {errMsg.slice(0, 30)}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleReverse}
      disabled={pending}
      data-testid={`reverse-${movementId}`}
      title="24 saat içinde geri alabilirsin"
      className="rounded border border-line bg-paper px-2 py-0.5 text-[10px] font-bold text-ink-2 hover:border-cat hover:text-cart disabled:opacity-50"
    >
      {pending ? '...' : '↶ Geri al'}
    </button>
  );
}

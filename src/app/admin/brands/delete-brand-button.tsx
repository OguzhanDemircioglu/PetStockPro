'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteBrandAction } from './actions';

interface Props {
  brandId: string;
  brandName: string;
  productCount: number;
}

export function DeleteBrandButton({ brandId, brandName, productCount }: Props) {
  const [pending, startTransition] = useTransition();
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const router = useRouter();

  const handleDelete = () => {
    const warning =
      productCount > 0
        ? `"${brandName}" markası ${productCount} ürün tarafından kullanılıyor. Silersen bu ürünler markasız kalır. Devam et?`
        : `"${brandName}" markasını sil?`;
    if (!confirm(warning)) return;

    setErrMsg(null);
    startTransition(async () => {
      const result = await deleteBrandAction(brandId);
      if (result.ok) {
        router.refresh();
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
      onClick={handleDelete}
      disabled={pending}
      data-testid={`delete-brand-${brandId}`}
      className="rounded border border-danger/30 bg-white px-2 py-1 text-[10px] font-bold text-danger-7 hover:bg-danger-soft disabled:opacity-50"
    >
      {pending ? '...' : '🗑 Sil'}
    </button>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteCategoryAction } from './actions';

interface Props {
  categoryId: string;
  categoryName: string;
  productCount: number;
}

export function DeleteCategoryButton({
  categoryId,
  categoryName,
  productCount,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const router = useRouter();

  const handleDelete = () => {
    const warning =
      productCount > 0
        ? `"${categoryName}" kategorisi ${productCount} ürün tarafından kullanılıyor. Silersen bu ürünler kategorisiz kalır. Devam et?`
        : `"${categoryName}" kategorisini sil?`;
    if (!confirm(warning)) return;

    setErrMsg(null);
    startTransition(async () => {
      const result = await deleteCategoryAction(categoryId);
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
      data-testid={`delete-category-${categoryId}`}
      className="rounded border border-danger/30 bg-white px-2 py-1 text-[10px] font-bold text-danger-7 hover:bg-danger-soft disabled:opacity-50"
    >
      {pending ? '...' : '🗑 Sil'}
    </button>
  );
}

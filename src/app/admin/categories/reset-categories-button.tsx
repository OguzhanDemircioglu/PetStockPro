'use client';

import { useActionState } from 'react';
import { useSwalOnError } from '@/lib/ui/use-swal-on-error';
import {
  resetMyCategoriesAction,
  type ResetCategoriesState,
} from './reset-categories-action';

/**
 * Admin Default kategorilere sıfırla — destructive button.
 *
 * BAYI_SAHIBI veya SUPERADMIN tetikleyebilir. Native confirm() 2-aşamalı onay.
 * Server action audit log yazımını kendisi yapar.
 */
export function ResetMyCategoriesButton() {
  const [state, formAction, isPending] = useActionState<
    ResetCategoriesState | null,
    FormData
  >(resetMyCategoriesAction, null);
  useSwalOnError(state && !state.ok ? state : null);

  return (
    <div className="flex flex-col gap-3">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (
            !window.confirm(
              '⚠ TÜM kategorilerin silinip default 49 hiyerarşik kategori ' +
                '(6 üst + 43 alt) yeniden seed edilecek. Mevcut ürünlerin ' +
                'kategorileri boş kalır (kategorilerini tekrar atamalısın). ' +
                'Devam edilsin mi?',
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        <button
          type="submit"
          disabled={isPending}
          data-testid="reset-my-categories-submit"
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-[12px] font-bold text-ink-3 hover:border-danger/40 hover:bg-danger-soft hover:text-danger-7 disabled:opacity-60"
        >
          {isPending
            ? '⏳ Sıfırlanıyor...'
            : '🔄 Default 49 kategoriye sıfırla'}
        </button>
      </form>

      {state?.ok && (
        <div
          data-testid="reset-my-categories-success"
          className="rounded-xl border border-arrow/40 bg-arrow-soft px-4 py-2 text-[13px] font-bold text-arrow-7"
        >
          ✓ {state.deletedCount} eski kategori silindi, {state.insertedCount}{' '}
          default kategori yeniden eklendi.
          {(state.productsAffected ?? 0) > 0
            ? ` ${state.productsAffected} ürün kategorisiz kaldı.`
            : ''}
        </div>
      )}
    </div>
  );
}

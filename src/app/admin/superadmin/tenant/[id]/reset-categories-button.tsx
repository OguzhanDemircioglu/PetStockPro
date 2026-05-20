'use client';

import { useActionState } from 'react';
import { useSwalOnError } from '@/lib/ui/use-swal-on-error';
import {
  resetCategoriesAction,
  type ResetCategoriesState,
} from './reset-categories-action';

interface Props {
  companyId: string;
}

/**
 * Tenant default kategorilere sıfırla — destructive action button.
 *
 * Native confirm() dialog ile 2-aşamalı onay. Server action süperadmin
 * gate'i + audit log yazımı kendisi yapar.
 */
export function ResetCategoriesButton({ companyId }: Props) {
  const [state, formAction, isPending] = useActionState<
    ResetCategoriesState | null,
    FormData
  >(resetCategoriesAction, null);
  useSwalOnError(state && !state.ok ? state : null);

  return (
    <div className="flex flex-col gap-3">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (
            !window.confirm(
              "⚠ Bu tenant'ın TÜM kategorilerini silip default 49 hiyerarşik " +
                'kategoriyi yeniden seed edecek. Ürünlerin kategorileri NULL ' +
                'olur (kullanıcı kategorilerini tekrar atamak zorunda kalır). ' +
                'Devam edilsin mi?',
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="companyId" value={companyId} />
        <button
          type="submit"
          disabled={isPending}
          data-testid="reset-categories-submit"
          className="inline-flex items-center gap-2 rounded-xl bg-danger px-4 py-2 text-[13px] font-bold text-white shadow-sm transition-all hover:bg-danger-7 disabled:opacity-60"
        >
          {isPending ? '⏳ Sıfırlanıyor...' : '🔄 Default kategorilere sıfırla'}
        </button>
      </form>

      {state?.ok && (
        <div
          data-testid="reset-categories-success"
          className="rounded-xl border border-arrow/40 bg-arrow-soft px-4 py-2 text-[13px] font-bold text-arrow-7"
        >
          ✓ {state.deletedCount} kategori silindi, {state.insertedCount} default
          kategori yeniden seed edildi. {state.productsAffected ?? 0} ürün
          kategorisiz kaldı.
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { storefrontKeys, productKeys } from '@/lib/queries/keys';
import { PetSpinner } from '@/components/ui/pet-spinner';
import {
  publishProductAction,
  unpublishProductAction,
} from './[id]/edit/storefront-actions';

interface Props {
  productId: string;
  initialPublished: boolean;
}

/**
 * Liste satırında hızlı Satışa Aç/Kapat — FAZ 5.3 optimistic toggle.
 *
 * onMutate → published flip ANINDA (UI tepkisi 200-500ms beklemez).
 * Validation fail (issues) → revert + edit sayfasına yönlendir (Doğrula gör).
 * Network fail → revert + alert.
 */
export function ListRowToggle({ productId, initialPublished }: Props) {
  const [published, setPublished] = useState(initialPublished);
  const [issuesMsg, setIssuesMsg] = useState<string | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (next: boolean) => {
      const action = next ? publishProductAction : unpublishProductAction;
      const result = await action(productId);
      return { result, next };
    },
    onMutate: async (next: boolean) => {
      const previous = published;
      setPublished(next);
      setIssuesMsg(null);
      return { previous };
    },
    onSuccess: ({ result, next }) => {
      if (!result.ok) {
        // Revert
        setPublished(!next);
        if (result.issues.length > 0) {
          setIssuesMsg(`${result.issues.length} eksik — Doğrula panelinden gör`);
          setTimeout(() => {
            router.push(`/admin/products/${productId}/edit` as never);
          }, 1500);
        } else {
          setIssuesMsg(result.message ?? 'Hata');
        }
      } else {
        // Başarılı — cache invalidate
        queryClient.invalidateQueries({ queryKey: storefrontKeys.all });
        queryClient.invalidateQueries({ queryKey: productKeys.lists() });
      }
    },
    onError: (_err, next, ctx) => {
      if (ctx) setPublished(ctx.previous);
      setIssuesMsg('Bağlantı hatası — tekrar dene');
    },
  });

  if (issuesMsg) {
    return (
      <span
        title={issuesMsg}
        className="inline-flex items-center gap-1 rounded bg-danger-soft px-2 py-0.5 text-[11.5px] font-bold text-danger-7"
      >
        ⚠ {issuesMsg}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => mutation.mutate(!published)}
      disabled={mutation.isPending}
      title={published ? 'Satışa Kapat' : 'Satışa Aç (Doğrula kontrol eder)'}
      data-storefront-published={published ? '1' : '0'}
      className={`inline-flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 text-[11.5px] font-bold transition-colors ${
        published
          ? 'bg-arrow-soft text-arrow-7 hover:bg-arrow/30'
          : 'bg-line-soft text-ink-4 hover:bg-cat-soft hover:text-cart'
      } disabled:opacity-60`}
    >
      {mutation.isPending ? (
        <PetSpinner size="sm" inline tone={published ? 'arrow' : 'cat'} label="İşleniyor" />
      ) : published ? (
        '✓ Aktif'
      ) : (
        'Aç'
      )}
    </button>
  );
}

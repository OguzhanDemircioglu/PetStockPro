'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  publishProductAction,
  unpublishProductAction,
} from './[id]/edit/storefront-actions';

interface Props {
  productId: string;
  initialPublished: boolean;
}

/**
 * Liste satırında hızlı Satışa Aç/Kapat toggle. Validation fail olursa
 * banner gösterip kullanıcıyı edit sayfasına yönlendirir (Doğrula gate görsün).
 */
export function ListRowToggle({ productId, initialPublished }: Props) {
  const [published, setPublished] = useState(initialPublished);
  const [issuesMsg, setIssuesMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const toggle = () => {
    setIssuesMsg(null);
    startTransition(async () => {
      const action = published ? unpublishProductAction : publishProductAction;
      const result = await action(productId);
      if (result.ok) {
        setPublished(!published);
      } else if (result.issues.length > 0) {
        setIssuesMsg(`${result.issues.length} eksik — Doğrula panelinden gör`);
        // 2 sn sonra edit sayfasına yönlendir
        setTimeout(() => {
          router.push(`/admin/products/${productId}/edit` as never);
        }, 1500);
      } else {
        setIssuesMsg(result.message ?? 'Hata');
      }
    });
  };

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
      onClick={toggle}
      disabled={pending}
      title={published ? 'Satışa Kapat' : 'Satışa Aç (Doğrula kontrol eder)'}
      className={`inline-flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 text-[11.5px] font-bold transition-colors ${
        published
          ? 'bg-arrow-soft text-arrow-7 hover:bg-arrow/30'
          : 'bg-line-soft text-ink-4 hover:bg-cat-soft hover:text-cart'
      } disabled:opacity-60`}
    >
      {pending ? '...' : published ? '✓ Aktif' : 'Aç'}
    </button>
  );
}

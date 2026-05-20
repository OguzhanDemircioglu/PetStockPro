'use client';

import { useState, useTransition } from 'react';
import { useSwalOnErrorString } from '@/lib/ui/use-swal-on-error';
import {
  publishProductAction,
  unpublishProductAction,
  type StorefrontActionState,
} from './storefront-actions';
import type { StorefrontValidationResult } from '@/lib/catalog/storefront';

interface Props {
  productId: string;
  initialPublished: boolean;
  validation: StorefrontValidationResult;
  publishedAt: Date | null;
  unpublishedReason: string | null;
}

export function StorefrontSection({
  productId,
  initialPublished,
  validation,
  publishedAt,
  unpublishedReason,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [published, setPublished] = useState(initialPublished);
  const [feedback, setFeedback] = useState<StorefrontActionState | null>(null);
  useSwalOnErrorString(
    feedback && !feedback.ok ? feedback.message ?? null : null,
    'Vitrin işlemi',
  );

  const canPublish = validation.ok;

  // Field-level kızartma — vitrin toggle'ı validation pass değilse + yayında
  // değilse "invalid" sayılır (eksiklikler ValidationPanel'de listelenir).
  // Action sonrası hata da invalid sayılır (örn idempotent fail).
  const actionFailed = !!(feedback && !feedback.ok);
  const toggleInvalid = (!published && !canPublish) || actionFailed;

  const handlePublish = () => {
    setFeedback(null);
    startTransition(async () => {
      const result = await publishProductAction(productId);
      setFeedback(result);
      if (result.ok) setPublished(true);
    });
  };

  const handleUnpublish = () => {
    setFeedback(null);
    startTransition(async () => {
      const result = await unpublishProductAction(productId);
      setFeedback(result);
      if (result.ok) setPublished(false);
    });
  };

  return (
    <section
      className={`rounded-2xl border p-6 ${
        published
          ? 'border-arrow/40 bg-arrow-soft/40'
          : 'border-line bg-paper'
      }`}
      data-testid="storefront-section"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-cart">
            {published ? '🌐 Vitrin\'de yayında' : '🔒 Vitrin\'de kapalı'}
          </h2>
          <p className="mt-1 text-xs text-ink-3">
            {published
              ? 'Bu ürün vitrin müşterileri tarafından görülebilir, WhatsApp ile sana ulaşabilir.'
              : 'Vitrin\'e açtığında PetStockPro\'da listelenir; müşteri WhatsApp ile sana ulaşır.'}
          </p>
          {published && publishedAt && (
            <p className="mt-1 text-[12.5px] text-ink-4">
              Yayın: {new Date(publishedAt).toLocaleString('tr-TR')}
            </p>
          )}
          {!published && unpublishedReason && (
            <p className="mt-1 text-[12.5px] text-ink-4">
              Kapanma sebebi:{' '}
              <strong>
                {unpublishedReason === 'manual'
                  ? 'Manuel kapatıldı'
                  : unpublishedReason === 'stock_zero'
                  ? 'Stok 0\'a düştü (otomatik)'
                  : unpublishedReason}
              </strong>
            </p>
          )}
        </div>

        <label
          className={`inline-flex cursor-pointer items-center gap-2 rounded-full border-2 px-3 py-1.5 text-xs font-bold ${
            published
              ? 'border-arrow bg-arrow-soft text-arrow-7'
              : canPublish
              ? 'border-cat bg-paper text-cart hover:bg-cat-soft'
              : 'cursor-not-allowed border-line bg-line-soft text-ink-4'
          }`}
        >
          <input
            type="checkbox"
            checked={published}
            disabled={pending || (!published && !canPublish)}
            onChange={(e) => {
              if (e.target.checked) handlePublish();
              else handleUnpublish();
            }}
            aria-invalid={toggleInvalid || undefined}
            className="h-4 w-4 accent-cat"
            data-testid="storefront-toggle"
          />
          <span>
            {pending
              ? 'İşleniyor...'
              : published
              ? 'Yayında'
              : canPublish
              ? 'Satışa Aç'
              : 'Kilitli'}
          </span>
        </label>
      </header>

      {/* Validation panel */}
      {!published && (
        <ValidationPanel validation={validation} />
      )}

      {feedback?.ok && feedback.message && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-arrow-soft px-3 py-2 text-xs font-bold text-arrow-7"
        >
          ✓ {feedback.message}
        </p>
      )}
    </section>
  );
}

function ValidationPanel({ validation }: { validation: StorefrontValidationResult }) {
  const checks: { label: string; pass: boolean }[] = [
    { label: 'Şirket vergi numarası', pass: validation.meta.hasVatNo },
    { label: 'Ürün aktif', pass: validation.meta.isActive },
    { label: 'Kategori seçili', pass: validation.meta.hasCategory },
    {
      label: `Aktif variant (${validation.meta.activeVariantCount})`,
      pass: validation.meta.activeVariantCount > 0,
    },
    {
      label: 'Makul satış fiyatı (1₺ - 50.000₺)',
      pass: !validation.issues.some((i) => i.code === 'invalid_sale_price'),
    },
  ];

  return (
    <div className="mt-4 rounded-xl border border-line bg-paper p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink-3">
          🔍 Doğrula
        </h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${
            validation.ok
              ? 'bg-arrow-soft text-arrow-7'
              : 'bg-danger-soft text-danger-7'
          }`}
        >
          {validation.ok
            ? '✓ Tümü hazır'
            : `${validation.issues.length} eksik`}
        </span>
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center gap-2 text-xs">
            <span
              className={
                c.pass
                  ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-arrow text-white'
                  : 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-danger/20 text-danger-7'
              }
            >
              {c.pass ? '✓' : '✕'}
            </span>
            <span className={c.pass ? 'text-ink-2' : 'font-bold text-danger-7'}>
              {c.label}
            </span>
          </li>
        ))}
      </ul>
      {validation.issues.length > 0 && (
        <div className="mt-3 rounded-lg bg-danger-soft px-3 py-2">
          <p className="text-[12.5px] font-bold text-danger-7">Eksiklikler:</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-[12.5px] text-danger-7">
            {validation.issues.map((i) => (
              <li key={i.code}>• {i.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

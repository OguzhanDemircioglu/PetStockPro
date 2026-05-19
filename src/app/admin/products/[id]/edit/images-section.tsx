'use client';

import { useState, useTransition, useRef } from 'react';
import {
  uploadImageAction,
  deleteImageAction,
  setPrimaryImageAction,
  type ImageActionState,
} from './image-actions';
import type { ProductImageRow } from '@/lib/catalog/product-images';

interface Props {
  productId: string;
  images: ProductImageRow[];
}

const ACCEPT = 'image/jpeg,image/png,image/webp';

export function ImagesSection({ productId, images }: Props) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<ImageActionState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleUpload = (formData: FormData) => {
    setStatus(null);
    startTransition(async () => {
      const result = await uploadImageAction(productId, null, formData);
      setStatus(result);
      if (result.ok) {
        formRef.current?.reset();
      }
    });
  };

  const handleDelete = (imageId: string, name: string) => {
    if (!window.confirm(`"${name}" görseli silinsin mi?`)) return;
    setStatus(null);
    startTransition(async () => {
      const result = await deleteImageAction(productId, imageId);
      setStatus(result);
    });
  };

  const handleSetPrimary = (imageId: string) => {
    setStatus(null);
    startTransition(async () => {
      const result = await setPrimaryImageAction(productId, imageId);
      setStatus(result);
    });
  };

  return (
    <section
      className="flex flex-col gap-4 rounded-2xl border border-line bg-paper p-5"
      data-testid="product-images-section"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-[16px] font-bold tracking-tight text-cart">
            📷 Görseller ({images.length})
          </h3>
          <p className="mt-0.5 text-[12.5px] text-ink-3">
            JPG / PNG / WebP · max 5MB · ilk yüklenen otomatik ana görsel olur.
          </p>
        </div>
      </div>

      {/* Upload form — React 19 function action + FormData otomatik multipart handle eder,
          encType/method attribute'ları belirtilmemeli (hydration uyarısı) */}
      <form
        ref={formRef}
        action={handleUpload}
        className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-line bg-line-soft/40 p-3"
        data-testid="image-upload-form"
      >
        <input
          ref={fileInputRef}
          type="file"
          name="file"
          accept={ACCEPT}
          required
          disabled={isPending}
          data-testid="image-file-input"
          className="flex-1 min-w-[200px] cursor-pointer rounded-lg border border-line bg-paper p-2 text-[13px] text-ink-2 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-cat file:px-3 file:py-1.5 file:text-[12px] file:font-bold file:text-white hover:file:bg-cat-2"
        />
        <input
          type="text"
          name="altText"
          maxLength={200}
          placeholder="Alt metin (opsiyonel, SEO için)"
          disabled={isPending}
          className="min-w-[180px] flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-[13px] text-ink"
        />
        <button
          type="submit"
          disabled={isPending}
          data-testid="image-upload-submit"
          className="rounded-xl bg-gradient-to-br from-cat to-cat-2 px-4 py-2 text-[13px] font-bold text-white shadow-sm hover:-translate-y-px transition-transform disabled:opacity-60"
        >
          {isPending ? '⏳ Yükleniyor...' : '⬆ Yükle'}
        </button>
      </form>

      {/* Status banner */}
      {status?.message && (
        <div
          role="alert"
          data-testid="image-action-status"
          className={
            status.ok
              ? 'rounded-xl border border-arrow/40 bg-arrow-soft px-3 py-2 text-[13px] font-bold text-arrow-7'
              : 'rounded-xl border border-danger/40 bg-danger-soft px-3 py-2 text-[13px] font-bold text-danger-7'
          }
        >
          {status.message}
        </div>
      )}

      {/* Mevcut görseller */}
      {images.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-line bg-paper py-8 text-center">
          <div className="text-3xl">📷</div>
          <p className="mt-2 text-[13px] text-ink-3">Henüz görsel yok.</p>
        </div>
      ) : (
        <ul
          data-testid="image-list"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {images.map((img) => (
            <li
              key={img.id}
              data-testid={`image-card-${img.id}`}
              data-is-primary={img.isPrimary ? '1' : '0'}
              className={
                img.isPrimary
                  ? 'flex flex-col overflow-hidden rounded-xl border-2 border-cat bg-paper shadow-[var(--shadow-cat)]'
                  : 'flex flex-col overflow-hidden rounded-xl border border-line bg-paper'
              }
            >
              {/* Thumb */}
              <div className="relative aspect-square overflow-hidden bg-line-soft">
                <img
                  src={img.url}
                  alt={img.altText ?? ''}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                {img.isPrimary && (
                  <span className="absolute left-2 top-2 rounded-full bg-cat px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-white shadow-sm">
                    ★ Ana görsel
                  </span>
                )}
                {/* ✕ Sil button — thumb sağ üst köşede daima görünür */}
                <button
                  type="button"
                  onClick={() => handleDelete(img.id, img.altText ?? 'görsel')}
                  disabled={isPending}
                  data-testid={`image-delete-${img.id}`}
                  aria-label={`${img.altText ?? 'görsel'} sil`}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-danger/95 text-sm font-bold text-white shadow-md transition-transform hover:scale-110 active:scale-95 disabled:opacity-60"
                >
                  ✕
                </button>
              </div>
              {/* Meta + actions */}
              <div className="flex flex-1 flex-col gap-2 p-3">
                <div className="text-[11.5px] text-ink-3">
                  Sıra: {img.displayOrder} ·{' '}
                  {img.altText ?? 'Alt metin yok'}
                </div>
                {!img.isPrimary && (
                  <button
                    type="button"
                    onClick={() => handleSetPrimary(img.id)}
                    disabled={isPending}
                    data-testid={`image-set-primary-${img.id}`}
                    className="mt-auto rounded-lg border border-cat/40 bg-cat-soft px-2 py-1.5 text-[12px] font-bold text-cart hover:bg-cat hover:text-white disabled:opacity-60"
                  >
                    ★ Ana yap
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

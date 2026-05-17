'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import {
  updateProductAction,
  deleteProductAction,
  type EditProductState,
} from './actions';

interface CategoryOption {
  id: string;
  name: string;
  emoji: string | null;
}

interface BrandOption {
  id: string;
  name: string;
}

interface InitialData {
  name: string;
  description: string | null;
  categoryId: string | null;
  brandId: string | null;
  isActive: boolean;
  variant: {
    id: string;
    valueLabel: string;
    sku: string;
    barcode: string | null;
    costPrice: string;
    salePrice: string;
    threshold: number;
  };
}

interface EditFormProps {
  productId: string;
  variantId: string;
  initial: InitialData;
  categories: CategoryOption[];
  brands: BrandOption[];
}

export function EditForm({
  productId,
  variantId,
  initial,
  categories,
  brands,
}: EditFormProps) {
  const boundUpdate = updateProductAction.bind(null, productId, variantId);
  const [state, formAction, pending] = useActionState<EditProductState | null, FormData>(
    boundUpdate,
    null,
  );

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link href={'/admin/products' as never} className="text-xs text-ink-4 hover:text-cart">
          ← Ürünlere dön
        </Link>
        <div className="mt-3 text-[13px] font-bold uppercase tracking-wider text-cat">
          Admin · Ürün düzenle
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          {initial.name}
        </h1>
      </header>

      {state?.error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-bold text-danger-7"
        >
          {state.error}
        </div>
      )}

      <form action={formAction} className="flex flex-col gap-6">
        <section className="rounded-2xl border border-line bg-paper p-6">
          <h2 className="text-lg font-bold text-cart">📦 Temel bilgiler</h2>
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3" htmlFor="name">
                Ürün adı *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                disabled={pending}
                defaultValue={initial.name}
                className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3" htmlFor="description">
                Açıklama
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                disabled={pending}
                defaultValue={initial.description ?? ''}
                className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3" htmlFor="categoryId">
                  Kategori
                </label>
                <select
                  id="categoryId"
                  name="categoryId"
                  disabled={pending}
                  defaultValue={initial.categoryId ?? ''}
                  className="w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
                >
                  <option value="">— Seç —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji ? `${c.emoji} ` : ''}{c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3" htmlFor="brandId">
                  Marka
                </label>
                <select
                  id="brandId"
                  name="brandId"
                  disabled={pending || brands.length === 0}
                  defaultValue={initial.brandId ?? ''}
                  className="w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
                >
                  <option value="">{brands.length === 0 ? 'Henüz marka yok' : '— Seç —'}</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-line-soft px-3.5 py-3 text-sm text-ink-2">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={initial.isActive}
                disabled={pending}
                className="h-[18px] w-[18px] accent-cat"
              />
              <span><strong className="text-cart">Aktif</strong> — kapalı ürün listede gri görünür, satış kaydedilmez</span>
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-paper p-6">
          <h2 className="text-lg font-bold text-cart">🏷 Default variant — hızlı düzenleme</h2>
          <p className="mt-1 text-xs text-ink-3">
            Vitrin&apos;de görünen birincil variant. Tüm variantları aşağıdaki <strong>Variantlar</strong> bölümünden yönetebilirsin.
          </p>

          <div className="mt-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3" htmlFor="valueLabel">
                  Boyut/ambalaj
                </label>
                <input
                  id="valueLabel"
                  name="valueLabel"
                  type="text"
                  required
                  disabled={pending}
                  defaultValue={initial.variant.valueLabel}
                  className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3" htmlFor="sku">
                  SKU *
                </label>
                <input
                  id="sku"
                  name="sku"
                  type="text"
                  required
                  disabled={pending}
                  defaultValue={initial.variant.sku}
                  className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 font-mono text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3" htmlFor="barcode">
                Barkod
              </label>
              <input
                id="barcode"
                name="barcode"
                type="text"
                maxLength={13}
                disabled={pending}
                defaultValue={initial.variant.barcode ?? ''}
                className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 font-mono text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3" htmlFor="costPrice">
                  Alış (₺) *
                </label>
                <input
                  id="costPrice"
                  name="costPrice"
                  type="text"
                  inputMode="decimal"
                  required
                  disabled={pending}
                  defaultValue={initial.variant.costPrice}
                  className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 font-mono text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3" htmlFor="salePrice">
                  Satış (₺) *
                </label>
                <input
                  id="salePrice"
                  name="salePrice"
                  type="text"
                  inputMode="decimal"
                  required
                  disabled={pending}
                  defaultValue={initial.variant.salePrice}
                  className="w-full rounded-xl border-[1.5px] border-cat bg-paper px-4 py-3 font-mono text-sm font-bold text-cart focus:outline-none focus:ring-4 focus:ring-cat/15"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3" htmlFor="threshold">
                  Eşik
                </label>
                <input
                  id="threshold"
                  name="threshold"
                  type="number"
                  min={0}
                  max={9999}
                  disabled={pending}
                  defaultValue={initial.variant.threshold}
                  className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 font-mono text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
                />
              </div>
            </div>
          </div>
        </section>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={pending}
            className="flex-1 inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-cat to-cat-2 px-6 py-3.5 text-sm font-bold text-white shadow-[var(--shadow-cat)] hover:-translate-y-0.5 transition-transform disabled:opacity-60"
          >
            {pending ? 'Kaydediliyor...' : 'Değişiklikleri kaydet'}
          </button>
          <Link
            href={'/admin/products' as never}
            className="rounded-xl border border-line bg-paper px-6 py-3.5 text-sm font-bold text-ink-3 hover:bg-line-soft"
          >
            Vazgeç
          </Link>
        </div>
      </form>

      {/* Delete — ayrı form (form nesting yok) */}
      <section className="rounded-2xl border border-danger/30 bg-danger-soft p-6">
        <h2 className="text-lg font-bold text-danger-7">🗑 Ürünü sil</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-2">
          Soft delete — ürün listeden kalkar ama stok hareketleri raporlarda görünür.
          Geri alma Sprint 3.3&apos;te.
        </p>
        <form action={deleteProductAction.bind(null, productId)} className="mt-3">
          <button
            type="submit"
            className="rounded-xl border border-danger/40 bg-paper px-4 py-2 text-xs font-bold text-danger-7 hover:bg-danger-soft"
          >
            Ürünü sil
          </button>
        </form>
      </section>
    </div>
  );
}

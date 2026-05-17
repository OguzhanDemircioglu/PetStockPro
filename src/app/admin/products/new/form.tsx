'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { createProductAction, type CreateProductState } from './actions';

interface CategoryOption {
  id: string;
  name: string;
  emoji: string | null;
}

interface BrandOption {
  id: string;
  name: string;
}

interface ProductFormProps {
  categories: CategoryOption[];
  brands: BrandOption[];
}

/**
 * Yeni Ürün Form — Sprint 3.0 minimal
 *
 * 8-bölüm full form Sprint 3.1+. Şu an: temel + variant + opsiyonel.
 */
export function ProductForm({ categories, brands }: ProductFormProps) {
  const [state, formAction, pending] = useActionState<CreateProductState | null, FormData>(
    createProductAction,
    null,
  );

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <header>
        <Link href={'/admin/products' as never} className="text-xs text-ink-4 hover:text-cart">
          ← Ürünlere dön
        </Link>
        <div className="mt-3 text-[13px] font-bold uppercase tracking-wider text-cat">
          Admin · Yeni ürün
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          Yeni ürün ekle
        </h1>
      </header>

      {state?.error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-bold text-danger-7"
        >
          {state.error}
          {state.issues.length > 1 && (
            <ul className="mt-2 list-inside list-disc text-xs font-normal">
              {state.issues.slice(1).map((i, idx) => (
                <li key={idx}>{i}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <form action={formAction} className="flex flex-col gap-6">
        {/* TEMEL BİLGİLER */}
        <section className="rounded-2xl border border-line bg-paper p-6">
          <h2 className="text-lg font-bold text-cart">📦 Temel bilgiler</h2>

          <div className="mt-4 flex flex-col gap-4">
            <div>
              <label
                className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
                htmlFor="name"
              >
                Ürün adı *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                placeholder="Royal Canin Adult Kedi Maması"
                required
                disabled={pending}
                defaultValue={state?.formValues.name ?? ''}
                className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
              />
            </div>

            <div>
              <label
                className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
                htmlFor="description"
              >
                Açıklama
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                placeholder="Ürün hakkında kısa bilgi (vitrin'de gösterilir, opsiyonel)"
                disabled={pending}
                className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
                  htmlFor="categoryId"
                >
                  Kategori
                </label>
                <select
                  id="categoryId"
                  name="categoryId"
                  disabled={pending}
                  defaultValue={state?.formValues.categoryId ?? ''}
                  className="w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
                >
                  <option value="">— Seç (opsiyonel) —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji ? `${c.emoji} ` : ''}
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
                  htmlFor="brandId"
                >
                  Marka
                </label>
                <select
                  id="brandId"
                  name="brandId"
                  disabled={pending || brands.length === 0}
                  className="w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
                >
                  <option value="">
                    {brands.length === 0 ? 'Henüz marka yok' : '— Seç (opsiyonel) —'}
                  </option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* VARIANT BİLGİLERİ */}
        <section className="rounded-2xl border border-line bg-paper p-6">
          <h2 className="text-lg font-bold text-cart">🏷 Stok birimi</h2>
          <p className="mt-1 text-xs text-ink-3">
            İlk variant otomatik default olarak işaretlenir. Sprint 3.1&apos;de birden fazla
            variant (400g/2kg/10kg) eklenebilir.
          </p>

          <div className="mt-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
                  htmlFor="valueLabel"
                >
                  Boyut / ambalaj
                </label>
                <input
                  id="valueLabel"
                  name="valueLabel"
                  type="text"
                  placeholder="2kg / Standart / Büyük boy"
                  disabled={pending}
                  defaultValue="Standart"
                  className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
                />
              </div>

              <div>
                <label
                  className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
                  htmlFor="sku"
                >
                  SKU *
                </label>
                <input
                  id="sku"
                  name="sku"
                  type="text"
                  placeholder="RC-AD-KEDI-2KG"
                  required
                  disabled={pending}
                  defaultValue={state?.formValues.sku ?? ''}
                  className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 font-mono text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
                />
              </div>
            </div>

            <div>
              <label
                className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
                htmlFor="barcode"
              >
                Barkod (opsiyonel)
              </label>
              <input
                id="barcode"
                name="barcode"
                type="text"
                placeholder="3033xxxxxxxxx (EAN-13)"
                disabled={pending}
                maxLength={13}
                className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 font-mono text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label
                  className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
                  htmlFor="costPrice"
                >
                  Alış fiyatı (₺)
                </label>
                <input
                  id="costPrice"
                  name="costPrice"
                  type="text"
                  inputMode="decimal"
                  placeholder="120"
                  disabled={pending}
                  className="w-full rounded-xl border-[1.5px] border-line bg-paper px-4 py-3 font-mono text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
                />
              </div>

              <div>
                <label
                  className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
                  htmlFor="salePrice"
                >
                  Satış fiyatı (₺) *
                </label>
                <input
                  id="salePrice"
                  name="salePrice"
                  type="text"
                  inputMode="decimal"
                  placeholder="180"
                  required
                  disabled={pending}
                  defaultValue={state?.formValues.salePrice ?? ''}
                  className="w-full rounded-xl border-[1.5px] border-cat bg-paper px-4 py-3 font-mono text-sm font-bold text-cart focus:outline-none focus:ring-4 focus:ring-cat/15"
                />
              </div>

              <div>
                <label
                  className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
                  htmlFor="threshold"
                >
                  Düşük stok eşiği
                </label>
                <input
                  id="threshold"
                  name="threshold"
                  type="number"
                  min={0}
                  max={9999}
                  defaultValue={5}
                  disabled={pending}
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
            className="flex-1 inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-cat to-cat-2 px-6 py-3.5 text-sm font-bold text-white shadow-[var(--shadow-cat)] hover:-translate-y-0.5 transition-transform disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {pending ? 'Kaydediliyor...' : 'Ürünü kaydet'}
          </button>
          <Link
            href={'/admin/products' as never}
            className="rounded-xl border border-line bg-paper px-6 py-3.5 text-sm font-bold text-ink-3 hover:bg-line-soft"
          >
            Vazgeç
          </Link>
        </div>
      </form>
    </main>
  );
}

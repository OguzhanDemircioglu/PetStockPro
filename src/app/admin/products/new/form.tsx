'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import { SeedCatalogAutocomplete } from '@/components/products/seed-catalog-autocomplete';
import type { SearchResult } from '@/lib/catalog/seed-catalog';
import { createProductAction, type CreateProductState } from './actions';

interface CategoryOption {
  id: string;
  name: string;
  emoji: string | null;
  slug: string;
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
 * SKU önerisi üret — `<BRAND>-<NAME>-<WEIGHT>` format'ında, max 24 char.
 * Marka 1-4 harfli kısaltma (kelime başlarından), name ilk anlamlı kelime (3-4 harf),
 * weight cleanup (boşluksuz, büyük harf).
 */
function suggestSku(brand: string, name: string, weight: string): string {
  const brandAbbr =
    brand
      .split(/\s+/)
      .map((w) => w[0])
      .filter((c) => /[a-zA-Z]/.test(c ?? ''))
      .join('')
      .toUpperCase()
      .slice(0, 4) || 'GEN';

  const brandLower = brand.toLowerCase();
  const nameTokens = name
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]/g, ''))
    .filter((w) => w.length >= 3 && !brandLower.split(/\s+/).includes(w.toLowerCase()));
  const namePart = (nameTokens[0] ?? 'STD').toUpperCase().slice(0, 4);

  const weightAbbr = weight.replace(/\s+/g, '').toUpperCase().slice(0, 4) || 'STD';

  return `${brandAbbr}-${namePart}-${weightAbbr}`;
}

/**
 * Yeni Ürün Form — Sprint 3.0 minimal + Sprint E seed katalog autocomplete.
 */
export function ProductForm({ categories, brands }: ProductFormProps) {
  const [state, formAction, pending] = useActionState<CreateProductState | null, FormData>(
    createProductAction,
    null,
  );

  // Controlled state — autocomplete prefill için
  const [name, setName] = useState(state?.formValues.name ?? '');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string>(state?.formValues.categoryId ?? '');
  const [brandId, setBrandId] = useState<string>('');
  const [valueLabel, setValueLabel] = useState('Standart');
  const [sku, setSku] = useState<string>(state?.formValues.sku ?? '');
  const [barcode, setBarcode] = useState('');
  const [salePrice, setSalePrice] = useState(state?.formValues.salePrice ?? '');
  const [missingBrandHint, setMissingBrandHint] = useState<string | null>(null);
  const [seedImagePath, setSeedImagePath] = useState<string>('');
  const [seedImagePreviewName, setSeedImagePreviewName] = useState<string | null>(null);

  // Manuel görsel upload — variant section'da file input
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageError(null);
    const file = e.target.files?.[0];
    if (!file) {
      // Önceki preview'ı temizle (object URL revoke)
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
      setImageName(null);
      return;
    }
    if (file.size > MAX_SIZE) {
      setImageError(`Dosya 5MB'i geçemez (gönderilen: ${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      e.target.value = '';
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setImageError('Sadece JPG, PNG veya WebP yükleyebilirsin');
      e.target.value = '';
      return;
    }
    // Önceki preview'ı temizle
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(URL.createObjectURL(file));
    setImageName(file.name);
  };

  // Marka / kategori case-insensitive eşleşmesi için preset
  const brandByName = useMemo(() => {
    const m = new Map<string, BrandOption>();
    for (const b of brands) m.set(b.name.toLowerCase(), b);
    return m;
  }, [brands]);

  const categoryBySlug = useMemo(() => {
    const m = new Map<string, CategoryOption>();
    for (const c of categories) m.set(c.slug, c);
    return m;
  }, [categories]);

  const handleSelectSeedProduct = (product: SearchResult) => {
    setName(product.name);
    setValueLabel(product.weight || 'Standart');
    if (product.barcode) setBarcode(product.barcode);
    if (product.description) setDescription(product.description);

    // Marka match
    const brandMatch = brandByName.get(product.brand.toLowerCase());
    if (brandMatch) {
      setBrandId(brandMatch.id);
      setMissingBrandHint(null);
    } else {
      setBrandId('');
      setMissingBrandHint(product.brand);
    }

    // Kategori match
    const catMatch = categoryBySlug.get(product.categorySlug);
    if (catMatch) setCategoryId(catMatch.id);

    // SKU önerisi (kullanıcı boşsa override etme)
    if (!sku.trim()) {
      setSku(suggestSku(product.brand, product.name, product.weight));
    }

    // Seed katalog görseli — submit'te transfer edilmek üzere hidden input'a yaz
    if (product.imagePath) {
      setSeedImagePath(product.imagePath);
      setSeedImagePreviewName(`${product.brand} ${product.name}`.slice(0, 60));
    } else {
      setSeedImagePath('');
      setSeedImagePreviewName(null);
    }
  };

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

      {/* Seed catalog autocomplete (form üstünde, opsiyonel) */}
      <section className="rounded-2xl border border-cat/30 bg-cat-soft/30 p-5">
        <SeedCatalogAutocomplete onSelect={handleSelectSeedProduct} disabled={pending} />
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3">
          Seçtiğin ürünün adı, ağırlığı, barkodu, açıklaması ve SKU önerisi forma
          dolar. Marka tenant&apos;ında varsa otomatik seçilir; yoksa önce marka
          olarak eklemen önerilir.
        </p>
        {missingBrandHint && (
          <div
            role="alert"
            data-testid="missing-brand-hint"
            className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-bars/30 bg-bars-soft px-3 py-2 text-[12.5px] font-bold text-bars-7"
          >
            <span>⚠ &quot;{missingBrandHint}&quot; markası tenant&apos;ında yok.</span>
            <Link
              href={'/admin/brands/new' as never}
              target="_blank"
              className="rounded-lg border border-bars/40 bg-paper px-2 py-1 text-[11px] hover:bg-bars hover:text-white"
            >
              + Marka ekle
            </Link>
          </div>
        )}

        {seedImagePreviewName && (
          <div
            data-testid="seed-image-hint"
            className="mt-2 rounded-xl border border-arrow/30 bg-arrow-soft/40 px-3 py-2 text-[12.5px] font-bold text-arrow-7"
          >
            📷 Seçili ürünün görseli kayıt sırasında otomatik yüklenecek
            <span className="ml-1 font-normal opacity-75">
              ({seedImagePreviewName})
            </span>
          </div>
        )}
      </section>

      <form action={formAction} encType="multipart/form-data" className="flex flex-col gap-6">
        {/* Seed katalog imagePath — autocomplete onSelect ile set edilir, server'da transfer */}
        <input type="hidden" name="seedImagePath" value={seedImagePath} />

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
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
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
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
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
                  value={valueLabel}
                  onChange={(e) => setValueLabel(e.target.value)}
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
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
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
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
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
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
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

            {/* Ürün görseli — opsiyonel, catalog seçimini override eder */}
            <div className="border-t border-line pt-4">
              <label
                className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
                htmlFor="productImage"
              >
                📷 Ürün görseli (opsiyonel)
              </label>
              <input
                id="productImage"
                name="productImage"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={pending}
                onChange={handleImageChange}
                data-testid="product-image-input"
                className="block w-full text-sm text-ink-3 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-cat-soft file:px-4 file:py-2 file:text-sm file:font-bold file:text-cat-7 hover:file:bg-cat/20 disabled:opacity-60"
              />
              <p className="mt-1.5 text-xs text-ink-3">
                JPG / PNG / WebP — max 5 MB.{' '}
                {seedImagePreviewName && (
                  <span className="font-bold text-arrow-7">
                    Görsel seçersen katalog görseli yerine bu kullanılır.
                  </span>
                )}
              </p>
              {imageError && (
                <p
                  role="alert"
                  data-testid="image-error"
                  className="mt-1.5 text-xs font-bold text-danger-7"
                >
                  ✕ {imageError}
                </p>
              )}
              {imagePreview && (
                <div
                  data-testid="image-preview"
                  className="mt-3 flex items-center gap-3 rounded-xl border border-cat/30 bg-cat-soft/30 p-3"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="Yüklenecek görsel önizleme"
                    className="h-20 w-20 rounded-lg object-cover ring-1 ring-line"
                  />
                  <div className="flex-1 text-xs">
                    <div className="font-bold text-cart">{imageName}</div>
                    <div className="text-ink-3">Önizleme — kayıtta R2&apos;ye yüklenecek</div>
                  </div>
                </div>
              )}
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

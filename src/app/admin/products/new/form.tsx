'use client';

import { useActionState, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { SeedCatalogAutocomplete } from '@/components/products/seed-catalog-autocomplete';
import type { SearchResult } from '@/lib/catalog/seed-catalog';
import { useSwalOnError, useSwalOnErrorString } from '@/lib/ui/use-swal-on-error';
import { createProductAction, type CreateProductState } from './actions';

interface CategoryOption {
  id: string;
  name: string;
  emoji: string | null;
  slug: string;
  /** null → root (üst kategori). uuid → o üst kategorinin alt'ı. */
  parentId: string | null;
}

interface BrandOption {
  id: string;
  name: string;
}

interface ProductFormProps {
  categories: CategoryOption[];
  brands: BrandOption[];
  /** R2 public base URL — server'dan prop olarak gelir (NEXT_PUBLIC_ duplicate gerek yok). */
  r2PublicUrl: string;
}

/**
 * Local image id — sadece client-side anahtarlama için (UUID'ye gerek yok,
 * timestamp + random suffix yeterli). Component DIŞINDA tanımlı: pure-render
 * kuralı (react-hooks/purity) ihlal edilmesin.
 */
function localId(): string {
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
export function ProductForm({ categories, brands, r2PublicUrl }: ProductFormProps) {
  const [state, formAction, pending] = useActionState<CreateProductState | null, FormData>(
    createProductAction,
    null,
  );
  useSwalOnError(state);

  // Controlled state — autocomplete prefill için
  const [name, setName] = useState(state?.formValues.name ?? '');
  const [description, setDescription] = useState('');
  // Üst (parent) + alt (child) kategori — 2 dropdown ile
  const [parentCategoryId, setParentCategoryId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>(state?.formValues.categoryId ?? '');
  const [brandId, setBrandId] = useState<string>('');
  const [valueLabel, setValueLabel] = useState('Standart');
  const [sku, setSku] = useState<string>(state?.formValues.sku ?? '');
  const [barcode, setBarcode] = useState('');
  const [salePrice, setSalePrice] = useState(state?.formValues.salePrice ?? '');
  const [missingBrandHint, setMissingBrandHint] = useState<string | null>(null);
  const [catalogBrand, setCatalogBrand] = useState<string>(''); // auto-create için

  // Multi-image state — manual (File) + catalog (R2 URL referans)
  interface PendingImage {
    id: string; // local uuid — remove için
    source: 'manual' | 'catalog';
    url: string; // blob: URL veya R2 https URL
    name: string;
    file?: File; // manuel için File object
    seedImagePath?: string; // catalog için R2 object key (server fallback)
  }

  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  useSwalOnErrorString(imageError, 'Görsel hatası');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB

  // Object URL revoke — sadece blob: URL'ler için (R2 https URL'leri revoke etme)
  const revokeIfBlob = (url: string | null | undefined) => {
    if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
  };

  // localId — modül seviyesinde (component dışında) tanımlı; pure-render uyumlu.

  /**
   * File input'u pendingImages.manual ile sync et (DataTransfer ile).
   * Native HTML file input multiple seçimde override eder — append imkansız.
   * Bu yüzden state'te tutulan File'ları her seferinde DataTransfer ile
   * input.files'e yeniden set ederiz. Submit native FormData gönderirse
   * tüm dosyalar geçer.
   */
  const syncFileInput = (images: PendingImage[]) => {
    if (!fileInputRef.current) return;
    const dt = new DataTransfer();
    for (const img of images) {
      if (img.source === 'manual' && img.file) dt.items.add(img.file);
    }
    fileInputRef.current.files = dt.files;
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageError(null);
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    // Her dosyayı validate + append
    const newItems: PendingImage[] = [];
    for (const file of files) {
      if (file.size > MAX_SIZE) {
        setImageError(`"${file.name}" 5MB'i geçiyor (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
        continue;
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        setImageError(`"${file.name}" desteklenmeyen tip (${file.type})`);
        continue;
      }
      newItems.push({
        id: localId(),
        source: 'manual',
        url: URL.createObjectURL(file),
        name: file.name,
        file,
      });
    }

    if (newItems.length > 0) {
      setPendingImages((prev) => {
        const next = [...prev, ...newItems];
        // Submit edildiğinde input.files state ile aynı olmalı
        setTimeout(() => syncFileInput(next), 0);
        return next;
      });
    }
  };

  /**
   * Catalog'tan seçilen görseli pending listesine ekle.
   * R2 public URL referans (CORS gerek yok), server'a seedImagePath gönderilir →
   * transferSeedImageToProduct R2 → R2 server-side kopya.
   *
   * Davranış: catalog seçimi name/brand/category override eder; image de aynı
   * semantikte — önceki catalog kaynaklı görselleri temizle, yeniyi ekle.
   * Kullanıcının manuel eklediği görseller korunur.
   */
  const showCatalogImageAsSelected = (
    imagePath: string,
    productNameForFileName: string,
  ): void => {
    if (!r2PublicUrl) return;
    const url = `${r2PublicUrl}/${imagePath}`;
    const ext = (imagePath.match(/\.(\w+)$/)?.[1] ?? 'webp').toLowerCase();
    const safeName =
      productNameForFileName
        .replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ\s-]/g, '')
        .replace(/\s+/g, '-')
        .toLowerCase()
        .slice(0, 60) || 'catalog';

    setPendingImages((prev) => {
      // Önceki catalog kaynaklı görselleri at — manuel olanları koru
      const manualOnly = prev.filter((img) => img.source !== 'catalog');
      return [
        ...manualOnly,
        {
          id: localId(),
          source: 'catalog',
          url,
          name: `${safeName}.${ext}`,
          seedImagePath: imagePath,
        },
      ];
    });
    setImageError(null);
  };

  const removeImage = (id: string) => {
    setPendingImages((prev) => {
      const removed = prev.find((img) => img.id === id);
      if (removed) revokeIfBlob(removed.url);
      const next = prev.filter((img) => img.id !== id);
      // Manuel images değişirse file input'u resync et
      if (removed?.source === 'manual') {
        setTimeout(() => syncFileInput(next), 0);
      }
      return next;
    });
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

  // Üst kategoriler (root — parentId null) ve seçili üst'ün altları
  const rootCategories = useMemo(
    () => categories.filter((c) => !c.parentId),
    [categories],
  );
  const childCategories = useMemo(
    () => categories.filter((c) => c.parentId && c.parentId === parentCategoryId),
    [categories, parentCategoryId],
  );

  const handleSelectSeedProduct = (product: SearchResult) => {
    setName(product.name);
    setValueLabel(product.weight || 'Standart');
    if (product.barcode) setBarcode(product.barcode);
    if (product.description) setDescription(product.description);

    // Marka match — yoksa catalogBrand hidden input ile auto-create yapılır
    const brandMatch = brandByName.get(product.brand.toLowerCase());
    if (brandMatch) {
      setBrandId(brandMatch.id);
      setMissingBrandHint(null);
      setCatalogBrand('');
    } else {
      setBrandId('');
      setMissingBrandHint(product.brand);
      setCatalogBrand(product.brand); // server action otomatik oluşturacak
    }

    // Kategori match — alt + üst kategori birlikte set edilir
    const catMatch = categoryBySlug.get(product.categorySlug);
    if (catMatch) {
      setCategoryId(catMatch.id);
      // Catalog category_slug zaten alt kategoridir (örn. kedi-kuru-mamalar)
      // → parentId ile üst kategoriyi bul + set et
      if (catMatch.parentId) {
        setParentCategoryId(catMatch.parentId);
      }
    }

    // SKU önerisi (kullanıcı boşsa override etme)
    if (!sku.trim()) {
      setSku(suggestSku(product.brand, product.name, product.weight));
    }

    // Seed katalog görseli — pending images listesine ekle
    if (product.imagePath) {
      showCatalogImageAsSelected(product.imagePath, `${product.brand}-${product.name}`);
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
            role="status"
            data-testid="auto-brand-hint"
            className="mt-3 flex items-center gap-2 rounded-xl border border-arrow/30 bg-arrow-soft/40 px-3 py-2 text-[12.5px] font-bold text-arrow-7"
          >
            <span>
              🆕 &quot;{missingBrandHint}&quot; markası tenant&apos;ında yok —{' '}
              <span className="font-normal">kayıtta otomatik oluşturulacak.</span>
            </span>
          </div>
        )}

      </section>

      <form action={formAction} className="flex flex-col gap-6">
        {/* Catalog brand string — tenant'ta yoksa server action otomatik oluşturur */}
        <input type="hidden" name="catalogBrand" value={catalogBrand} />
        {/* Catalog seed image path'leri — multi-value (her catalog image için bir input) */}
        {pendingImages
          .filter((img) => img.source === 'catalog' && img.seedImagePath)
          .map((img) => (
            <input
              key={img.id}
              type="hidden"
              name="seedImagePaths"
              value={img.seedImagePath ?? ''}
            />
          ))}

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
                  htmlFor="parentCategoryId"
                >
                  Üst kategori
                </label>
                <select
                  id="parentCategoryId"
                  name="parentCategoryId"
                  data-testid="parent-category-select"
                  disabled={pending}
                  value={parentCategoryId}
                  onChange={(e) => {
                    setParentCategoryId(e.target.value);
                    // Üst değişince alt seçimi temizle (yanlış parent altında kalmasın)
                    setCategoryId('');
                  }}
                  className="w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
                >
                  <option value="">— Seç —</option>
                  {rootCategories.map((c) => (
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
                  htmlFor="categoryId"
                >
                  Alt kategori
                </label>
                <select
                  id="categoryId"
                  name="categoryId"
                  data-testid="child-category-select"
                  disabled={pending || !parentCategoryId}
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-3 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15 disabled:opacity-50"
                >
                  <option value="">
                    {parentCategoryId ? '— Seç —' : 'Önce üst kategori seç'}
                  </option>
                  {childCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji ? `${c.emoji} ` : ''}
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
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

            {/* Ürün görselleri — multi-image, her görselde ✕ iptal butonu */}
            <div className="border-t border-line pt-4">
              <label
                className="mb-1.5 block text-[13px] font-bold uppercase tracking-wider text-ink-3"
                htmlFor="productImage"
              >
                📷 Ürün görselleri ({pendingImages.length})
              </label>

              <input
                ref={fileInputRef}
                id="productImage"
                name="productImage"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={pending}
                onChange={handleImageChange}
                data-testid="product-image-input"
                className="block w-full text-sm text-ink-3 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-cat-soft file:px-4 file:py-2 file:text-sm file:font-bold file:text-cat-7 hover:file:bg-cat/20 disabled:opacity-60"
              />
              <p className="mt-1.5 text-xs text-ink-3">
                JPG / PNG / WebP — max 5 MB / dosya · birden fazla dosya seçebilirsin · ilk görsel ana görsel olur.
              </p>
              {/* Multi-image grid — her thumb'ın sağ üstünde ✕ iptal butonu */}
              {pendingImages.length > 0 && (
                <ul
                  data-testid="pending-images-grid"
                  className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4"
                >
                  {pendingImages.map((img, idx) => (
                    <li
                      key={img.id}
                      data-testid={`pending-image-${img.source}`}
                      className={
                        idx === 0
                          ? 'group relative aspect-square overflow-hidden rounded-xl border-2 border-cat bg-line-soft shadow-[var(--shadow-cat)]'
                          : 'group relative aspect-square overflow-hidden rounded-xl border border-line bg-line-soft'
                      }
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={img.name}
                        className="h-full w-full object-cover"
                      />
                      {/* Primary badge */}
                      {idx === 0 && (
                        <span className="absolute left-1 top-1 rounded-full bg-cat px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                          ★ Ana
                        </span>
                      )}
                      {/* Catalog kaynağı badge */}
                      {img.source === 'catalog' && (
                        <span className="absolute bottom-1 left-1 rounded-full bg-arrow/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                          📷 Katalog
                        </span>
                      )}
                      {/* ✕ Remove button — daima görünür sağ üst */}
                      <button
                        type="button"
                        onClick={() => removeImage(img.id)}
                        disabled={pending}
                        data-testid={`pending-image-remove-${img.id}`}
                        aria-label={`${img.name} görselini kaldır`}
                        className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-danger/95 text-sm font-bold text-white shadow-md transition-transform hover:scale-110 active:scale-95 disabled:opacity-60"
                      >
                        ✕
                      </button>
                      {/* Dosya adı — alt overlay */}
                      <div className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 py-1 text-[10px] font-bold text-white">
                        {img.name}
                      </div>
                    </li>
                  ))}
                </ul>
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

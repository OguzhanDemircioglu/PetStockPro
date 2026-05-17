'use client';

import { useActionState, useState, useTransition } from 'react';
import {
  createVariantAction,
  updateVariantAction,
  deleteVariantAction,
  setDefaultVariantAction,
  type VariantActionState,
} from './variant-actions';
import type { VariantListItem, BranchOption } from '@/lib/catalog/variants';

interface Props {
  productId: string;
  variants: VariantListItem[];
  branches: BranchOption[];
}

export function VariantsSection({ productId, variants, branches }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  return (
    <section className="rounded-2xl border border-line bg-paper p-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-cart">📋 Variantlar</h2>
          <p className="mt-1 text-xs text-ink-3">
            Aynı ürünün farklı boyut/ambalajları. Tek default variant olmak zorunda.
          </p>
        </div>
        {!addingNew && (
          <button
            type="button"
            onClick={() => {
              setAddingNew(true);
              setEditingId(null);
            }}
            className="rounded-xl border border-cat/40 bg-cat-soft px-4 py-2 text-xs font-bold text-cart hover:bg-cat/15"
          >
            + Yeni variant
          </button>
        )}
      </header>

      <div className="mt-5 flex flex-col gap-3">
        {addingNew && (
          <CreateVariantRow
            productId={productId}
            branches={branches}
            onDone={() => setAddingNew(false)}
          />
        )}

        {variants.length === 0 && !addingNew && (
          <p className="rounded-xl border border-dashed border-line bg-line-soft px-4 py-6 text-center text-xs text-ink-3">
            Henüz variant yok.
          </p>
        )}

        {variants.map((variant) => (
          <VariantRow
            key={variant.id}
            productId={productId}
            variant={variant}
            branches={branches}
            isEditing={editingId === variant.id}
            onEdit={() => {
              setEditingId(variant.id);
              setAddingNew(false);
            }}
            onCancel={() => setEditingId(null)}
            canDelete={
              !variant.isDefault &&
              variants.filter((v) => v.isActive).length > 1
            }
          />
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// CREATE ROW (yeni variant inline form)
// ─────────────────────────────────────────────────────────────────

function CreateVariantRow({
  productId,
  branches,
  onDone,
}: {
  productId: string;
  branches: BranchOption[];
  onDone: () => void;
}) {
  const boundCreate = createVariantAction.bind(null, productId);
  const [state, formAction, pending] = useActionState<VariantActionState | null, FormData>(
    boundCreate,
    null,
  );

  // Başarılı create sonrası kapat
  if (state?.ok && state.scope === 'create') {
    queueMicrotask(onDone);
  }

  return (
    <form
      action={formAction}
      className="rounded-xl border-2 border-cat/40 bg-cat-soft/30 p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-cart">➕ Yeni variant</h3>
        <button
          type="button"
          onClick={onDone}
          className="text-xs text-ink-3 hover:text-cart"
        >
          ✕ Vazgeç
        </button>
      </div>

      <VariantFormFields branches={branches} />

      {state?.message && !state.ok && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-xs font-bold text-danger-7"
        >
          {state.message}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-gradient-to-br from-cat to-cat-2 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
        >
          {pending ? 'Ekleniyor...' : 'Variant ekle'}
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────
// VARIANT ROW (display + edit modu)
// ─────────────────────────────────────────────────────────────────

function VariantRow({
  productId,
  variant,
  branches,
  isEditing,
  onEdit,
  onCancel,
  canDelete,
}: {
  productId: string;
  variant: VariantListItem;
  branches: BranchOption[];
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  canDelete: boolean;
}) {
  if (isEditing) {
    return (
      <EditVariantRow
        productId={productId}
        variant={variant}
        branches={branches}
        onDone={onCancel}
      />
    );
  }

  return (
    <DisplayVariantRow
      productId={productId}
      variant={variant}
      canDelete={canDelete}
      onEdit={onEdit}
    />
  );
}

function DisplayVariantRow({
  productId,
  variant,
  canDelete,
  onEdit,
}: {
  productId: string;
  variant: VariantListItem;
  canDelete: boolean;
  onEdit: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const handleSetDefault = () => {
    setActionMessage(null);
    startTransition(async () => {
      const result = await setDefaultVariantAction(productId, variant.id);
      if (!result.ok && result.message) setActionMessage(result.message);
    });
  };

  const handleDelete = () => {
    if (!confirm(`"${variant.valueLabel}" variantını sil?`)) return;
    setActionMessage(null);
    startTransition(async () => {
      const result = await deleteVariantAction(productId, variant.id);
      if (!result.ok && result.message) setActionMessage(result.message);
    });
  };

  const branchThresholdCount = variant.branchThresholds
    ? Object.keys(variant.branchThresholds).length
    : 0;

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border bg-paper p-4 sm:flex-row sm:items-center sm:justify-between ${
        !variant.isActive
          ? 'border-line opacity-60'
          : variant.isDefault
          ? 'border-cat/40 bg-cat-soft/20'
          : 'border-line'
      }`}
      data-variant-id={variant.id}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-bold text-ink">{variant.valueLabel}</span>
          {variant.isDefault && (
            <span className="rounded-full bg-cat px-2 py-0.5 text-[11.5px] font-bold uppercase tracking-wider text-white">
              ★ Default
            </span>
          )}
          {!variant.isActive && (
            <span className="rounded-full bg-line-soft px-2 py-0.5 text-[11.5px] font-bold text-ink-4">
              Pasif
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
          <span className="font-mono">SKU {variant.sku}</span>
          {variant.barcode && <span className="font-mono">BC {variant.barcode}</span>}
          <span>
            <strong className="text-cart">{variant.salePrice}₺</strong> · alış{' '}
            {variant.costPrice}₺
          </span>
          <span>
            Eşik {variant.threshold}
            {branchThresholdCount > 0 && (
              <span className="ml-1 text-[11.5px] text-cat">
                (+{branchThresholdCount} şube)
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!variant.isDefault && variant.isActive && (
          <button
            type="button"
            onClick={handleSetDefault}
            disabled={pending}
            className="rounded-lg border border-cat/30 bg-paper px-3 py-1.5 text-[12.5px] font-bold text-cart hover:bg-cat-soft disabled:opacity-50"
          >
            ★ Default yap
          </button>
        )}
        <button
          type="button"
          onClick={onEdit}
          disabled={pending}
          className="rounded-lg border border-line bg-paper px-3 py-1.5 text-[12.5px] font-bold text-ink-2 hover:bg-line-soft disabled:opacity-50"
        >
          ✎ Düzenle
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="rounded-lg border border-danger/30 bg-paper px-3 py-1.5 text-[12.5px] font-bold text-danger-7 hover:bg-danger-soft disabled:opacity-50"
          >
            🗑 Sil
          </button>
        )}
      </div>

      {actionMessage && (
        <p
          role="alert"
          className="basis-full rounded-lg bg-danger-soft px-3 py-1.5 text-xs font-bold text-danger-7"
        >
          {actionMessage}
        </p>
      )}
    </div>
  );
}

function EditVariantRow({
  productId,
  variant,
  branches,
  onDone,
}: {
  productId: string;
  variant: VariantListItem;
  branches: BranchOption[];
  onDone: () => void;
}) {
  const boundUpdate = updateVariantAction.bind(null, productId, variant.id);
  const [state, formAction, pending] = useActionState<VariantActionState | null, FormData>(
    boundUpdate,
    null,
  );

  if (state?.ok && state.scope === 'update') {
    queueMicrotask(onDone);
  }

  return (
    <form
      action={formAction}
      className="rounded-xl border-2 border-ink/20 bg-paper p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-cart">✎ Variant düzenle</h3>
        <button
          type="button"
          onClick={onDone}
          className="text-xs text-ink-3 hover:text-cart"
        >
          ✕ Vazgeç
        </button>
      </div>

      <VariantFormFields
        initial={variant}
        branches={branches}
        editing
      />

      {state?.message && !state.ok && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-xs font-bold text-danger-7"
        >
          {state.message}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-gradient-to-br from-cat to-cat-2 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
        >
          {pending ? 'Kaydediliyor...' : 'Değişiklikleri kaydet'}
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────
// SHARED FORM FIELDS
// ─────────────────────────────────────────────────────────────────

function VariantFormFields({
  initial,
  branches,
  editing = false,
}: {
  initial?: VariantListItem;
  branches: BranchOption[];
  editing?: boolean;
}) {
  const [branchThresholds, setBranchThresholds] = useState<Record<string, number>>(
    initial?.branchThresholds ?? {},
  );

  const handleBranchThresholdChange = (branchId: string, value: string) => {
    const parsed = parseInt(value, 10);
    setBranchThresholds((prev) => {
      const next = { ...prev };
      if (Number.isFinite(parsed) && parsed >= 0) {
        next[branchId] = parsed;
      } else {
        delete next[branchId];
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[12px] font-bold uppercase tracking-wider text-ink-3">
            Boyut/ambalaj *
          </label>
          <input
            name="valueLabel"
            type="text"
            required
            defaultValue={initial?.valueLabel ?? ''}
            placeholder="2kg"
            className="w-full rounded-lg border-[1.5px] border-line bg-paper px-3 py-2 text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-bold uppercase tracking-wider text-ink-3">
            SKU *
          </label>
          <input
            name="sku"
            type="text"
            required
            defaultValue={initial?.sku ?? ''}
            placeholder="ROY-CAT-2KG"
            className="w-full rounded-lg border-[1.5px] border-line bg-paper px-3 py-2 font-mono text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[12px] font-bold uppercase tracking-wider text-ink-3">
          Barkod
        </label>
        <input
          name="barcode"
          type="text"
          maxLength={13}
          defaultValue={initial?.barcode ?? ''}
          placeholder="8690000000000"
          className="w-full rounded-lg border-[1.5px] border-line bg-paper px-3 py-2 font-mono text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="mb-1 block text-[12px] font-bold uppercase tracking-wider text-ink-3">
            Alış (₺)
          </label>
          <input
            name="costPrice"
            type="text"
            inputMode="decimal"
            defaultValue={initial?.costPrice ?? '0'}
            className="w-full rounded-lg border-[1.5px] border-line bg-paper px-3 py-2 font-mono text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-bold uppercase tracking-wider text-ink-3">
            Satış (₺) *
          </label>
          <input
            name="salePrice"
            type="text"
            inputMode="decimal"
            required
            defaultValue={initial?.salePrice ?? ''}
            className="w-full rounded-lg border-[1.5px] border-cat bg-paper px-3 py-2 font-mono text-sm font-bold text-cart focus:outline-none focus:ring-4 focus:ring-cat/15"
          />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-bold uppercase tracking-wider text-ink-3">
            Eşik
          </label>
          <input
            name="threshold"
            type="number"
            min={0}
            max={9999}
            defaultValue={initial?.threshold ?? 5}
            className="w-full rounded-lg border-[1.5px] border-line bg-paper px-3 py-2 font-mono text-sm text-ink focus:border-cat focus:outline-none focus:ring-4 focus:ring-cat/15"
          />
        </div>
      </div>

      {editing && initial && (
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2 text-xs text-ink-2">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={initial.isActive}
            className="h-4 w-4 accent-cat"
          />
          <span>
            <strong className="text-cart">Aktif</strong> — pasif variant satış kaydında seçilemez
          </span>
        </label>
      )}

      {branches.length > 0 && (
        <details className="rounded-lg border border-line bg-paper p-3" open={Object.keys(branchThresholds).length > 0}>
          <summary className="cursor-pointer text-xs font-bold text-cart">
            🏪 Şube bazlı eşik (opsiyonel)
            <span className="ml-2 font-normal text-ink-3">
              — boş bırak, genel eşik kullanılır
            </span>
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {branches.map((branch) => (
              <div key={branch.id} className="flex items-center gap-2">
                <span className="flex-1 truncate text-xs text-ink-2">{branch.name}</span>
                <input
                  type="number"
                  min={0}
                  max={9999}
                  value={branchThresholds[branch.id] ?? ''}
                  onChange={(e) =>
                    handleBranchThresholdChange(branch.id, e.target.value)
                  }
                  placeholder="—"
                  className="w-20 rounded border-[1.5px] border-line bg-paper px-2 py-1 font-mono text-xs text-ink focus:border-cat focus:outline-none"
                />
              </div>
            ))}
          </div>
          <input
            type="hidden"
            name="branchThresholds"
            value={JSON.stringify(branchThresholds)}
          />
        </details>
      )}
    </div>
  );
}

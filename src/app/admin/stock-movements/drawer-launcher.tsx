'use client';

import { useState } from 'react';
import type {
  BranchOption,
  VariantOption,
  SupplierOption,
} from '@/lib/stock/options';
import { StockInDrawer } from './stock-in-drawer';
import { StockOutDrawer } from './stock-out-drawer';
import { TransferDrawer } from './transfer-drawer';

type DrawerKind = 'stock_in' | 'stock_out' | 'transfer' | null;

interface Props {
  branches: BranchOption[];
  variants: VariantOption[];
  suppliers: SupplierOption[];
}

export function DrawerLauncher({ branches, variants, suppliers }: Props) {
  const [open, setOpen] = useState<DrawerKind>(null);

  const disabled = branches.length === 0 || variants.length === 0;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <LaunchButton
          onClick={() => setOpen('stock_in')}
          disabled={disabled}
          className="bg-arrow text-white hover:bg-arrow-2"
          testid="open-stock-in"
        >
          📥 Stok Girişi
        </LaunchButton>
        <LaunchButton
          onClick={() => setOpen('stock_out')}
          disabled={disabled}
          className="bg-cat text-white hover:bg-cat-2"
          testid="open-stock-out"
        >
          📤 Çıkış / Satış
        </LaunchButton>
        <LaunchButton
          onClick={() => setOpen('transfer')}
          disabled={disabled || branches.length < 2}
          className="border-2 border-line bg-white text-cart hover:bg-line-soft"
          title={
            branches.length < 2
              ? 'Transfer için en az 2 şube gerekli'
              : undefined
          }
          testid="open-transfer"
        >
          🔁 Transfer
        </LaunchButton>
      </div>

      {open === 'stock_in' && (
        <StockInDrawer
          branches={branches}
          variants={variants}
          suppliers={suppliers}
          onClose={() => setOpen(null)}
        />
      )}
      {open === 'stock_out' && (
        <StockOutDrawer
          branches={branches}
          variants={variants}
          onClose={() => setOpen(null)}
        />
      )}
      {open === 'transfer' && (
        <TransferDrawer
          branches={branches}
          variants={variants}
          onClose={() => setOpen(null)}
        />
      )}

      {disabled && (
        <p className="basis-full rounded-lg bg-line-soft px-3 py-2 text-xs text-ink-3">
          Önce en az 1 şube ve 1 ürün ekle.
        </p>
      )}
    </>
  );
}

function LaunchButton({
  children,
  onClick,
  disabled,
  className,
  title,
  testid,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className: string;
  title?: string;
  testid: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      data-testid={testid}
      className={`rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm transition-transform hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${className}`}
    >
      {children}
    </button>
  );
}

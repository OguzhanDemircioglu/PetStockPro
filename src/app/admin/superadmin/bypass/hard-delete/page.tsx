import Link from 'next/link';
import { requireSuperadmin } from '@/lib/superadmin/access';
import { HardDeleteForm } from './form';

export default async function HardDeleteBypassPage() {
  await requireSuperadmin();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header>
        <Link href={'/admin/products' as never} className="text-xs text-ink-4 hover:text-cart">
          ← Ürünler
        </Link>
        <div className="mt-3 text-[13px] font-bold uppercase tracking-wider text-cat">
          🛡 Süperadmin · Bypass
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          🗑 Hard delete ürün
        </h1>
        <p className="mt-1 text-sm text-ink-3">
          Soft-delete edilmiş bir ürünü DB&apos;den gerçekten kaldır.
          Variant + image + branch_inventory cascade silinir.
          <strong> Stok hareketi varsa reddedilir</strong> (immutable ledger korunur).
        </p>
      </header>

      <div
        role="alert"
        className="rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger-7"
      >
        🚨 <strong>Geri alınamaz — audit damga.</strong> Önce ürün soft-delete edilmiş olmalı
        (products.deletedAt NOT NULL). Hard delete sonrası varyantlar/görseller de gider.
        Stok_movements satırı varsa otomatik reddedilir.
      </div>

      <HardDeleteForm />

      <p className="text-center text-[12.5px] text-ink-4">
        Audit log&apos;da bu aksiyon <code>superadmin.bypass.hard_delete</code> olarak görünür.
      </p>
    </main>
  );
}

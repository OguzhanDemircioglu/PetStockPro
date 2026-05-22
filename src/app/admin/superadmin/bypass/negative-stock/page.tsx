import Link from 'next/link';
import { requireSuperadmin } from '@/lib/superadmin/access';
import { NegativeStockForm } from './form';

export default async function NegativeStockBypassPage() {
  await requireSuperadmin();
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header>
        <Link href={'/admin/stock-movements' as never} className="text-xs text-ink-4 hover:text-cart">
          ← Stok hareketleri
        </Link>
        <div className="mt-3 text-[13px] font-bold uppercase tracking-wider text-cat">
          🛡 Süperadmin · Bypass
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          ⛔ Eksi stoğa zorla giriş
        </h1>
        <p className="mt-1 text-sm text-ink-3">
          Normalde stock-out işlemi <code>newQty &lt; 0</code> olunca reddedilir.
          Süperadmin bu kontrolü bypass eder — branch_inventory negatif değere yazılır.
        </p>
      </header>

      <div
        role="alert"
        className="rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger-7"
      >
        🚨 <strong>Veri tutarsızlığı yaratabilir.</strong> Sadece muhasebe-fiziksel
        uyumsuzluk düzeltmesi için kullan. Audit log&apos;da süperadmin damgalı.
      </div>

      <NegativeStockForm />

      <p className="text-center text-[12.5px] text-ink-4">
        Audit log&apos;da bu aksiyon <code>superadmin.bypass.negative_stock</code> olarak görünür.
      </p>
    </main>
  );
}

import Link from 'next/link';
import { requireSuperadmin } from '@/lib/superadmin/access';
import { StocktakeUndoForm } from './form';

export default async function StocktakeUndoBypassPage() {
  await requireSuperadmin();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header>
        <Link href={'/admin/stocktake' as never} className="text-xs text-ink-4 hover:text-cart">
          ← Sayımlar
        </Link>
        <div className="mt-3 text-[13px] font-bold uppercase tracking-wider text-cat">
          🛡 Süperadmin · Bypass
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          🔄 Sayım rollback
        </h1>
        <p className="mt-1 text-sm text-ink-3">
          Tamamlanmış bir sayımın oluşturduğu tüm stok hareketlerini geri al
          ve sayım durumunu <code>cancelled</code> olarak işaretle.
        </p>
      </header>

      <div
        role="alert"
        className="rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger-7"
      >
        🚨 <strong>Sadece &apos;completed&apos; sayımlar.</strong> Her movement
        süperadmin bypass ile geri alınır (24h pencere yok). Audit log&apos;da
        her reverse satırı görünür. Aynı sayım iki kez rollback edilemez
        (movements&apos;lar zaten reversed olur).
      </div>

      <StocktakeUndoForm />

      <p className="text-center text-[12.5px] text-ink-4">
        Audit log&apos;da bu aksiyon <code>superadmin.bypass.stocktake_rollback</code> olarak görünür.
      </p>
    </main>
  );
}

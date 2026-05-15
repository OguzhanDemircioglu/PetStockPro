import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { listStockMovements } from '@/lib/stock/list';
import {
  listBranchOptions,
  listVariantOptions,
  listSupplierOptions,
} from '@/lib/stock/options';
import { MovementsTable } from './movements-table';
import { DrawerLauncher } from './drawer-launcher';

export default async function StockMovementsPage() {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const [movements, branches, variants, suppliers] = await Promise.all([
    listStockMovements(session.user.companyId, db, { limit: 100 }),
    listBranchOptions(session.user.companyId, db),
    listVariantOptions(session.user.companyId, db),
    listSupplierOptions(session.user.companyId, db),
  ]);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11.5px] font-bold uppercase tracking-wider text-cat">
            Admin · Stok Hareketleri
          </div>
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
            Ledger
          </h1>
          <p className="mt-1 text-sm text-ink-3">
            {movements.length === 100
              ? 'Son 100 hareket'
              : `${movements.length} hareket`}{' '}
            · Append-only — düzenleme yok, geri alma Sprint 4.5&apos;te
          </p>
        </div>
        <DrawerLauncher
          branches={branches}
          variants={variants}
          suppliers={suppliers}
        />
      </header>

      {movements.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-line bg-paper py-16 text-center">
          <div className="text-6xl">📦</div>
          <h2 className="mt-4 text-xl font-bold text-cart">Henüz hareket yok</h2>
          <p className="mt-2 text-sm text-ink-3">
            Stok giriş yaparak başla — sağ üstten <strong>Yeni Hareket</strong>.
          </p>
        </div>
      ) : (
        <MovementsTable movements={movements} />
      )}

      <Link
        href={'/' as never}
        className="text-center text-xs text-ink-4 hover:text-cart"
      >
        ← Panele dön
      </Link>
    </main>
  );
}

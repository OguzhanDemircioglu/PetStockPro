import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth/auth';
import { withTenant } from '@/lib/db/with-tenant';
import { listStockMovements, countStockMovements } from '@/lib/stock/list';
import {
  listBranchOptions,
  listVariantOptions,
  listSupplierOptions,
} from '@/lib/stock/options';
import { parsePagination, buildPageMeta } from '@/lib/utils/pagination';
import { Paginator } from '@/components/paginator';
import { MovementsTable } from './movements-table';
import { DrawerLauncher } from './drawer-launcher';
import { MovementsFilterBar } from './movements-filter-bar';

const VALID_TYPES = [
  'stock_in',
  'stock_out',
  'transfer',
  'stocktake',
  'stocktake_initial',
] as const;
type MovementType = (typeof VALID_TYPES)[number];

export default async function StockMovementsPage({
  searchParams,
}: {
  searchParams: Promise<{
    branch?: string;
    variant?: string;
    type?: string;
    openTransfer?: string;
    from?: string;
    to?: string;
    qty?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);
  const companyId = session.user.companyId;

  const params = await searchParams;
  const typeFilter =
    params.type && (VALID_TYPES as readonly string[]).includes(params.type)
      ? (params.type as MovementType)
      : undefined;

  // Transfer drawer auto-open (düşük stok sayfasından öneriyle gelinince)
  const autoOpenTransfer = params.openTransfer === '1';
  const transferInitial = autoOpenTransfer
    ? {
        sourceBranchId: params.from || undefined,
        targetBranchId: params.to || undefined,
        variantId: params.variant || undefined,
        quantity: params.qty ? parseInt(params.qty, 10) || undefined : undefined,
      }
    : undefined;

  const pagination = parsePagination({ page: params.page, pageSize: params.pageSize });
  const filterOpts = {
    branchId: params.branch,
    variantId: params.variant,
    type: typeFilter,
  };

  const [movements, totalRows, branches, variants, suppliers] = await withTenant(
    companyId,
    (tx) =>
      Promise.all([
        listStockMovements(companyId, tx, {
          ...filterOpts,
          limit: pagination.limit,
          offset: pagination.offset,
        }),
        countStockMovements(companyId, tx, filterOpts),
        listBranchOptions(companyId, tx),
        listVariantOptions(companyId, tx),
        listSupplierOptions(companyId, tx),
      ]),
  );

  const pageMeta = buildPageMeta(pagination, totalRows);
  const paginatorSearchParams = new URLSearchParams();
  if (params.branch) paginatorSearchParams.set('branch', params.branch);
  if (params.variant) paginatorSearchParams.set('variant', params.variant);
  if (params.type) paginatorSearchParams.set('type', params.type);

  const activeFilter = !!(params.branch || params.variant || params.type);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[13px] font-bold uppercase tracking-wider text-cat">
            Admin · Stok Hareketleri
          </div>
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
            Ledger
          </h1>
          <p className="mt-1 text-sm text-ink-3">
            {pageMeta.totalRows === 0
              ? 'Hareket yok'
              : `${pageMeta.fromRow}-${pageMeta.toRow} / ${pageMeta.totalRows} hareket`}{' '}
            · Append-only — düzenleme yok, geri alma 24 saatlik kuralda
          </p>
        </div>
        <DrawerLauncher
          branches={branches}
          variants={variants}
          suppliers={suppliers}
          autoOpen={autoOpenTransfer ? 'transfer' : null}
          transferInitial={transferInitial}
        />
      </header>

      <MovementsFilterBar
        branches={branches}
        variants={variants}
        initial={{
          branch: params.branch ?? '',
          variant: params.variant ?? '',
          type: params.type ?? '',
        }}
      />

      {movements.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-line bg-paper py-16 text-center">
          <div className="text-6xl">📦</div>
          <h2 className="mt-4 text-xl font-bold text-cart">
            {activeFilter ? 'Filtreye uyan hareket yok' : 'Henüz hareket yok'}
          </h2>
          <p className="mt-2 text-sm text-ink-3">
            {activeFilter
              ? 'Filtreleri temizle veya farklı bir kriter dene.'
              : 'Stok giriş yaparak başla — sağ üstten Yeni Hareket.'}
          </p>
          {activeFilter && (
            <Link
              href={'/admin/stock-movements' as never}
              className="mt-6 inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-4 py-2 text-xs font-bold text-ink-3 hover:bg-line-soft"
            >
              × Filtreyi temizle
            </Link>
          )}
        </div>
      ) : (
        <MovementsTable movements={movements} />
      )}

      <Paginator
        basePath="/admin/stock-movements"
        searchParams={paginatorSearchParams}
        meta={pageMeta}
        noun="hareket"
      />

      <Link
        href={'/' as never}
        className="text-center text-xs text-ink-4 hover:text-cart"
      >
        ← Panele dön
      </Link>
    </main>
  );
}

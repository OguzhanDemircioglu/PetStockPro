import Link from 'next/link';
import { requireSuperadmin } from '@/lib/superadmin/access';
import { MetadataFixForm } from './form';

export default async function MetadataFixBypassPage() {
  await requireSuperadmin();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      <header>
        <Link href={'/admin/stock-movements' as never} className="text-xs text-ink-4 hover:text-cart">
          ← Stok hareketleri
        </Link>
        <div className="mt-3 text-[11.5px] font-bold uppercase tracking-wider text-cat">
          🛡 Süperadmin · Bypass
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          ✎ Movement metadata düzelt
        </h1>
        <p className="mt-1 text-sm text-ink-3">
          Immutable ledger&apos;daki bir hareketin metadata alanlarını (sebep,
          not, müşteri ref, doküman no) düzelt. <strong>Quantity ASLA değiştirilemez</strong> —
          o gerçekten gerçekleşmiş bir olay, sadece açıklaması düzeltilebilir.
        </p>
      </header>

      <div
        role="alert"
        className="rounded-xl border border-cat/30 bg-cat-soft px-4 py-3 text-sm text-ink-2"
      >
        ℹ Bu, ledger&apos;ın <code>immutable</code> doğasını ihlal etmez. Quantity,
        before/after, type/subtype, branch, variant, createdAt alanlarına dokunulmaz.
        Sadece metin alanları (typo düzeltme, eksik doküman no ekleme). Audit log&apos;da
        before/after snapshot ve değişen alan listesi tutulur.
      </div>

      <MetadataFixForm />

      <p className="text-center text-[11px] text-ink-4">
        Audit log&apos;da bu aksiyon <code>superadmin.bypass.metadata_fix</code> olarak görünür.
      </p>
    </main>
  );
}

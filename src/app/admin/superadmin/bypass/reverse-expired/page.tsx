import Link from 'next/link';
import { requireSuperadmin } from '@/lib/superadmin/access';
import { ReverseExpiredForm } from './form';

export default async function ReverseExpiredBypassPage() {
  await requireSuperadmin();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      <header>
        <Link
          href={'/admin/stock-movements' as never}
          className="text-xs text-ink-4 hover:text-cart"
        >
          ← Stok hareketleri
        </Link>
        <div className="mt-3 text-[11.5px] font-bold uppercase tracking-wider text-cat">
          🛡 Süperadmin · Bypass
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          ↶ 24h+ hareket geri al
        </h1>
        <p className="mt-1 text-sm text-ink-3">
          Süresi geçmiş bir stok hareketini reverse et. Normalde 24 saat sonra
          geri alma engellenir, süperadmin bu kısıtı bypass eder.
        </p>
      </header>

      <div
        role="alert"
        className="rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger-7"
      >
        🚨 <strong>Hassas aksiyon — audit damga.</strong> Hareket ID + şifre re-auth +
        zorunlu sebep gerekli. Reverse edilen hareket için yeni bir karşı-hareket
        oluşturulur (immutable ledger korunur).
      </div>

      <ReverseExpiredForm />

      <p className="text-center text-[11px] text-ink-4">
        Audit log&apos;da bu aksiyon <code>superadmin.bypass.reverse_expired</code>{' '}
        olarak görünür (performedAsSuperadmin=true + reason).
      </p>
    </main>
  );
}

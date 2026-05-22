import Link from 'next/link';
import { requireSuperadmin } from '@/lib/superadmin/access';
import { DbInspectorClient } from './inspector-client';

export default async function DbInspectorPage() {
  await requireSuperadmin();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header>
        <Link href={'/admin/superadmin' as never} className="text-xs text-ink-4 hover:text-cart">
          ← Süperadmin
        </Link>
        <div className="mt-3 text-[13px] font-bold uppercase tracking-wider text-cat">
          🛡 Süperadmin · DB Inspector
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          🔬 DB Inspector
        </h1>
        <p className="mt-1 text-sm text-ink-3">
          Read-only ad-hoc SQL query runner. SELECT (veya WITH/CTE) yazıp çalıştır.
          DML/DDL bloklu — UPDATE/DELETE/DROP/TRUNCATE/ALTER vb. reddedilir.
        </p>
      </header>

      <div
        role="alert"
        className="rounded-xl border border-cat/30 bg-cat-soft px-4 py-3 text-sm text-ink-2"
      >
        ℹ <strong>Güvenlik:</strong> Her query (başarılı + reddedilen) audit
        log&apos;a yazılır. Multiple statement (chain ;) ve forbidden keyword
        otomatik engelliyor. Max 100 satır + 5sn timeout. UPDATE/DELETE modu
        Faz 2 (ek şifre + Telegram + ek audit).
      </div>

      <DbInspectorClient />

      <p className="text-center text-[12.5px] text-ink-4">
        Audit log&apos;da bu aksiyon <code>superadmin.dbinspector.query_run</code>{' '}
        veya <code>.query_failed</code> olarak görünür.
      </p>
    </main>
  );
}

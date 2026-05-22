import Link from 'next/link';
import { requireSuperadmin } from '@/lib/superadmin/access';
import { PlanOverrideForm } from './form';

export default async function PlanOverrideBypassPage() {
  await requireSuperadmin();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header>
        <Link href={'/admin/superadmin' as never} className="text-xs text-ink-4 hover:text-cart">
          ← Süperadmin
        </Link>
        <div className="mt-3 text-[13px] font-bold uppercase tracking-wider text-cat">
          🛡 Süperadmin · Bypass
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          🎫 Plan limit override
        </h1>
        <p className="mt-1 text-sm text-ink-3">
          Bir tenant&apos;ın plan&apos;ını manuel değiştir. Tipik kullanım:
          iyzico webhook gecikmesi + müşteri PRO ödedi ama FREE görünüyor,
          ya da geçici promosyon yükseltme.
        </p>
      </header>

      <div
        role="alert"
        className="rounded-xl border border-cat/30 bg-cat-soft px-4 py-3 text-sm text-ink-2"
      >
        ℹ <strong>Subscription tablosuna dokunulmaz.</strong> Sadece{' '}
        <code>companies.plan</code> değiştirilir. iyzico webhook gerçek ödeme yansıtırsa
        plan tekrar sync olur. Audit log&apos;da süperadmin damgalı.
      </div>

      <PlanOverrideForm />

      <p className="text-center text-[12.5px] text-ink-4">
        Audit log&apos;da bu aksiyon <code>superadmin.bypass.plan_override</code> olarak görünür.
      </p>
    </main>
  );
}

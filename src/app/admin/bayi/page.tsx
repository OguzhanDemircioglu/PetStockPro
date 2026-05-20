import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';

/**
 * /admin/bayi — Bayi Admin (Faz 3) iskeleti.
 *
 * Multi-tenant read-only viewer. Aynı kişinin/işbirliğinin birden fazla
 * pet shop tenant'ı varsa tek dashboard'da izleme. CLAUDE.md §3.9'da
 * tasarlandı.
 *
 * Schema durumu: `BAYI_ADMIN` role enum'da kayıtlı (db/schema/index.ts:40).
 * `bayi_admin_relations` tablo HENÜZ migration'da yok — Faz 3'te eklenecek.
 *
 * Bu placeholder sayfa MVP'de SUPERADMIN tarafından görülebilir;
 * lansman sonrası BAYI_ADMIN rolündeki kullanıcılar için aktive edilecek.
 */
export default async function BayiAdminPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login' as never);
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
      <header>
        <Link
          href={'/admin' as never}
          className="text-xs text-ink-4 hover:text-cart"
        >
          ← Pano
        </Link>
        <div className="mt-3 text-[13px] font-bold uppercase tracking-wider text-cat">
          Admin · Bayi Admin
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          🧑‍💼 Bayi Admin
        </h1>
        <p className="mt-2 text-[14px] text-ink-3">
          Birden fazla pet shop&apos;u izleyen multi-tenant read-only viewer
          — <strong>Faz 3</strong>&apos;te aktive edilecek.
        </p>
      </header>

      <div
        role="status"
        data-testid="bayi-admin-coming-soon"
        className="rounded-2xl border-2 border-arrow/40 bg-arrow-soft/30 p-6"
      >
        <div className="flex items-start gap-4">
          <div className="text-4xl">🚧</div>
          <div className="flex-1">
            <h2 className="text-[18px] font-bold text-arrow-7">
              Faz 3&apos;te geliyor
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
              Bayi Admin rolü, aynı kişinin veya işbirliğinin birden fazla pet
              shop tenant&apos;ı için tek dashboard üzerinden read-only izleme
              imkanı sağlar. MVP&apos;de tek tenant odaklı kalıyoruz — bu özellik
              lansman sonrası talep yoğunluğuna göre öncelikli olarak açılacak.
            </p>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-line bg-paper p-6">
        <h2 className="text-[16px] font-bold text-cart">
          📋 Faz 3 kapsam taslağı
        </h2>
        <ul className="mt-3 flex flex-col gap-2 text-[13.5px] text-ink-2">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-arrow-7">○</span>
            <span>
              <strong>bayi_admin_relations</strong> tablosu: kullanıcı + tenant
              + onay tarihleri + readonly flag
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-arrow-7">○</span>
            <span>
              Çift onay mekanizması — Bayi Admin talep eder, tenant sahibi
              onaylar (her iki taraf imza)
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-arrow-7">○</span>
            <span>
              Multi-tenant dashboard: tüm bağlı pet shop&apos;ların özet KPI
              kartı + tenant switcher
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-arrow-7">○</span>
            <span>
              Read-only gate: BAYI_ADMIN rolü asla CRUD yapamaz (stok hareketi
              dahil), sadece okur
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-arrow-7">○</span>
            <span>
              Ayrı user hesabı (BAYI_SAHIBI ile birleşik değil) — güvenlik
              ayrımı
            </span>
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-line bg-line-soft/40 p-5">
        <h3 className="text-[14px] font-bold text-cart">
          🔗 Referans dokümanlar
        </h3>
        <ul className="mt-2 flex flex-col gap-1 text-[13px] text-ink-2">
          <li>
            <code className="rounded bg-paper px-1 py-0.5 font-mono text-[12px]">
              DATABASE-SCHEMA.md §3.9
            </code>{' '}
            — bayi_admin_relations şema taslağı
          </li>
          <li>
            <code className="rounded bg-paper px-1 py-0.5 font-mono text-[12px]">
              PLAN-KADEMELERI.md §3.2
            </code>{' '}
            — rol matrisi
          </li>
          <li>
            <code className="rounded bg-paper px-1 py-0.5 font-mono text-[12px]">
              EKRAN-SUPERADMIN.md §2.5.4
            </code>{' '}
            — süperadmin panelinde Bayi Admin yönetimi
          </li>
        </ul>
      </section>
    </main>
  );
}

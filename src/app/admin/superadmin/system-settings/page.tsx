import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { requireSuperadmin } from '@/lib/superadmin/access';
import {
  PLAN_LIMITS,
  PLAN_LABELS,
  PLAN_DESCRIPTIONS,
  type PlanKey,
} from '@/lib/constants/plan-limits';
import { VAT_RATE_OPTIONS, DEFAULT_VAT_RATE } from '@/lib/constants/vat-rates';
import { DEFAULT_CATEGORIES } from '@/lib/catalog/default-categories';

interface EnvCheck {
  key: string;
  desc: string;
  present: boolean;
}

function maskValue(present: boolean): string {
  return present ? '✓ Tanımlı' : '⚠ Eksik';
}

async function getDbExtensions() {
  try {
    const rows = (await db.execute(sql`
      SELECT extname, extversion
      FROM pg_extension
      WHERE extname IN ('postgis', 'pg_trgm', 'unaccent', 'moddatetime', 'pg_jsonschema', 'uuid-ossp', 'pgcrypto')
      ORDER BY extname
    `)) as unknown as Array<{ extname: string; extversion: string }>;
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function getTableCount() {
  try {
    const rows = (await db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM pg_tables
      WHERE schemaname = 'petstockpro'
    `)) as unknown as Array<{ count: number }>;
    return rows[0]?.count ?? 0;
  } catch {
    return 0;
  }
}

export default async function SystemSettingsPage() {
  await requireSuperadmin();

  const [extensions, tableCount] = await Promise.all([
    getDbExtensions(),
    getTableCount(),
  ]);

  const envChecks: EnvCheck[] = [
    { key: 'DATABASE_URL', desc: 'Supabase Postgres bağlantısı', present: !!process.env.DATABASE_URL },
    { key: 'BREVO_API_KEY', desc: 'Brevo transactional email', present: !!process.env.BREVO_API_KEY },
    { key: 'TELEGRAM_BOT_TOKEN', desc: 'Telegram alert bot', present: !!process.env.TELEGRAM_BOT_TOKEN },
    { key: 'TELEGRAM_CHAT_ID', desc: 'Süperadmin alert hedef chat', present: !!process.env.TELEGRAM_CHAT_ID },
    { key: 'IYZICO_API_KEY', desc: 'iyzico subscription', present: !!process.env.IYZICO_API_KEY },
    { key: 'IYZICO_WEBHOOK_SECRET', desc: 'iyzico HMAC signature verify', present: !!process.env.IYZICO_WEBHOOK_SECRET },
    { key: 'NILVERA_API_KEY', desc: 'Nilvera e-Arşiv (TR fatura)', present: !!process.env.NILVERA_API_KEY },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', desc: 'Storage upload (image upload bloker)', present: !!process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY !== process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
    { key: 'NEXT_PUBLIC_APP_URL', desc: 'Email link generation base URL', present: !!process.env.NEXT_PUBLIC_APP_URL },
  ];

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12">
      <header>
        <Link href={'/admin/superadmin' as never} className="text-xs text-ink-4 hover:text-cart">
          ← Süperadmin
        </Link>
        <div className="mt-3 text-[11.5px] font-bold uppercase tracking-wider text-cat">
          🛡 Süperadmin · Sistem Ayarları
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-cart">
          ⚙ Sistem Ayarları
        </h1>
        <p className="mt-1 text-sm text-ink-3">
          Read-only sistem bilgi paneli — plan tier&apos;lar, env var kontrolleri,
          DB extension durumu, default kategori listesi, KDV oranları.
          Düzenleme Faz 2 (system_settings tablo + UPDATE mode).
        </p>
      </header>

      <section data-testid="plan-tiers">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
          💳 Plan tier&apos;ları (3-tier B, TR-only)
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {(Object.keys(PLAN_LIMITS) as PlanKey[]).map((k) => {
            const p = PLAN_LIMITS[k];
            const limit = p.productLimit === Infinity ? '∞' : p.productLimit;
            return (
              <article
                key={k}
                data-plan={k}
                className="rounded-2xl border border-line bg-white p-4"
              >
                <div className="text-[11.5px] font-bold uppercase text-cart">
                  {PLAN_LABELS[k]}
                </div>
                <div className="mt-2 font-mono text-3xl font-bold text-cart">
                  {limit}
                </div>
                <div className="mt-1 text-[10.5px] text-ink-3">ürün limiti</div>
                <div className="mt-3 text-[12px] font-bold text-arrow-7">
                  {p.priceMonthlyTry === 0 ? '0₺' : `${p.priceMonthlyTry}₺/ay`}
                </div>
                <div className="text-[10.5px] text-ink-4">KDV dahil</div>
                <p className="mt-2 text-[10.5px] text-ink-3 italic">
                  {PLAN_DESCRIPTIONS[k]}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section data-testid="env-checks">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
          🔑 Environment variable durumu ({envChecks.filter((e) => e.present).length}/{envChecks.length})
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr>
                <th className="border-b-2 border-line bg-paper px-3 py-2 text-left font-bold text-cart">
                  Key
                </th>
                <th className="border-b-2 border-line bg-paper px-3 py-2 text-left font-bold text-cart">
                  Açıklama
                </th>
                <th className="border-b-2 border-line bg-paper px-3 py-2 text-left font-bold text-cart">
                  Durum
                </th>
              </tr>
            </thead>
            <tbody>
              {envChecks.map((e) => (
                <tr key={e.key} className="border-b border-line-soft">
                  <td className="px-3 py-2 font-mono text-[11px] text-cart">{e.key}</td>
                  <td className="px-3 py-2 text-ink-2">{e.desc}</td>
                  <td className={`px-3 py-2 font-bold ${e.present ? 'text-arrow-7' : 'text-danger-7'}`}>
                    {maskValue(e.present)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article data-testid="db-extensions" className="rounded-2xl border border-line bg-white p-4">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
            🗄 DB Extension&apos;ları + Tablo sayısı
          </h2>
          <div className="mb-3 rounded-lg border border-arrow/30 bg-arrow-soft px-3 py-2 text-[11.5px]">
            <strong className="text-arrow-7">{tableCount}</strong> tablo{' '}
            <span className="text-ink-3">(petstockpro schema)</span>
          </div>
          {extensions.length === 0 ? (
            <p className="rounded-lg border border-line bg-paper p-3 text-center text-xs text-ink-3">
              Extension bilgisi çekilemedi.
            </p>
          ) : (
            <ul className="divide-y divide-line-soft text-[11.5px]">
              {extensions.map((e) => (
                <li key={e.extname} className="flex justify-between py-1.5">
                  <code className="text-cart">{e.extname}</code>
                  <span className="text-ink-3">v{e.extversion}</span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article data-testid="vat-rates" className="rounded-2xl border border-line bg-white p-4">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
            💰 KDV oranları (TR 2024+)
          </h2>
          <ul className="divide-y divide-line-soft text-[12px]">
            {VAT_RATE_OPTIONS.map((v) => (
              <li key={v.value} className="flex items-center justify-between py-1.5">
                <span className="font-mono font-bold text-cart">{v.label}</span>
                <span className="text-ink-3 text-[11px]">{v.description}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 rounded-lg border border-cat/30 bg-cat-soft px-3 py-2 text-[10.5px] text-ink-2">
            Default: <strong>%{DEFAULT_VAT_RATE}</strong>. Pet mama %10 özel oran (kuru-mama,
            yaş-mama, ödül-snack kategorileri).
          </p>
        </article>
      </section>

      <section data-testid="default-categories" className="rounded-2xl border border-line bg-white p-4">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
          📂 Default kategoriler ({DEFAULT_CATEGORIES.length}) — her yeni tenant&apos;a otomatik seed
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr>
                <th className="border-b-2 border-line bg-paper px-3 py-2 text-left font-bold text-cart">
                  Emoji
                </th>
                <th className="border-b-2 border-line bg-paper px-3 py-2 text-left font-bold text-cart">
                  İsim
                </th>
                <th className="border-b-2 border-line bg-paper px-3 py-2 text-left font-bold text-cart">
                  Slug
                </th>
                <th className="border-b-2 border-line bg-paper px-3 py-2 text-left font-bold text-cart">
                  KDV
                </th>
                <th className="border-b-2 border-line bg-paper px-3 py-2 text-left font-bold text-cart">
                  SKT
                </th>
                <th className="border-b-2 border-line bg-paper px-3 py-2 text-left font-bold text-cart">
                  Sıra
                </th>
              </tr>
            </thead>
            <tbody>
              {DEFAULT_CATEGORIES.map((c) => (
                <tr key={c.slug} className="border-b border-line-soft">
                  <td className="px-3 py-1.5 text-lg">{c.emoji}</td>
                  <td className="px-3 py-1.5 font-bold text-ink">{c.name}</td>
                  <td className="px-3 py-1.5 font-mono text-[11px] text-ink-3">{c.slug}</td>
                  <td className="px-3 py-1.5 font-mono text-cart">%{c.vatRate}</td>
                  <td className="px-3 py-1.5 text-ink-2">{c.sktRequired ? '✓' : '—'}</td>
                  <td className="px-3 py-1.5 text-ink-3">{c.displayOrder}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-center text-[11px] text-ink-4">
        ⚙ Read-only. Editleme Faz 2 (system_settings tablo + UPDATE mode + audit).
        Plan tier&apos;ları manuel değişiyorsa <code>lib/constants/plan-limits.ts</code> dosyasını güncelle.
      </p>
    </main>
  );
}

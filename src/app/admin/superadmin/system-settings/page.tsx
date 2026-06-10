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
import {
  getSitemapStatus,
  SITEMAP_STALE_THRESHOLD_HOURS,
} from '@/lib/vitrin/sitemap-status';
import { getRetentionStats } from '@/lib/cleanup/retention';

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

  const [extensions, tableCount, sitemapStatus, retentionStats] = await Promise.all([
    getDbExtensions(),
    getTableCount(),
    getSitemapStatus(),
    getRetentionStats(db),
  ]);

  const envChecks: EnvCheck[] = [
    { key: 'DATABASE_URL', desc: 'Supabase Postgres bağlantısı', present: !!process.env.DATABASE_URL },
    { key: 'BREVO_API_KEY', desc: 'Brevo transactional email', present: !!process.env.BREVO_API_KEY },
    { key: 'TELEGRAM_BOT_TOKEN', desc: 'Telegram alert bot', present: !!process.env.TELEGRAM_BOT_TOKEN },
    { key: 'TELEGRAM_CHAT_ID', desc: 'Süperadmin alert hedef chat', present: !!process.env.TELEGRAM_CHAT_ID },
    { key: 'PAYTR_MERCHANT_ID', desc: 'PayTR mağaza no', present: !!process.env.PAYTR_MERCHANT_ID },
    { key: 'PAYTR_MERCHANT_KEY', desc: 'PayTR mağaza parola', present: !!process.env.PAYTR_MERCHANT_KEY },
    { key: 'PAYTR_MERCHANT_SALT', desc: 'PayTR callback hash salt', present: !!process.env.PAYTR_MERCHANT_SALT },
    { key: 'NILVERA_API_KEY', desc: 'Nilvera e-Arşiv (TR fatura)', present: !!process.env.NILVERA_API_KEY },
    { key: 'R2_ACCOUNT_ID', desc: 'Cloudflare R2 storage account', present: !!process.env.R2_ACCOUNT_ID },
    { key: 'R2_ACCESS_KEY_ID', desc: 'R2 API access key (image upload)', present: !!process.env.R2_ACCESS_KEY_ID },
    { key: 'R2_SECRET_ACCESS_KEY', desc: 'R2 API secret (image upload)', present: !!process.env.R2_SECRET_ACCESS_KEY },
    { key: 'R2_BUCKET', desc: 'R2 bucket adı (örn. petstockpro-images)', present: !!process.env.R2_BUCKET },
    { key: 'R2_PUBLIC_URL', desc: 'R2 public delivery URL (pub-xxx.r2.dev veya custom)', present: !!process.env.R2_PUBLIC_URL },
    { key: 'NEXT_PUBLIC_APP_URL', desc: 'Email link generation base URL', present: !!process.env.NEXT_PUBLIC_APP_URL },
  ];

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header>
        <Link href={'/admin/superadmin' as never} className="text-xs text-ink-4 hover:text-cart">
          ← Süperadmin
        </Link>
        <div className="mt-3 text-[13px] font-bold uppercase tracking-wider text-cat">
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
                className="rounded-2xl border border-line bg-paper p-4"
              >
                <div className="text-[13px] font-bold uppercase text-cart">
                  {PLAN_LABELS[k]}
                </div>
                <div className="mt-2 font-mono text-3xl font-bold text-cart">
                  {limit}
                </div>
                <div className="mt-1 text-[12px] text-ink-3">ürün limiti</div>
                <div className="mt-3 text-[13.5px] font-bold text-arrow-7">
                  {p.priceMonthlyTry === 0 ? '0₺' : `${p.priceMonthlyTry}₺/ay`}
                </div>
                <div className="text-[12px] text-ink-4">KDV dahil</div>
                <p className="mt-2 text-[12px] text-ink-3 italic">
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
        <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
          <table className="w-full border-collapse text-[13.5px]">
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
                  <td className="px-3 py-2 font-mono text-[12.5px] text-cart">{e.key}</td>
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
        <article data-testid="db-extensions" className="rounded-2xl border border-line bg-paper p-4">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
            🗄 DB Extension&apos;ları + Tablo sayısı
          </h2>
          <div className="mb-3 rounded-lg border border-arrow/30 bg-arrow-soft px-3 py-2 text-[13px]">
            <strong className="text-arrow-7">{tableCount}</strong> tablo{' '}
            <span className="text-ink-3">(petstockpro schema)</span>
          </div>
          {extensions.length === 0 ? (
            <p className="rounded-lg border border-line bg-paper p-3 text-center text-xs text-ink-3">
              Extension bilgisi çekilemedi.
            </p>
          ) : (
            <ul className="divide-y divide-line-soft text-[13px]">
              {extensions.map((e) => (
                <li key={e.extname} className="flex justify-between py-1.5">
                  <code className="text-cart">{e.extname}</code>
                  <span className="text-ink-3">v{e.extversion}</span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article data-testid="vat-rates" className="rounded-2xl border border-line bg-paper p-4">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
            💰 KDV oranları (TR 2024+)
          </h2>
          <ul className="divide-y divide-line-soft text-[13.5px]">
            {VAT_RATE_OPTIONS.map((v) => (
              <li key={v.value} className="flex items-center justify-between py-1.5">
                <span className="font-mono font-bold text-cart">{v.label}</span>
                <span className="text-ink-3 text-[12.5px]">{v.description}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 rounded-lg border border-cat/30 bg-cat-soft px-3 py-2 text-[12px] text-ink-2">
            Default: <strong>%{DEFAULT_VAT_RATE}</strong>. Pet mama %10 özel oran (kuru-mama,
            yaş-mama, ödül-snack kategorileri).
          </p>
        </article>
      </section>

      <section data-testid="default-categories" className="rounded-2xl border border-line bg-paper p-4">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
          📂 Default kategoriler ({DEFAULT_CATEGORIES.length}) — 6 üst + 43 alt, her yeni tenant&apos;a otomatik seed
        </h2>
        <div className="flex flex-col gap-3">
          {DEFAULT_CATEGORIES.filter((c) => !c.parentSlug).map((root) => {
            const children = DEFAULT_CATEGORIES.filter(
              (c) => c.parentSlug === root.slug,
            );
            return (
              <details
                key={root.slug}
                className="rounded-xl border border-line bg-paper"
                data-root-slug={root.slug}
              >
                <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-[13.5px] font-bold text-cart hover:bg-line-soft">
                  <span aria-hidden className="text-lg">{root.emoji}</span>
                  {root.name}
                  <span className="rounded-full bg-cat-soft px-2 py-0.5 text-[10.5px] text-cart">
                    {children.length} alt
                  </span>
                </summary>
                <table className="w-full border-collapse text-[12.5px]">
                  <thead>
                    <tr>
                      <th className="border-b border-line bg-paper px-3 py-1.5 text-left font-bold text-ink-3">Alt kategori</th>
                      <th className="border-b border-line bg-paper px-3 py-1.5 text-left font-bold text-ink-3">SKT</th>
                      <th className="border-b border-line bg-paper px-3 py-1.5 text-left font-bold text-ink-3">Sıra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {children.map((c) => (
                      <tr key={c.slug} className="border-b border-line-soft">
                        <td className="px-3 py-1.5 font-bold text-ink">
                          {c.emoji} {c.name}
                        </td>
                        <td className="px-3 py-1.5 text-ink-2">{c.sktRequired ? '✓' : '—'}</td>
                        <td className="px-3 py-1.5 text-ink-3">{c.displayOrder}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            );
          })}
        </div>
      </section>

      <section data-testid="sitemap-status">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
          🗺 Sitemap pre-build cache
        </h2>
        <div
          className={`rounded-2xl border bg-paper p-5 ${
            !sitemapStatus.healthy
              ? 'border-danger/40 bg-danger-soft/30'
              : 'border-line'
          }`}
          data-testid="sitemap-status-card"
          data-healthy={sitemapStatus.healthy ? '1' : '0'}
        >
          {!sitemapStatus.cached && (
            <div className="mb-3 rounded-xl border border-cat/30 bg-cat-soft px-3 py-2 text-[13px] font-bold text-cart">
              ℹ Cache henüz oluşmadı — ilk cron tetiklemesini bekliyor.
              SSR fallback aktif, /sitemap.xml dinamik üretiliyor.
            </div>
          )}
          {sitemapStatus.stale && (
            <div className="mb-3 rounded-xl border border-danger/40 bg-danger-soft px-3 py-2 text-[13px] font-bold text-danger-7">
              ⚠ Cache {SITEMAP_STALE_THRESHOLD_HOURS} saatten eski — cron
              tetikleyicisi son rebuild&apos;de fail etmiş olabilir. Telegram
              alert tetiklendi.
            </div>
          )}

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13.5px] sm:grid-cols-3">
            <Stat
              label="Backend"
              value={
                sitemapStatus.cacheBackend === 'r2'
                  ? 'R2 (production)'
                  : sitemapStatus.cacheBackend === 'memory'
                    ? 'in-memory (dev)'
                    : 'yok'
              }
              tone={sitemapStatus.cacheBackend === 'r2' ? 'arrow' : 'ink'}
            />
            <Stat
              label="Cache durumu"
              value={sitemapStatus.cached ? '✓ Dolu' : '— Boş'}
              tone={sitemapStatus.cached ? 'arrow' : 'cat'}
            />
            <Stat
              label="Son rebuild"
              value={
                sitemapStatus.cachedAt
                  ? new Date(sitemapStatus.cachedAt).toLocaleString('tr-TR')
                  : '—'
              }
            />
            <Stat
              label="Yaş"
              value={
                sitemapStatus.ageHours !== null
                  ? `${Math.round(sitemapStatus.ageHours * 10) / 10} saat`
                  : '—'
              }
              tone={sitemapStatus.stale ? 'danger' : 'ink'}
            />
            <Stat
              label="URL adedi"
              value={
                sitemapStatus.urlCount !== null
                  ? sitemapStatus.urlCount.toLocaleString('tr-TR')
                  : '—'
              }
            />
            <Stat
              label="XML boyutu"
              value={
                sitemapStatus.xmlBytes !== null
                  ? `${(sitemapStatus.xmlBytes / 1024).toFixed(1)} KB`
                  : '—'
              }
            />
            <Stat
              label="Cron tetikleyici"
              value={sitemapStatus.cronConfigured ? '✓ Aktif' : '⚠ Yapılandırılmamış'}
              tone={sitemapStatus.cronConfigured ? 'arrow' : 'cat'}
            />
            <Stat
              label="R2 binding"
              value={sitemapStatus.r2Configured ? '✓ Aktif' : '⚠ Yapılandırılmamış'}
              tone={sitemapStatus.r2Configured ? 'arrow' : 'cat'}
            />
          </dl>

          <p className="mt-4 text-[12px] text-ink-4">
            Cron 03:00 UTC (06:00 TR) günlük çalışır. Fail durumunda
            Telegram bildirimi gönderilir. 50K+ URL&apos;de cache-first
            switch aktive olur (Faz 2).
          </p>
        </div>
      </section>

      <section data-testid="log-retention">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
          🧹 Log retention (Faz 2.A)
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="border-b-2 border-line bg-paper px-3 py-2 text-left font-bold text-cart">Tablo</th>
                <th className="border-b-2 border-line bg-paper px-3 py-2 text-left font-bold text-cart">TTL</th>
                <th className="border-b-2 border-line bg-paper px-3 py-2 text-left font-bold text-cart">Açıklama</th>
                <th className="border-b-2 border-line bg-paper px-3 py-2 text-right font-bold text-cart">Satır</th>
                <th className="border-b-2 border-line bg-paper px-3 py-2 text-left font-bold text-cart">En eski</th>
                <th className="border-b-2 border-line bg-paper px-3 py-2 text-left font-bold text-cart">Durum</th>
              </tr>
            </thead>
            <tbody>
              {retentionStats.map((r) => (
                <tr key={r.table} className="border-b border-line-soft">
                  <td className="px-3 py-2 font-mono text-[12.5px] text-cart">{r.table}</td>
                  <td className="px-3 py-2 text-ink-2">{r.ageDays} gün</td>
                  <td className="px-3 py-2 text-ink-3">{r.description}</td>
                  <td className="px-3 py-2 text-right font-bold text-ink">
                    {r.rowCount.toLocaleString('tr-TR')}
                  </td>
                  <td className="px-3 py-2 text-ink-4 text-[12px]">
                    {r.oldestCreatedAt
                      ? new Date(r.oldestCreatedAt).toLocaleDateString('tr-TR')
                      : '—'}
                  </td>
                  <td className={`px-3 py-2 font-bold ${r.hasExpired ? 'text-cat' : 'text-arrow-7'}`}>
                    {r.hasExpired ? '⏳ Beklemede' : '✓ Temiz'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 rounded-lg border border-arrow/30 bg-arrow-soft px-3 py-2 text-[12px] text-ink-2">
          🛡 <strong>audit_logs / invoices / subscriptions</strong> ASLA silinmez —
          KVKK 5 yıl + vergi 10 yıl saklama (regression test guard eder).
          Cron 04:00 UTC (07:00 TR) günlük çalışır, Telegram özet alert gönderir.
        </p>
      </section>

      <p className="text-center text-[12.5px] text-ink-4">
        ⚙ Read-only. Editleme Faz 2 (system_settings tablo + UPDATE mode + audit).
        Plan tier&apos;ları manuel değişiyorsa <code>lib/constants/plan-limits.ts</code> dosyasını güncelle.
      </p>
    </main>
  );
}

function Stat({
  label,
  value,
  tone = 'ink',
}: {
  label: string;
  value: string;
  tone?: 'ink' | 'arrow' | 'cat' | 'danger';
}) {
  const valueCls: Record<NonNullable<Parameters<typeof Stat>[0]['tone']>, string> = {
    ink: 'text-ink',
    arrow: 'text-arrow-7',
    cat: 'text-cart',
    danger: 'text-danger-7',
  };
  return (
    <div>
      <dt className="text-[10.5px] font-bold uppercase tracking-wider text-ink-4">
        {label}
      </dt>
      <dd className={`mt-0.5 font-bold ${valueCls[tone]}`}>{value}</dd>
    </div>
  );
}

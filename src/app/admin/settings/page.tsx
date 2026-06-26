import { redirect } from 'next/navigation';
import Link from 'next/link';
import { eq, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import {
  branches,
  brands,
  categories,
  companies,
  suppliers,
  users,
} from '@/db/schema';
import { SettingsShell } from '@/components/settings-shell';
import { getLegalCompanyInfo } from '@/lib/company/legal-info';

export default async function SettingsHubPage() {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) {
    redirect('/login' as never);
  }

  const [companyRow, userRow, countsRow] = await Promise.all([
    db
      .select({
        name: companies.name,
        plan: companies.plan,
        vatNo: companies.vatNo,
        whatsappPhone: companies.whatsappPhone,
        telegramEnabled: companies.telegramEnabled,
        telegramBotToken: companies.telegramBotToken,
      })
      .from(companies)
      .where(eq(companies.id, session.user.companyId))
      .limit(1),
    db
      .select({
        email: users.email,
        twoFactorEnabledAt: users.twoFactorEnabledAt,
        pendingEmail: users.pendingEmail,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1),
    db
      .select({
        categoryCount: sql<number>`(SELECT COUNT(*)::int FROM ${categories})`,
        brandCount: sql<number>`(SELECT COUNT(*)::int FROM ${brands})`,
        branchCount: sql<number>`(SELECT COUNT(*)::int FROM ${branches} WHERE ${branches.companyId} = ${session.user.companyId} AND ${branches.isActive} = true)`,
        supplierCount: sql<number>`(SELECT COUNT(*)::int FROM ${suppliers} WHERE ${suppliers.companyId} = ${session.user.companyId} AND ${suppliers.isActive} = true)`,
      })
      .from(sql`(SELECT 1) AS dummy`),
  ]);

  const company = companyRow[0];
  const user = userRow[0];
  const counts = countsRow[0] ?? {
    categoryCount: 0,
    brandCount: 0,
    branchCount: 0,
    supplierCount: 0,
  };
  const vatMissing = !company?.vatNo;
  const twoFaActive = !!user?.twoFactorEnabledAt;
  const emailChangePending = !!user?.pendingEmail;
  const telegramEnabled = !!company?.telegramEnabled;
  const telegramConfigured = !!company?.telegramBotToken;
  const legal = getLegalCompanyInfo();

  const statusItems: StatusItem[] = [
    {
      href: '/admin/settings/company',
      label: 'Firma',
      value: company?.name ?? '—',
      hint: vatMissing ? '⚠ VKN eksik' : '✓ Tam',
      kind: vatMissing ? 'danger' : 'ok',
    },
    {
      href: '/admin/account',
      label: 'Hesap',
      value: user?.email ?? '—',
      hint: emailChangePending ? '⏳ Email değişiklik bekleniyor' : '✓ Aktif',
      kind: emailChangePending ? 'pending' : 'ok',
    },
    {
      href: '/admin/security',
      label: 'Güvenlik',
      value: '2FA',
      hint: twoFaActive ? '✓ Aktif' : '⚠ Kapalı',
      kind: twoFaActive ? 'ok' : 'warning',
    },
    {
      href: '/admin/settings/company',
      label: 'Plan',
      value: company?.plan ?? 'FREE',
      hint: 'Aktif abonelik',
      kind: 'neutral',
    },
    {
      href: '/admin/settings/notifications',
      label: 'Telegram',
      value: telegramEnabled ? 'Aktif' : telegramConfigured ? 'Yapılandırıldı' : 'Bağlanmadı',
      hint: telegramEnabled
        ? '✓ Bildirimler açık'
        : telegramConfigured
          ? '⏸ Test edildi, kapalı'
          : '🔌 Bot tanımlanmadı',
      kind: telegramEnabled ? 'ok' : telegramConfigured ? 'pending' : 'neutral',
    },
  ];

  return (
    <SettingsShell
      current="overview"
      title="Genel Bakış"
      description={`${company?.name ?? 'Pet shop'} — hesap, firma ve veri yönetimi durumu`}
    >
      <div className="flex flex-col gap-6">
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
            Hesap & Firma durumu
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {statusItems.map((s) => (
              <StatusCard key={`${s.label}-${s.href}`} {...s} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
            📂 Veri yönetimi
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DataLink
              href="/admin/categories"
              emoji="📂"
              title="Kategoriler"
              count={counts.categoryCount}
            />
            <DataLink
              href="/admin/brands"
              emoji="🏷"
              title="Markalar"
              count={counts.brandCount}
            />
            <DataLink
              href="/admin/branches"
              emoji="🏪"
              title="Şubeler"
              count={counts.branchCount}
              suffix="aktif"
            />
            <DataLink
              href="/admin/suppliers"
              emoji="🏢"
              title="Tedarikçiler"
              count={counts.supplierCount}
              suffix="aktif"
            />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
            📄 Yasal belgeler &amp; İletişim
          </h2>
          <div className="rounded-2xl border border-line bg-paper p-4">
            {legal.hasRealInfo ? (
              <dl className="grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-3">
                    Ünvan
                  </dt>
                  <dd className="text-ink-2">{legal.legalName}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-3">
                    VKN
                  </dt>
                  <dd className="text-ink-2">{legal.vatNo}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-3">
                    Adres
                  </dt>
                  <dd className="text-ink-2">{legal.address}</dd>
                </div>
                {legal.phone && (
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-3">
                      Telefon
                    </dt>
                    <dd className="text-ink-2">{legal.phone}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-3">
                    E-posta
                  </dt>
                  <dd className="text-ink-2">{legal.supportEmail}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-[13px] text-ink-3">
                Firma yasal bilgileri henüz tanımlanmadı (sunucu env:{' '}
                <code className="rounded bg-line-soft px-1">COMPANY_*</code>).
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
              <LegalDocLink href="/privacy-policy" label="KVKK Aydınlatma" />
              <LegalDocLink href="/cookie-policy" label="Çerez Politikası" />
              <LegalDocLink href="/terms-of-service" label="Üyelik Sözleşmesi" />
              <LegalDocLink
                href="/distance-sales-agreement"
                label="Mesafeli Satış"
              />
              <LegalDocLink href="/return-policy" label="İade Politikası" />
              <LegalDocLink href="/delivery-terms" label="Teslimat Koşulları" />
              <LegalDocLink href="/contact" label="İletişim" />
            </div>
          </div>
        </section>
      </div>
    </SettingsShell>
  );
}

interface StatusItem {
  href: string;
  label: string;
  value: string;
  hint: string;
  kind: 'ok' | 'warning' | 'danger' | 'pending' | 'neutral';
}

function StatusCard({ href, label, value, hint, kind }: StatusItem) {
  const hintClasses: Record<StatusItem['kind'], string> = {
    ok: 'text-arrow-7',
    warning: 'text-cart',
    danger: 'text-danger-7',
    pending: 'text-ink-2',
    neutral: 'text-ink-3',
  };

  return (
    <Link
      href={href as never}
      data-status-card={label}
      className="group flex flex-col gap-1 rounded-2xl border border-line bg-paper p-4 hover:border-cat hover:shadow-sm transition-shadow"
    >
      <span className="text-[12px] font-bold uppercase tracking-wider text-ink-3">
        {label}
      </span>
      <span className="truncate text-base font-bold text-cart">{value}</span>
      <span className={`text-xs font-semibold ${hintClasses[kind]}`}>{hint}</span>
    </Link>
  );
}

function DataLink({
  href,
  emoji,
  title,
  count,
  suffix,
}: {
  href: string;
  emoji: string;
  title: string;
  count: number;
  suffix?: string;
}) {
  return (
    <Link
      href={href as never}
      data-data-link={href}
      className="group flex items-center gap-3 rounded-2xl border border-line bg-paper p-4 hover:border-cat hover:shadow-sm transition-shadow"
    >
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-cat-soft text-2xl">
        {emoji}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-bold text-cart group-hover:text-cat">
          {title}
        </h3>
        <p className="text-[12.5px] text-ink-3">
          <strong className="font-mono text-ink">{count}</strong>{' '}
          {suffix ?? 'kayıt'}
        </p>
      </div>
    </Link>
  );
}

function LegalDocLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-lg border border-line bg-line-soft/40 px-3 py-1.5 text-[12.5px] font-semibold text-ink-2 hover:border-cat hover:text-cat"
    >
      {label} ↗
    </a>
  );
}


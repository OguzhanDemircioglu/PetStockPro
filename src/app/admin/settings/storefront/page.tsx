import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { getStorefrontSettings } from '@/lib/storefront/settings';
import { getFeedbackSummary } from '@/lib/vitrin/feedback';
import { SettingsShell } from '@/components/settings-shell';
import { StorefrontForm } from './form';

const RATING_LABEL: Record<string, { emoji: string; label: string }> = {
  very_good: { emoji: '😊', label: 'Çok iyi' },
  good: { emoji: '🙂', label: 'İyi' },
  neutral: { emoji: '😐', label: 'Orta' },
  bad: { emoji: '😕', label: 'Kötü' },
  unreached: { emoji: '😞', label: 'Ulaşılmadı' },
};

export default async function StorefrontSettingsPage() {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const [profile, feedback] = await Promise.all([
    getStorefrontSettings(session.user.companyId, db),
    getFeedbackSummary(session.user.companyId, db, 30),
  ]);

  const totalActivity =
    feedback.totalSubmitted + feedback.totalClosedManually + feedback.totalDismissed;
  const responseRate =
    totalActivity > 0
      ? (feedback.totalSubmitted / totalActivity) * 100
      : null;
  const reachRate =
    feedback.totalSubmitted > 0
      ? ((feedback.totalSubmitted -
          (feedback.ratingDistribution.unreached ?? 0)) /
          feedback.totalSubmitted) *
        100
      : null;

  return (
    <SettingsShell
      current="storefront"
      title="Vitrin profili"
      description="Pet shop'unu petstockpro.com/vitrin'de tanıtan halka açık profili."
    >
      <div className="flex flex-col gap-8">
        <StorefrontForm initial={profile} />

        <section
          data-testid="feedback-summary"
          className="rounded-2xl border border-line bg-paper p-5"
        >
          <header className="mb-3">
            <h2 className="text-base font-bold text-cart">
              📊 Vitrin metrikleri (son 30 gün)
            </h2>
            <p className="text-[13.5px] text-ink-3">
              Müşterilerin WhatsApp&apos;tan sana ulaştıktan sonra verdikleri
              geri bildirim. Tek tıklama emoji anketi.
            </p>
          </header>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="Toplam aktivite"
              value={String(totalActivity)}
              hint="submit + closed + dismissed"
              tone="neutral"
            />
            <SummaryCard
              label="Anket cevabı"
              value={String(feedback.totalSubmitted)}
              hint={
                responseRate !== null
                  ? `${responseRate.toFixed(1)}% katılım`
                  : 'Henüz yok'
              }
              tone="cat"
            />
            <SummaryCard
              label="Ortalama puan"
              value={
                feedback.averageRatingScore !== null
                  ? `${feedback.averageRatingScore.toFixed(2)}/5`
                  : '—'
              }
              hint={
                feedback.averageRatingScore !== null &&
                feedback.averageRatingScore < 3
                  ? '⚠ İyileştirme gerek'
                  : '5 = en iyi, 1 = ulaşılmadı'
              }
              tone={
                feedback.averageRatingScore !== null &&
                feedback.averageRatingScore < 3
                  ? 'danger'
                  : 'arrow'
              }
            />
            <SummaryCard
              label="Ulaşma oranı"
              value={reachRate !== null ? `${reachRate.toFixed(0)}%` : '—'}
              hint={
                reachRate !== null && reachRate < 80
                  ? '⚠ Cevap hızı sorunu olabilir'
                  : 'Anket cevaplarına göre'
              }
              tone={reachRate !== null && reachRate < 80 ? 'danger' : 'arrow'}
            />
          </div>

          {feedback.totalSubmitted > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-ink-3">
                Puan dağılımı
              </h3>
              <ul className="flex flex-col gap-1.5">
                {Object.entries(RATING_LABEL).map(([key, info]) => {
                  const count = feedback.ratingDistribution[key] ?? 0;
                  const pct =
                    feedback.totalSubmitted > 0
                      ? (count / feedback.totalSubmitted) * 100
                      : 0;
                  return (
                    <li
                      key={key}
                      data-rating={key}
                      className="grid grid-cols-[100px_1fr_60px] items-center gap-3 text-[13.5px]"
                    >
                      <span className="font-bold text-ink-2">
                        <span aria-hidden>{info.emoji}</span> {info.label}
                      </span>
                      <div className="h-2 overflow-hidden rounded-full bg-line-soft">
                        <div
                          className="h-full bg-gradient-to-r from-cat to-cat-2"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-right font-mono text-ink-3">
                        {count} ({pct.toFixed(0)}%)
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {totalActivity === 0 && (
            <p className="rounded-xl bg-line-soft px-3 py-4 text-center text-[13.5px] text-ink-3">
              Henüz vitrin geri bildirimi yok. Müşterilerin WhatsApp&apos;tan
              ulaştıktan sonraki balon anketinden veri toplanır.
            </p>
          )}
        </section>
      </div>
    </SettingsShell>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: 'cat' | 'arrow' | 'danger' | 'neutral';
}) {
  const toneCls: Record<string, string> = {
    cat: 'border-cat/30 bg-cat-soft/40',
    arrow: 'border-arrow/30 bg-arrow-soft/40',
    danger: 'border-danger/30 bg-danger-soft/40',
    neutral: 'border-line bg-paper',
  };
  return (
    <article
      className={`flex flex-col gap-1.5 rounded-2xl border p-4 ${toneCls[tone]}`}
      data-summary-card={label}
    >
      <span className="text-[12px] font-bold uppercase tracking-wider text-ink-3">
        {label}
      </span>
      <span className="font-mono text-2xl font-bold text-cart">{value}</span>
      <span className="text-[12px] text-ink-3">{hint}</span>
    </article>
  );
}

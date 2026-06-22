import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { withTenant } from '@/lib/db/with-tenant';
import { getTelegramSettings } from '@/lib/telegram/settings';
import { SettingsShell } from '@/components/settings-shell';
import { TelegramForm } from './telegram-form';
import { toggleTelegramEnabledAction } from './actions';

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    toggled?: string;
    error?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user?.companyId) redirect('/login' as never);

  const companyId = session.user.companyId;
  const settings = await withTenant(companyId, (tx) => getTelegramSettings(companyId, tx));
  const params = await searchParams;
  const configured = Boolean(settings?.botToken && settings?.chatId);

  return (
    <SettingsShell
      current="notifications"
      title="Bildirimler"
      description="Telegram bot ile düşük stok, sayım tamamlandı, vitrin auto-unpublish gibi olaylarda anlık bildirim al."
    >
      <div className="flex flex-col gap-8">
        {params.toggled === '1' && (
          <div
            data-testid="banner-enabled"
            className="rounded-xl border border-arrow-7/30 bg-arrow-soft px-4 py-3 text-sm font-bold text-arrow-7"
          >
            ✓ Telegram bildirimleri aktif edildi.
          </div>
        )}
        {params.toggled === '0' && (
          <div
            data-testid="banner-disabled"
            className="rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink-2"
          >
            Telegram bildirimleri kapatıldı.
          </div>
        )}
        {params.error === 'not_configured' && (
          <div
            data-testid="banner-not-configured"
            className="rounded-xl border border-danger-7/30 bg-danger-soft px-4 py-3 text-sm text-danger-7"
          >
            Önce bot token + chat ID kaydet, sonra aç.
          </div>
        )}

        <section className="rounded-2xl border border-line bg-paper p-5">
          <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-cart">🤖 Telegram bot</h2>
              <p className="text-[13.5px] text-ink-3">
                Pet shop&apos;a özel bot — sistem alert kanalından bağımsız.
              </p>
            </div>
            <form action={toggleTelegramEnabledAction}>
              <input
                type="hidden"
                name="enabled"
                value={settings?.enabled ? 'false' : 'true'}
              />
              <button
                type="submit"
                disabled={!configured && !settings?.enabled}
                data-testid="toggle-btn"
                data-enabled={settings?.enabled ? '1' : '0'}
                className={
                  settings?.enabled
                    ? 'rounded-full bg-arrow-7 px-4 py-1.5 text-[13.5px] font-bold text-white shadow-sm hover:bg-arrow-6'
                    : 'rounded-full border border-line bg-paper px-4 py-1.5 text-[13.5px] font-bold text-ink-3 hover:border-cat disabled:opacity-60'
                }
              >
                {settings?.enabled ? '✓ Aktif (kapat)' : 'Pasif (aç)'}
              </button>
            </form>
          </header>

          <ol className="mb-5 ml-4 list-decimal flex-col gap-1 text-[13.5px] text-ink-2">
            <li>
              Telegram&apos;da{' '}
              <code className="rounded bg-line-soft px-1.5 py-0.5">@BotFather</code>
              &apos;a /newbot at — bot adı + kullanıcı adı belirle, token al.
            </li>
            <li>
              Yeni bot&apos;una <code className="rounded bg-line-soft px-1.5 py-0.5">/start</code>{' '}
              mesajı at (kendi hesabından).
            </li>
            <li>
              Chat ID için{' '}
              <code className="rounded bg-line-soft px-1.5 py-0.5">@userinfobot</code>&apos;a /start at,
              kullanıcı ID&apos;ni öğren.
            </li>
            <li>Aşağıdaki forma token + chat ID gir, kaydet, test mesajı yolla.</li>
            <li>Test başarılı → toggle&apos;ı aç → bildirimler Telegram&apos;a düşer.</li>
          </ol>

          <TelegramForm
            initialBotToken={settings?.botToken ?? null}
            initialChatId={settings?.chatId ?? null}
          />

          {settings?.configuredAt && (
            <p className="mt-5 text-[12px] text-ink-4">
              Son yapılandırma:{' '}
              {new Date(settings.configuredAt).toLocaleString('tr-TR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-paper p-5">
          <h2 className="mb-2 text-sm font-bold text-cart">
            🔮 Bildirim kanalları
          </h2>
          <ul className="ml-4 list-disc text-[14px] text-ink-2">
            <li>
              <b>📧 Email (Brevo)</b> — kayıt + şifre sıfırlama + ciddi olaylar (lock,
              email değişikliği). Her zaman aktif.
            </li>
            <li>
              <b>🔔 Sistem içi (zil)</b> — Pano sağ üstte 🔔 ikonu, son bildirimler
              feed&apos;i, /admin/notifications. Her zaman aktif.
            </li>
            <li>
              <b>🤖 Telegram</b> — Bu sayfada bağla. Düşük stok, sayım, vitrin
              auto-unpublish gibi event&apos;ler için anlık push (mobil bildirim).
            </li>
            <li className="text-ink-3">
              <b>SMS / WhatsApp Cloud API</b> — Faz 2&apos;de değerlendirilecek (MVP
              kapsamı dışı, maliyet + KVKK).
            </li>
          </ul>
        </section>
      </div>
    </SettingsShell>
  );
}

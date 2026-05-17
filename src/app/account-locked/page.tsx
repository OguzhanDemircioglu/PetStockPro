import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { LockedCountdown } from './countdown';

/**
 * Account Locked Page — Sprint 2.7
 *
 * Cookie'den lock state'i oku (login action set ediyor):
 *   - email (display için)
 *   - secondsRemaining (countdown başlangıcı)
 *   - reason (BRUTE_FORCE_1H vs BRUTE_FORCE_24H — UI varyantı)
 *   - ts (cookie set zamanı — elapsed hesabı için)
 *
 * Cookie yoksa /login'e redirect (direkt ziyaret → state yok).
 */
interface LockState {
  email: string;
  secondsRemaining: number;
  reason: 'BRUTE_FORCE_1H' | 'BRUTE_FORCE_24H';
  ts: number;
}

export default async function AccountLockedPage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get('pp_lock_state')?.value;

  if (!raw) {
    redirect('/login' as never);
  }

  let parsed: LockState;
  try {
    parsed = JSON.parse(raw) as LockState;
  } catch {
    redirect('/login' as never);
  }

  // Elapsed time'ı düş — cookie eski ise gerçek kalan az.
  // Sayfa her ziyarette farklı kalan göstermesi bilinçli (server component impurity OK).
  // eslint-disable-next-line react-hooks/purity
  const elapsedSec = Math.floor((Date.now() - parsed.ts) / 1000);
  const adjustedSecondsRemaining = Math.max(0, parsed.secondsRemaining - elapsedSec);

  const isPermanent = parsed.reason === 'BRUTE_FORCE_24H';

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cat-soft via-bg to-bars-soft px-6 py-16">
      <div className="w-full max-w-md rounded-3xl bg-white p-10 shadow-[var(--shadow-lg)]">
        <div className="mb-6 flex justify-center">
          <div
            className={`grid h-16 w-16 place-items-center rounded-2xl text-3xl ${
              isPermanent ? 'bg-danger-soft' : 'bg-cat-soft'
            }`}
          >
            {isPermanent ? '🔒🔒' : '🔒'}
          </div>
        </div>

        <h1
          className={`text-center text-2xl font-bold leading-tight tracking-tight ${
            isPermanent ? 'text-danger-7' : 'text-cart'
          }`}
        >
          {isPermanent
            ? 'Hesabın 24 saat kilitli'
            : 'Hesabın geçici olarak kilitli'}
        </h1>

        {isPermanent && (
          <p className="mt-2 text-center text-xs font-bold uppercase tracking-wider text-danger-7">
            ⚠ Saldırı şüphesi tespit edildi
          </p>
        )}

        <p className="mt-3 text-center text-sm leading-relaxed text-ink-3">
          {isPermanent ? (
            <>
              3 kez art arda 5&apos;er yanlış giriş denendi.{' '}
              <strong className="text-cart">{parsed.email}</strong> hesabın güvenlik nedeniyle{' '}
              <strong>24 saat kilitlendi</strong>.
            </>
          ) : (
            <>
              Çok fazla başarısız giriş denendi.{' '}
              <strong className="text-cart">{parsed.email}</strong> hesabın 1 saat sonra otomatik
              açılacak.
            </>
          )}
        </p>

        <LockedCountdown initialSeconds={adjustedSecondsRemaining} />

        <div className="mt-6 space-y-3">
          <Link
            href={'/forgot-password' as never}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-cat to-cat-2 px-6 py-3 text-sm font-bold text-white shadow-[var(--shadow-cat)] transition-transform hover:-translate-y-0.5"
          >
            🔑 Şifremi sıfırla (kilidi bypass eder) →
          </Link>

          <p className="text-center text-xs text-ink-4 leading-relaxed">
            <strong>Sen mi denemiyordun?</strong>
            <br />
            Birisi hesabına giriş denedi. E-postandaki uyarıyı kontrol et + güvenlik için
            şifreni değiştir.
          </p>
        </div>

        <div className="mt-6 border-t border-line-soft pt-4 text-center text-[12.5px] text-ink-4">
          Yardım için:{' '}
          <a href="mailto:destek@petstockpro.com" className="font-bold text-cart hover:underline">
            destek@petstockpro.com
          </a>
        </div>
      </div>
    </main>
  );
}

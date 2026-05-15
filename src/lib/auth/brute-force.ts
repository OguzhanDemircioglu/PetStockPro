/**
 * Brute-force lock state machine
 *
 * EKRAN-AUTH.md §10 sıkı policy:
 *   5 başarısız login → 1 SAAT lock
 *   3 art arda lock → 24 SAAT kalıcı lock + acil email
 *   TOTP yanlışı sayılmaz (sadece password fail)
 *   Şifremi Unuttum lock'u bypass eder
 *
 * Kalan hak banner:
 *   1-2 yanlış → banner yok (parmak hatası)
 *   3 yanlış → "3 hakkın kaldı" banner
 *   4 yanlış → "2 hakkın kaldı" + Şifremi Unuttum
 *   5 yanlış → "1 hakkın kaldı + 1 saat lock uyarı" → lock
 *
 * Bu modül pure fonksiyonlar — DB state'i caller verir, biz hesaplama yaparız.
 */

export const LOCK_DURATION_MS = 60 * 60 * 1000; // 1 saat
export const PERMANENT_LOCK_DURATION_MS = 24 * 60 * 60 * 1000; // 24 saat
export const FAIL_THRESHOLD = 5; // 5 yanlış → lock
export const PERMANENT_LOCK_THRESHOLD = 3; // 3 art arda lock → 24h kalıcı
export const REMAINING_BANNER_FROM = 3; // 3 hak kaldığında banner göster

export interface UserAuthState {
  failedLoginCount: number;
  lockedUntil: Date | null;
  recentLockCount?: number; // 24h içinde tetiklenen lock sayısı (3+ ise kalıcı)
}

export interface LoginAttemptResult {
  shouldLock: boolean;
  newFailedCount: number;
  newLockedUntil: Date | null;
  isPermanentLock: boolean;
  remainingAttempts: number; // 0 = locked, 5 = no fails yet
  showRemainingBanner: boolean;
}

/**
 * Başarısız login attempt'i işle — yeni state hesapla.
 *
 * @param current — DB'den okunan kullanıcı state'i (failedLoginCount + lockedUntil + recentLockCount)
 * @param now — şimdi (test için override)
 * @returns yeni state + UI flag'leri
 */
export function processFailedLogin(
  current: UserAuthState,
  now: Date = new Date(),
): LoginAttemptResult {
  const newFailedCount = current.failedLoginCount + 1;

  // 5 fail'e ulaştı → lock
  if (newFailedCount >= FAIL_THRESHOLD) {
    const recentLocks = (current.recentLockCount ?? 0) + 1;
    const isPermanent = recentLocks >= PERMANENT_LOCK_THRESHOLD;
    const duration = isPermanent ? PERMANENT_LOCK_DURATION_MS : LOCK_DURATION_MS;

    return {
      shouldLock: true,
      newFailedCount: 0, // lock sonrası reset (countdown lockedUntil'da)
      newLockedUntil: new Date(now.getTime() + duration),
      isPermanentLock: isPermanent,
      remainingAttempts: 0,
      showRemainingBanner: false,
    };
  }

  return {
    shouldLock: false,
    newFailedCount,
    newLockedUntil: current.lockedUntil, // mevcut lock varsa korur (rare edge)
    isPermanentLock: false,
    remainingAttempts: FAIL_THRESHOLD - newFailedCount,
    showRemainingBanner: newFailedCount >= REMAINING_BANNER_FROM,
  };
}

/**
 * Başarılı login'de state reset.
 */
export interface SuccessfulLoginResult {
  newFailedCount: 0;
  newLockedUntil: null;
}

export function processSuccessfulLogin(): SuccessfulLoginResult {
  return {
    newFailedCount: 0,
    newLockedUntil: null,
  };
}

/**
 * Kullanıcı şu an lock'lu mu? (lockedUntil > now)
 */
export function isLocked(state: UserAuthState, now: Date = new Date()): boolean {
  if (!state.lockedUntil) return false;
  return state.lockedUntil.getTime() > now.getTime();
}

/**
 * Lock'tan kalan saniye (UI countdown için).
 *
 * @returns kalan saniye (0 = lock değil veya süre doldu)
 */
export function getLockRemainingSeconds(
  state: UserAuthState,
  now: Date = new Date(),
): number {
  if (!state.lockedUntil) return 0;
  const remainingMs = state.lockedUntil.getTime() - now.getTime();
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

/**
 * UI için kalan hak mesajı (EKRAN-AUTH §2.3 banner).
 *
 * @returns null = banner gösterme, string = banner mesajı
 */
export function getRemainingAttemptsMessage(remainingAttempts: number): string | null {
  if (remainingAttempts >= REMAINING_BANNER_FROM) return null; // 3+ kaldıysa banner yok
  if (remainingAttempts === 2) return '2 hakkın kaldı';
  if (remainingAttempts === 1) return '1 hakkın kaldı — sonraki yanlış 1 saatlik kilit getirir';
  if (remainingAttempts === 0) return 'Hesap kilitli';
  return null;
}

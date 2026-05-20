/**
 * Server action başlangıç gate'leri — rol-tabanlı erişim koruması.
 *
 * Faz 2 (2026-05-21) — Plan §B + §2.4
 *
 * Kullanım:
 *   ```ts
 *   export async function recordStockInAction(input: ...) {
 *     const session = await auth();
 *     assertNotObserver(session); // mutation öncesi gate
 *     // ...
 *   }
 *   ```
 *
 * Mutation yapmayan listing/detay action'ları çağırmaz (Observer okumaya izinli).
 */

/**
 * Yalnızca role'e bakan minimal session shape — Session full tipi yerine
 * fonksiyon imzasını gevşek tutar (subset Session veya farklı bir context
 * ile çağrılabilir).
 */
export interface RoleSession {
  user?: { role?: string | null } | null;
}

/**
 * Observer + mutation yasak — Plan §B (2026-05-21):
 *   "Observer (İzleyici) hiçbir CRUD aksiyonu yapamaz, sadece okur."
 *
 * Throw eden ObserverReadOnlyError ile server action 403 döndürür.
 */
export class ObserverReadOnlyError extends Error {
  readonly code = 'observer_read_only';

  constructor() {
    super('Observer rolündeki kullanıcı bu işlemi yapamaz — sadece okuyabilir.');
    this.name = 'ObserverReadOnlyError';
  }
}

/**
 * Session payload'ında rol bilgisi bulunmuyorsa (anonim veya bozuk JWT),
 * bu helper güvenli tarafta kalır ve throw etmez — auth() zaten upstream'de
 * yetkisizliği halleder (redirect /login). Buradaki tek görev: rolü 'OBSERVER'
 * olan oturumları engellemek.
 */
export function assertNotObserver(session: RoleSession | null | undefined): void {
  const role = session?.user?.role;
  if (role === 'OBSERVER') {
    throw new ObserverReadOnlyError();
  }
}

/**
 * UI'da buton disabled state'i için non-throwing variant.
 *
 * Mutation server action'ında assertNotObserver kullan; UI'da bu helper.
 */
export function isObserver(session: RoleSession | null | undefined): boolean {
  return session?.user?.role === 'OBSERVER';
}

/**
 * iyzico Client Factory + Promise Wrapper
 *
 * iyzipay paketi callback-based, biz async/await istiyoruz. Bu modül:
 * 1. Iyzipay client singleton oluşturur (config env'den)
 * 2. Callback API'yi Promise'a wrap eder (typed)
 * 3. Test'lerde override edilebilir client injection
 *
 * Production'da fail-fast: env eksikse hata fırlatır.
 */

import Iyzipay from 'iyzipay';
import { getIyzicoConfig, isIyzicoConfigured } from './config';

let cachedClient: Iyzipay | null = null;

/**
 * iyzico client singleton.
 *
 * @throws Error if IYZICO_API_KEY veya IYZICO_SECRET_KEY env'de yok
 */
export function getIyzicoClient(): Iyzipay {
  if (cachedClient) return cachedClient;

  if (!isIyzicoConfigured()) {
    throw new Error(
      'iyzico yapılandırılmadı — IYZICO_API_KEY ve IYZICO_SECRET_KEY env değişkenleri gerekli. ' +
      'Sandbox key için https://merchant.iyzipay.com → Test Ortamı → API Anahtarı'
    );
  }

  const cfg = getIyzicoConfig();
  cachedClient = new Iyzipay({
    apiKey: cfg.IYZICO_API_KEY!,
    secretKey: cfg.IYZICO_SECRET_KEY!,
    uri: cfg.IYZICO_BASE_URL,
  });

  return cachedClient;
}

/**
 * Promise wrapper — iyzipay callback API'yi async/await'e çevirir.
 *
 * @example
 * const result = await callIyzico<IyzicoSubscriptionResponse>((cb) =>
 *   getIyzicoClient().subscription.create(request, cb)
 * );
 */
export function callIyzico<T>(
  invoker: (callback: (err: Error | null, result: T) => void) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    invoker((err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    });
  });
}

/**
 * Test'lerde mock client inject etmek için.
 *
 * @example
 * setIyzicoClientForTesting({ subscription: { create: ... } } as Iyzipay);
 * // ... testlerinin başında çalıştır
 * setIyzicoClientForTesting(null); // cleanup
 */
export function setIyzicoClientForTesting(client: Iyzipay | null): void {
  cachedClient = client;
}

/**
 * Cache reset — yeni env config alma durumlarında
 */
export function _resetIyzicoClientCache(): void {
  cachedClient = null;
}

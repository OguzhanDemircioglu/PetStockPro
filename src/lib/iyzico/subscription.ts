/**
 * iyzico Subscription Operations
 *
 * SDK wrapper'lar — Promise + Zod validation + structured errors.
 * Business logic (DB write, audit, Telegram notify) bu modülde DEĞİL —
 * Sprint 14'te src/lib/billing/ orchestrator katmanında bağlanır.
 *
 * Tüm fonksiyonlar:
 * 1. Input'u Zod ile validate eder (runtime safety)
 * 2. iyzico SDK'sına Promise wrapper ile çağrı yapar
 * 3. Response'u Zod ile parse eder (iyzico'nun schema'sı değişirse hemen fark ederiz)
 * 4. status='failure' ise structured error fırlatır (errorCode + errorMessage)
 */

import type Iyzipay from 'iyzipay';
import { getIyzicoClient, callIyzico } from './client';
import {
  iyzicoCustomerCreateRequestSchema,
  iyzicoCustomerResponseSchema,
  iyzicoSubscriptionCreateRequestSchema,
  iyzicoSubscriptionResponseSchema,
  iyzicoSubscriptionCancelRequestSchema,
  type IyzicoCustomerCreateRequest,
  type IyzicoCustomerResponse,
  type IyzicoSubscriptionCreateRequest,
  type IyzicoSubscriptionResponse,
  type IyzicoSubscriptionCancelRequest,
} from './types';

/**
 * Structured error — iyzico'nun döndürdüğü failure response'lar için.
 * Caller catch ederken errorCode ile ayırt edebilir (örn 5001 = invalid card → kullanıcıya uyarı).
 */
export class IyzicoApiError extends Error {
  readonly errorCode: string;
  readonly errorMessage: string;
  readonly operation: string;

  constructor(operation: string, errorCode: string | undefined, errorMessage: string | undefined) {
    super(`iyzico ${operation} başarısız: ${errorCode ?? 'UNKNOWN'} — ${errorMessage ?? 'no message'}`);
    this.name = 'IyzicoApiError';
    this.errorCode = errorCode ?? 'UNKNOWN';
    this.errorMessage = errorMessage ?? '';
    this.operation = operation;
  }
}

/**
 * Yeni müşteri oluştur (subscription öncesi gerekli)
 *
 * @param input — müşteri bilgileri (TC/VKN identityNumber zorunlu)
 * @returns customerReferenceCode (iyzico'nun atadığı, DB'ye saklanmalı)
 */
export async function createIyzicoCustomer(
  input: IyzicoCustomerCreateRequest
): Promise<IyzicoCustomerResponse> {
  const validated = iyzicoCustomerCreateRequestSchema.parse(input);

  const client = getIyzicoClient() as Iyzipay & {
    subscriptionCustomer: { create: (req: object, cb: (err: Error | null, result: unknown) => void) => void };
  };

  const raw = await callIyzico<unknown>((cb) => {
    client.subscriptionCustomer.create(validated, cb);
  });

  const response = iyzicoCustomerResponseSchema.parse(raw);

  if (response.status === 'failure') {
    throw new IyzicoApiError('customer.create', response.errorCode, response.errorMessage);
  }

  return response;
}

/**
 * Yeni subscription başlat (PRO veya PRO+ aboneliği)
 *
 * @param input — pricingPlanReferenceCode + customer ya da customerReferenceCode + kart bilgileri
 * @returns subscription details (referenceCode iyzicoSubscriptionRef olarak DB'ye saklanmalı)
 */
export async function createIyzicoSubscription(
  input: IyzicoSubscriptionCreateRequest
): Promise<IyzicoSubscriptionResponse> {
  const validated = iyzicoSubscriptionCreateRequestSchema.parse(input);

  const client = getIyzicoClient() as Iyzipay & {
    subscription: { create: (req: object, cb: (err: Error | null, result: unknown) => void) => void };
  };

  const raw = await callIyzico<unknown>((cb) => {
    client.subscription.create(validated, cb);
  });

  const response = iyzicoSubscriptionResponseSchema.parse(raw);

  if (response.status === 'failure') {
    throw new IyzicoApiError('subscription.create', response.errorCode, response.errorMessage);
  }

  return response;
}

/**
 * Mevcut subscription detayını getir (status kontrolü, reconciliation)
 */
export async function retrieveIyzicoSubscription(
  subscriptionReferenceCode: string
): Promise<IyzicoSubscriptionResponse> {
  if (!subscriptionReferenceCode) {
    throw new Error('subscriptionReferenceCode zorunlu');
  }

  const client = getIyzicoClient() as Iyzipay & {
    subscription: { retrieve: (req: object, cb: (err: Error | null, result: unknown) => void) => void };
  };

  const raw = await callIyzico<unknown>((cb) => {
    client.subscription.retrieve({ subscriptionReferenceCode }, cb);
  });

  const response = iyzicoSubscriptionResponseSchema.parse(raw);

  if (response.status === 'failure') {
    throw new IyzicoApiError('subscription.retrieve', response.errorCode, response.errorMessage);
  }

  return response;
}

/**
 * Subscription iptal et — dönem sonuna kadar aktif kalır, otomatik yenilemez
 */
export async function cancelIyzicoSubscription(
  input: IyzicoSubscriptionCancelRequest
): Promise<IyzicoSubscriptionResponse> {
  const validated = iyzicoSubscriptionCancelRequestSchema.parse(input);

  const client = getIyzicoClient() as Iyzipay & {
    subscription: { cancel: (req: object, cb: (err: Error | null, result: unknown) => void) => void };
  };

  const raw = await callIyzico<unknown>((cb) => {
    client.subscription.cancel(validated, cb);
  });

  const response = iyzicoSubscriptionResponseSchema.parse(raw);

  if (response.status === 'failure') {
    throw new IyzicoApiError('subscription.cancel', response.errorCode, response.errorMessage);
  }

  return response;
}

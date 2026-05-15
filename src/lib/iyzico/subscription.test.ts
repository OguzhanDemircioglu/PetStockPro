import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type Iyzipay from 'iyzipay';
import {
  createIyzicoCustomer,
  createIyzicoSubscription,
  retrieveIyzicoSubscription,
  cancelIyzicoSubscription,
  IyzicoApiError,
} from './subscription';
import { setIyzicoClientForTesting } from './client';
import type { IyzicoCustomerCreateRequest, IyzicoSubscriptionCreateRequest } from './types';

/**
 * Mock client builder — testlerde inject edilir.
 * iyzipay callback API ile uyumlu (err, result).
 */
type IyzipayCb = (err: Error | null, result: unknown) => void;

function makeMockClient() {
  const mocks = {
    subscriptionCustomer: { create: vi.fn() },
    subscription: { create: vi.fn(), retrieve: vi.fn(), cancel: vi.fn() },
  };
  return mocks;
}

const validCustomerInput: IyzicoCustomerCreateRequest = {
  locale: 'tr',
  name: 'Mavi',
  surname: 'Pet',
  identityNumber: '12345678950', // geçerli TC
  email: 'mavi@petshop.com',
  gsmNumber: '+905551234567',
  billingAddress: {
    contactName: 'Mavi Pet Shop',
    city: 'İstanbul',
    country: 'Turkey',
    address: 'Üsküdar, Mimar Sinan Mh. No:5',
  },
};

const validSubscriptionInput: IyzicoSubscriptionCreateRequest = {
  locale: 'tr',
  pricingPlanReferenceCode: 'plan_pro_monthly',
  subscriptionInitialStatus: 'ACTIVE',
  customerReferenceCode: 'cust_123',
  paymentCard: {
    cardHolderName: 'Test Kullanici',
    cardNumber: '5528790000000008', // iyzico sandbox success card
    expireMonth: '12',
    expireYear: '2030',
    cvc: '123',
    registerConsumerCard: true,
  },
};

describe('iyzico subscription operations', () => {
  let mocks: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mocks = makeMockClient();
    setIyzicoClientForTesting(mocks as unknown as Iyzipay);
  });

  afterEach(() => {
    setIyzicoClientForTesting(null);
    vi.restoreAllMocks();
  });

  // ────────────────────────────────────────────────────────────────
  // createIyzicoCustomer
  // ────────────────────────────────────────────────────────────────

  describe('createIyzicoCustomer', () => {
    it('başarılı response döner — referenceCode parse edilir', async () => {
      mocks.subscriptionCustomer.create.mockImplementation((_req: object, cb: IyzipayCb) => {
        cb(null, { status: 'success', referenceCode: 'cust_abc', email: 'mavi@petshop.com' });
      });

      const result = await createIyzicoCustomer(validCustomerInput);

      expect(result.status).toBe('success');
      expect(result.referenceCode).toBe('cust_abc');
      expect(mocks.subscriptionCustomer.create).toHaveBeenCalledTimes(1);
    });

    it('iyzico failure → IyzicoApiError fırlatır (errorCode dahil)', async () => {
      mocks.subscriptionCustomer.create.mockImplementation((_req: object, cb: IyzipayCb) => {
        cb(null, { status: 'failure', errorCode: '1000', errorMessage: 'identityNumber zorunlu' });
      });

      await expect(createIyzicoCustomer(validCustomerInput)).rejects.toThrow(IyzicoApiError);

      try {
        await createIyzicoCustomer(validCustomerInput);
      } catch (err) {
        expect(err).toBeInstanceOf(IyzicoApiError);
        expect((err as IyzicoApiError).errorCode).toBe('1000');
        expect((err as IyzicoApiError).operation).toBe('customer.create');
      }
    });

    it('input validation: geçersiz email → Zod hata', async () => {
      const invalidInput = { ...validCustomerInput, email: 'not-an-email' };
      await expect(createIyzicoCustomer(invalidInput)).rejects.toThrow();
      expect(mocks.subscriptionCustomer.create).not.toHaveBeenCalled();
    });

    it('input validation: identityNumber 10-11 hane dışında → reject', async () => {
      const invalidInput = { ...validCustomerInput, identityNumber: '123' };
      await expect(createIyzicoCustomer(invalidInput)).rejects.toThrow();
      expect(mocks.subscriptionCustomer.create).not.toHaveBeenCalled();
    });

    it('network error (callback err) → reject (Zod parse çağrılmaz)', async () => {
      mocks.subscriptionCustomer.create.mockImplementation((_req: object, cb: IyzipayCb) => {
        cb(new Error('ECONNREFUSED'), null);
      });

      await expect(createIyzicoCustomer(validCustomerInput)).rejects.toThrow('ECONNREFUSED');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // createIyzicoSubscription
  // ────────────────────────────────────────────────────────────────

  describe('createIyzicoSubscription', () => {
    it('başarılı subscription — referenceCode + status döner', async () => {
      mocks.subscription.create.mockImplementation((_req: object, cb: IyzipayCb) => {
        cb(null, {
          status: 'success',
          referenceCode: 'sub_xyz',
          subscriptionStatus: 'ACTIVE',
          customerReferenceCode: 'cust_123',
          pricingPlanReferenceCode: 'plan_pro_monthly',
        });
      });

      const result = await createIyzicoSubscription(validSubscriptionInput);

      expect(result.referenceCode).toBe('sub_xyz');
      expect(result.subscriptionStatus).toBe('ACTIVE');
    });

    it('kart reddedildi (failure 5001) → IyzicoApiError', async () => {
      mocks.subscription.create.mockImplementation((_req: object, cb: IyzipayCb) => {
        cb(null, { status: 'failure', errorCode: '5001', errorMessage: 'Yetersiz bakiye' });
      });

      await expect(createIyzicoSubscription(validSubscriptionInput)).rejects.toMatchObject({
        name: 'IyzicoApiError',
        errorCode: '5001',
        operation: 'subscription.create',
      });
    });
  });

  // ────────────────────────────────────────────────────────────────
  // retrieveIyzicoSubscription
  // ────────────────────────────────────────────────────────────────

  describe('retrieveIyzicoSubscription', () => {
    it('mevcut subscription döner', async () => {
      mocks.subscription.retrieve.mockImplementation((_req: object, cb: IyzipayCb) => {
        cb(null, {
          status: 'success',
          referenceCode: 'sub_xyz',
          subscriptionStatus: 'ACTIVE',
          startDate: '2026-05-15',
        });
      });

      const result = await retrieveIyzicoSubscription('sub_xyz');

      expect(result.referenceCode).toBe('sub_xyz');
      expect(mocks.subscription.retrieve).toHaveBeenCalledWith(
        { subscriptionReferenceCode: 'sub_xyz' },
        expect.any(Function)
      );
    });

    it('boş referenceCode → erken throw (iyzico çağrısı yok)', async () => {
      await expect(retrieveIyzicoSubscription('')).rejects.toThrow(/zorunlu/);
      expect(mocks.subscription.retrieve).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // cancelIyzicoSubscription
  // ────────────────────────────────────────────────────────────────

  describe('cancelIyzicoSubscription', () => {
    it('başarılı iptal — status döner', async () => {
      mocks.subscription.cancel.mockImplementation((_req: object, cb: IyzipayCb) => {
        cb(null, { status: 'success', referenceCode: 'sub_xyz', subscriptionStatus: 'CANCELED' });
      });

      const result = await cancelIyzicoSubscription({
        subscriptionReferenceCode: 'sub_xyz',
      });

      expect(result.subscriptionStatus).toBe('CANCELED');
    });

    it('iyzico bulamadı (failure 404) → IyzicoApiError', async () => {
      mocks.subscription.cancel.mockImplementation((_req: object, cb: IyzipayCb) => {
        cb(null, { status: 'failure', errorCode: '404', errorMessage: 'Subscription not found' });
      });

      await expect(
        cancelIyzicoSubscription({ subscriptionReferenceCode: 'invalid_ref' })
      ).rejects.toMatchObject({ errorCode: '404', operation: 'subscription.cancel' });
    });
  });

  // ────────────────────────────────────────────────────────────────
  // IyzicoApiError class
  // ────────────────────────────────────────────────────────────────

  describe('IyzicoApiError', () => {
    it('errorCode + errorMessage + operation fields ile yapılandırılır', () => {
      const err = new IyzicoApiError('customer.create', '1000', 'identityNumber required');
      expect(err.name).toBe('IyzicoApiError');
      expect(err.errorCode).toBe('1000');
      expect(err.errorMessage).toBe('identityNumber required');
      expect(err.operation).toBe('customer.create');
      expect(err.message).toContain('customer.create');
      expect(err.message).toContain('1000');
    });

    it('undefined errorCode UNKNOWN olarak normalize edilir', () => {
      const err = new IyzicoApiError('subscription.create', undefined, undefined);
      expect(err.errorCode).toBe('UNKNOWN');
      expect(err.errorMessage).toBe('');
    });

    it('instanceof Error true', () => {
      const err = new IyzicoApiError('test', 'X', 'Y');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(IyzicoApiError);
    });
  });
});

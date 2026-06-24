import { describe, it, expect } from 'vitest';
import { buildInvoiceCustomer, type CompanyInvoiceRow } from './invoice-customer';

const baseRow: CompanyInvoiceRow = {
  name: 'Mavi Pet Shop',
  vatNo: '1234567890',
  billingAddress: 'Üsküdar Mah. No 1',
  cityName: 'İstanbul',
  districtName: 'Üsküdar',
  email: 'sahip@mavipet.com',
};

describe('buildInvoiceCustomer', () => {
  it('owner e-postası varsa customer.email set edilir (Nilvera Mail → alıcıya teslim)', () => {
    const c = buildInvoiceCustomer(baseRow);
    expect(c.email).toBe('sahip@mavipet.com');
    expect(c.taxNumber).toBe('1234567890');
    expect(c.title).toBe('Mavi Pet Shop');
    expect(c.city).toBe('İstanbul');
  });

  it('owner e-postası null → email undefined (CustomerInfo.Mail eklenmez, regresyon yok)', () => {
    const c = buildInvoiceCustomer({ ...baseRow, email: null });
    expect(c.email).toBeUndefined();
  });

  it('vatNo null → taxNumber null (nihai tüketici), e-posta yine taşınır', () => {
    const c = buildInvoiceCustomer({ ...baseRow, vatNo: null });
    expect(c.taxNumber).toBeNull();
    expect(c.email).toBe('sahip@mavipet.com');
  });

  it('boş adres/il/ilçe → undefined (invoice.ts orPlaceholder devralır)', () => {
    const c = buildInvoiceCustomer({
      ...baseRow,
      billingAddress: null,
      cityName: null,
      districtName: null,
    });
    expect(c.address).toBeUndefined();
    expect(c.city).toBeUndefined();
    expect(c.district).toBeUndefined();
  });
});

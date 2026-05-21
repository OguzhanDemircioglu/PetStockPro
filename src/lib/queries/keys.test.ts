import { describe, it, expect } from 'vitest';
import {
  productKeys,
  stockMovementKeys,
  stocktakeKeys,
  notificationKeys,
  storefrontKeys,
} from './keys';

describe('Query key factory', () => {
  it('productKeys hierarchy', () => {
    expect(productKeys.all).toEqual(['products']);
    expect(productKeys.lists()).toEqual(['products', 'list']);
    expect(productKeys.list({ search: 'royal' })).toEqual([
      'products',
      'list',
      { search: 'royal' },
    ]);
    expect(productKeys.detail('p-1')).toEqual(['products', 'detail', 'p-1']);
  });

  it('stockMovementKeys byBranch', () => {
    expect(stockMovementKeys.byBranch('b-1')).toEqual([
      'stock-movements',
      'list',
      { branchId: 'b-1' },
    ]);
  });

  it('stocktakeKeys items composition', () => {
    expect(stocktakeKeys.items('s-1')).toEqual([
      'stocktakes',
      'detail',
      's-1',
      'items',
    ]);
  });

  it('notificationKeys unreadCount', () => {
    expect(notificationKeys.unreadCount()).toEqual([
      'notifications',
      'unread-count',
    ]);
  });

  it('storefrontKeys productStatus', () => {
    expect(storefrontKeys.productStatus('p-1')).toEqual([
      'storefront',
      'product-status',
      'p-1',
    ]);
  });

  it('invalidate hierarchy — lists() prefix detail() etkilemez', () => {
    // TanStack matchType('hierarchical') invalidateQueries semantiği için
    // lists() prefix detail()'i etkilemez (ayrı segment 'list' vs 'detail').
    expect(productKeys.lists()[1]).toBe('list');
    expect(productKeys.details()[1]).toBe('detail');
  });
});

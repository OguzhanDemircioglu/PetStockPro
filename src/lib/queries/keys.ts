/**
 * Query Key Factory — TanStack Query (FAZ 4).
 *
 * Standartlaştırılmış key tuple'lar — invalidate / setQueryData için
 * tip-güvenli erişim. FAZ 5'te 5 kritik CRUD'da kullanılır.
 *
 * Pattern (TanStack docs önerisi):
 *   productKeys.all              → ['products']
 *   productKeys.lists()          → ['products', 'list']
 *   productKeys.list(filters)    → ['products', 'list', { ...filters }]
 *   productKeys.detail(id)       → ['products', 'detail', id]
 *
 * Bu sayede invalidateQueries({ queryKey: productKeys.lists() }) ile
 * tüm filter varyantlarını invalidate ederiz, detail'i etkilemez.
 */

// Sentinel string for type safety - readonly tuples
export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) =>
    [...productKeys.lists(), filters ?? {}] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
};

export const stockMovementKeys = {
  all: ['stock-movements'] as const,
  lists: () => [...stockMovementKeys.all, 'list'] as const,
  byBranch: (branchId: string) =>
    [...stockMovementKeys.lists(), { branchId }] as const,
  byVariant: (variantId: string) =>
    [...stockMovementKeys.lists(), { variantId }] as const,
  filtered: (filters: Record<string, unknown>) =>
    [...stockMovementKeys.lists(), filters] as const,
};

export const stocktakeKeys = {
  all: ['stocktakes'] as const,
  lists: () => [...stocktakeKeys.all, 'list'] as const,
  detail: (id: string) => [...stocktakeKeys.all, 'detail', id] as const,
  items: (stocktakeId: string) =>
    [...stocktakeKeys.detail(stocktakeId), 'items'] as const,
};

export const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (filter?: { isRead?: boolean }) =>
    [...notificationKeys.lists(), filter ?? {}] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
};

export const storefrontKeys = {
  all: ['storefront'] as const,
  publishedList: () => [...storefrontKeys.all, 'published-list'] as const,
  productStatus: (productId: string) =>
    [...storefrontKeys.all, 'product-status', productId] as const,
};

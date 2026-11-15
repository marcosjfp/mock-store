import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, Order, Product, api } from "../api/client";
import { useSession } from "../context/AuthContext";

/**
 * Query keys are namespaced by tenant so switching workspaces can never show
 * another tenant's cached data.
 */
function useKeys() {
  const { tenantSlug } = useSession();
  return {
    all: [tenantSlug] as const,
    me: [tenantSlug, "me"] as const,
    products: [tenantSlug, "products"] as const,
    orders: [tenantSlug, "orders"] as const,
    summary: (days: number) => [tenantSlug, "summary", days] as const,
    summaries: [tenantSlug, "summary"] as const,
    audit: [tenantSlug, "audit"] as const,
    members: [tenantSlug, "members"] as const,
  };
}

export function useMe() {
  const keys = useKeys();
  return useQuery({ queryKey: keys.me, queryFn: api.me, staleTime: 5 * 60_000 });
}

export function useProducts() {
  const keys = useKeys();
  return useQuery({ queryKey: keys.products, queryFn: api.products });
}

export function useOrders() {
  const keys = useKeys();
  return useQuery({ queryKey: keys.orders, queryFn: api.orders });
}

export function useSummary(days: number) {
  const keys = useKeys();
  return useQuery({
    queryKey: keys.summary(days),
    queryFn: () => api.summary(days),
    placeholderData: (previous) => previous,
  });
}

export function useAuditLog(enabled = true) {
  const keys = useKeys();
  return useQuery({ queryKey: keys.audit, queryFn: () => api.auditLog(150), enabled });
}

export function useMembers(enabled = true) {
  const keys = useKeys();
  return useQuery({ queryKey: keys.members, queryFn: api.members, enabled });
}

/** Everything derived from catalog/order state is refetched after a write. */
function useInvalidate() {
  const client = useQueryClient();
  return (...scopes: Array<readonly unknown[]>) =>
    Promise.all(scopes.map((queryKey) => client.invalidateQueries({ queryKey })));
}

export function useSaveProduct() {
  const invalidate = useInvalidate();
  const keys = useKeys();
  return useMutation<
    Product,
    ApiError,
    {
      id?: string;
      values: Parameters<typeof api.createProduct>[0];
      stockChanged: boolean;
    }
  >({
    mutationFn: async ({ id, values, stockChanged }) => {
      if (!id) {
        return api.createProduct(values);
      }
      const { quantity, reorder_level, ...details } = values;
      const product = await api.updateProduct(id, details);
      if (stockChanged) {
        await api.updateInventory(id, { quantity, reorder_level });
      }
      return product;
    },
    onSettled: () => invalidate(keys.products, keys.summaries, keys.audit),
  });
}

export function useAdjustStock() {
  const client = useQueryClient();
  const invalidate = useInvalidate();
  const keys = useKeys();
  return useMutation<
    unknown,
    ApiError,
    { id: string; quantity: number; reorder_level: number },
    { previous?: Product[] }
  >({
    mutationFn: ({ id, ...payload }) => api.updateInventory(id, payload),
    // Optimistic: the stepper feels instant; a failure rolls the row back.
    onMutate: async ({ id, quantity, reorder_level }) => {
      await client.cancelQueries({ queryKey: keys.products });
      const previous = client.getQueryData<Product[]>(keys.products);
      client.setQueryData<Product[]>(keys.products, (products) =>
        products?.map((product) =>
          product.id === id
            ? {
                ...product,
                quantity,
                reorder_level,
                stock_status:
                  quantity <= 0 ? "out_of_stock" : quantity <= reorder_level ? "low_stock" : "in_stock",
              }
            : product,
        ),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        client.setQueryData(keys.products, context.previous);
      }
    },
    onSettled: () => invalidate(keys.products, keys.summaries, keys.audit),
  });
}

export function useSetProductActive() {
  const invalidate = useInvalidate();
  const keys = useKeys();
  return useMutation<Product, ApiError, { id: string; is_active: boolean }>({
    mutationFn: ({ id, is_active }) => api.updateProduct(id, { is_active }),
    onSettled: () => invalidate(keys.products, keys.summaries, keys.audit),
  });
}

export function useDeleteProduct() {
  const invalidate = useInvalidate();
  const keys = useKeys();
  return useMutation<void, ApiError, string>({
    mutationFn: api.deleteProduct,
    onSettled: () => invalidate(keys.products, keys.summaries, keys.audit),
  });
}

export function useCreateOrder() {
  const invalidate = useInvalidate();
  const keys = useKeys();
  return useMutation<Order, ApiError, Parameters<typeof api.createOrder>[0]>({
    mutationFn: api.createOrder,
    onSettled: () => invalidate(keys.orders, keys.products, keys.summaries, keys.audit),
  });
}

export function useOrderAction() {
  const invalidate = useInvalidate();
  const keys = useKeys();
  return useMutation<Order, ApiError, { id: string; action: "fulfill" | "cancel" }>({
    mutationFn: ({ id, action }) =>
      action === "fulfill" ? api.fulfillOrder(id) : api.cancelOrder(id),
    onSettled: () => invalidate(keys.orders, keys.products, keys.summaries, keys.audit),
  });
}

export function useCreateMember() {
  const invalidate = useInvalidate();
  const keys = useKeys();
  return useMutation({
    mutationFn: api.createMember,
    onSettled: () => invalidate(keys.members, keys.audit),
  });
}

export function useUpdateMember() {
  const invalidate = useInvalidate();
  const keys = useKeys();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof api.updateMember>[1]) =>
      api.updateMember(id, payload),
    onSettled: () => invalidate(keys.members, keys.audit),
  });
}

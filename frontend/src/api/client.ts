export type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type Product = {
  id: string;
  tenant_id: string;
  sku: string;
  name: string;
  description: string | null;
  unit_price: number;
  is_active: boolean;
};

export type Inventory = {
  id: string;
  tenant_id: string;
  product_id: string;
  quantity: number;
  reorder_level: number;
};

export type OrderItem = {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type Order = {
  id: string;
  tenant_id: string;
  created_by_user_id: string;
  status: string;
  total_amount: number;
  items: OrderItem[];
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";
type AuthRefreshHandler = () => Promise<string | null>;

let authRefreshHandler: AuthRefreshHandler | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function configureAuthRefresh(handler: AuthRefreshHandler | null): void {
  authRefreshHandler = handler;
}

export function buildHeaders(tenantSlug: string, accessToken?: string): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Tenant-Slug": tenantSlug,
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

async function request<T>(
  path: string,
  options: RequestInit,
  tenantSlug: string,
  accessToken?: string,
  allowRefresh = true
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...buildHeaders(tenantSlug, accessToken),
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    if (response.status === 401 && accessToken && authRefreshHandler && allowRefresh) {
      refreshInFlight ??= authRefreshHandler().finally(() => {
        refreshInFlight = null;
      });
      const refreshedAccessToken = await refreshInFlight;
      if (refreshedAccessToken) {
        return request<T>(path, options, tenantSlug, refreshedAccessToken, false);
      }
    }

    const fallback = `Request failed with status ${response.status}`;
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }

    if (typeof body === "object" && body !== null && "detail" in body) {
      const detail = body.detail;
      if (typeof detail === "string") {
        throw new Error(detail);
      }
      if (Array.isArray(detail)) {
        const messages = detail
          .map((item) => {
            if (typeof item === "object" && item !== null && "msg" in item) {
              return typeof item.msg === "string" ? item.msg : null;
            }
            return null;
          })
          .filter((message): message is string => message !== null);
        if (messages.length > 0) {
          throw new Error(messages.join("; "));
        }
      }
    }
    throw new Error(fallback);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export function register(data: {
  tenant_name: string;
  tenant_slug: string;
  email: string;
  password: string;
}): Promise<TokenPair> {
  return request<TokenPair>(
    "/auth/register",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    data.tenant_slug
  );
}

export function login(data: { tenant_slug: string; email: string; password: string }): Promise<TokenPair> {
  return request<TokenPair>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email: data.email, password: data.password }),
    },
    data.tenant_slug
  );
}

export function refreshToken(tenantSlug: string, refreshTokenValue: string): Promise<TokenPair> {
  return request<TokenPair>(
    "/auth/refresh",
    {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshTokenValue }),
    },
    tenantSlug
  );
}

export function listProducts(tenantSlug: string, accessToken: string): Promise<Product[]> {
  return request<Product[]>("/products", { method: "GET" }, tenantSlug, accessToken);
}

export function createProduct(
  tenantSlug: string,
  accessToken: string,
  payload: { sku: string; name: string; description?: string; unit_price: number }
): Promise<Product> {
  return request<Product>(
    "/products",
    { method: "POST", body: JSON.stringify(payload) },
    tenantSlug,
    accessToken
  );
}

export function getInventory(
  tenantSlug: string,
  accessToken: string,
  productId: string
): Promise<Inventory> {
  return request<Inventory>(`/inventory/${productId}`, { method: "GET" }, tenantSlug, accessToken);
}

export function updateInventory(
  tenantSlug: string,
  accessToken: string,
  productId: string,
  payload: { quantity: number; reorder_level: number }
): Promise<Inventory> {
  return request<Inventory>(
    `/inventory/${productId}`,
    { method: "PUT", body: JSON.stringify(payload) },
    tenantSlug,
    accessToken
  );
}

export function listOrders(tenantSlug: string, accessToken: string): Promise<Order[]> {
  return request<Order[]>("/orders", { method: "GET" }, tenantSlug, accessToken);
}

export function createOrder(
  tenantSlug: string,
  accessToken: string,
  payload: { items: Array<{ product_id: string; quantity: number }> }
): Promise<Order> {
  return request<Order>(
    "/orders",
    { method: "POST", body: JSON.stringify(payload) },
    tenantSlug,
    accessToken
  );
}

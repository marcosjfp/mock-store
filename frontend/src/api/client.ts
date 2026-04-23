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

type ApiErrorValidation = {
  msg?: string;
};

function normalizeTenantSlug(tenantSlug: string): string {
  return tenantSlug.trim().toLowerCase();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parseApiError(body: unknown): string | null {
  if (typeof body === "object" && body !== null) {
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim().length > 0) {
      return detail;
    }

    if (Array.isArray(detail)) {
      const messages = detail
        .map((entry) => {
          if (typeof entry === "string") {
            return entry.trim();
          }
          if (typeof entry === "object" && entry !== null) {
            const msg = (entry as ApiErrorValidation).msg;
            return typeof msg === "string" ? msg.trim() : "";
          }
          return "";
        })
        .filter((msg) => msg.length > 0);

      if (messages.length > 0) {
        return messages.join(". ");
      }
    }
  }

  return null;
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
  accessToken?: string
): Promise<T> {
  const normalizedTenantSlug = normalizeTenantSlug(tenantSlug);
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...buildHeaders(normalizedTenantSlug, accessToken),
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const fallback = `Request failed with status ${response.status}`;
    let parsedError: string | null = null;

    try {
      const body = await response.json();
      parsedError = parseApiError(body);
    } catch {
      parsedError = null;
    }

    throw new Error(parsedError ?? fallback);
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
  const payload = {
    tenant_name: data.tenant_name.trim(),
    tenant_slug: normalizeTenantSlug(data.tenant_slug),
    email: normalizeEmail(data.email),
    password: data.password,
  };

  return request<TokenPair>(
    "/auth/register",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    payload.tenant_slug
  );
}

export function login(data: { tenant_slug: string; email: string; password: string }): Promise<TokenPair> {
  const payload = {
    tenant_slug: normalizeTenantSlug(data.tenant_slug),
    email: normalizeEmail(data.email),
    password: data.password,
  };

  return request<TokenPair>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email: payload.email, password: payload.password }),
    },
    payload.tenant_slug
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

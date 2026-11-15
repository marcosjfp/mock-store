/**
 * Typed API client.
 *
 * - Every request carries the tenant slug header and, when signed in, a bearer token.
 * - A 401 triggers one silent token refresh (shared by all in-flight requests),
 *   then the original request is retried once.
 * - Failures surface as `ApiError` with a human-readable message.
 */

export type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";
export type OrderStatus = "placed" | "fulfilled" | "cancelled";
export type Role = "owner" | "manager" | "staff";

export type Product = {
  id: string;
  tenant_id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string;
  unit_price: number;
  is_active: boolean;
  quantity: number;
  reorder_level: number;
  stock_status: StockStatus;
  created_at: string | null;
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
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type Order = {
  id: string;
  number: number;
  tenant_id: string;
  created_by_user_id: string;
  created_by_email: string | null;
  created_by_name: string | null;
  customer_name: string | null;
  status: OrderStatus;
  total_amount: number;
  item_count: number;
  created_at: string | null;
  updated_at: string | null;
  items: OrderItem[];
};

export type Member = {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string | null;
  role: Role;
  is_active: boolean;
  created_at: string | null;
};

export type Session = Member & { tenant_name: string; tenant_slug: string };

export type Metric = { value: number; previous: number; change_pct: number | null };

export type AnalyticsSummary = {
  days: number;
  revenue: Metric;
  orders: Metric;
  average_order_value: Metric;
  units_sold: Metric;
  cancelled_orders: number;
  open_orders: number;
  series: Array<{ date: string; revenue: number; orders: number }>;
  top_products: Array<{
    product_id: string;
    name: string;
    sku: string;
    category: string;
    units: number;
    revenue: number;
  }>;
  categories: Array<{ category: string; revenue: number; units: number }>;
  inventory: {
    active_products: number;
    total_units: number;
    stock_value: number;
    in_stock: number;
    low_stock: number;
    out_of_stock: number;
  };
  low_stock: Array<{
    product_id: string;
    name: string;
    sku: string;
    category: string;
    quantity: number;
    reorder_level: number;
  }>;
};

export type AuditEntry = {
  id: string;
  event_type: string;
  resource_type: "product" | "inventory" | "order" | "member" | string;
  resource_id: string;
  summary: string;
  details: Record<string, unknown>;
  actor_email: string | null;
  actor_name: string | null;
  created_at: string;
};

export type ProductInput = {
  sku: string;
  name: string;
  description: string | null;
  category: string;
  unit_price: number;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

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

/** Turn a FastAPI error body into one readable sentence. */
export function describeError(body: unknown, status: number): string {
  const fallback =
    status >= 500
      ? "The server ran into a problem. Please try again."
      : `Request failed (${status})`;
  if (!body || typeof body !== "object" || !("detail" in body)) {
    return fallback;
  }
  const detail = (body as { detail: unknown }).detail;
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail) && detail.length > 0) {
    // Pydantic validation errors: [{ loc: ["body", "field"], msg: "..." }]
    return detail
      .map((issue: { loc?: unknown[]; msg?: string }) => {
        const field = issue.loc?.filter((part) => part !== "body").join(".");
        return field ? `${field}: ${issue.msg}` : (issue.msg ?? "Invalid value");
      })
      .join(" · ");
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Session plumbing — the auth context registers itself here so the client can
// read fresh tokens and report rotations without importing React state.
// ---------------------------------------------------------------------------

export type SessionTokens = {
  tenantSlug: string;
  accessToken: string;
  refreshToken: string;
};

type SessionBridge = {
  get: () => SessionTokens | null;
  onRefresh: (tokens: SessionTokens) => void;
  onExpire: () => void;
};

let bridge: SessionBridge | null = null;
let refreshInFlight: Promise<SessionTokens | null> | null = null;

export function connectSession(next: SessionBridge | null): void {
  bridge = next;
}

async function send(path: string, init: RequestInit, tenantSlug: string, token?: string) {
  try {
    return await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...buildHeaders(tenantSlug, token), ...(init.headers ?? {}) },
    });
  } catch {
    throw new ApiError("Can't reach the server. Check that the API is running.", 0);
  }
}

async function parse<T>(response: Response): Promise<T> {
  if (response.ok) {
    return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON error body — fall back to the status-based message.
  }
  throw new ApiError(describeError(body, response.status), response.status);
}

function refreshSession(current: SessionTokens): Promise<SessionTokens | null> {
  // Single flight: concurrent 401s share one refresh, because refresh tokens
  // are single-use and a second attempt would be rejected.
  refreshInFlight ??= (async () => {
    try {
      const response = await send(
        "/auth/refresh",
        { method: "POST", body: JSON.stringify({ refresh_token: current.refreshToken }) },
        current.tenantSlug,
      );
      const pair = await parse<TokenPair>(response);
      const next: SessionTokens = {
        tenantSlug: current.tenantSlug,
        accessToken: pair.access_token,
        refreshToken: pair.refresh_token,
      };
      bridge?.onRefresh(next);
      return next;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/** Authenticated request using the connected session. */
async function authed<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = bridge?.get();
  if (!session) {
    throw new ApiError("You are signed out.", 401);
  }

  let response = await send(path, init, session.tenantSlug, session.accessToken);
  if (response.status === 401) {
    const renewed = await refreshSession(session);
    if (!renewed) {
      bridge?.onExpire();
      throw new ApiError("Your session expired. Please sign in again.", 401);
    }
    response = await send(path, init, renewed.tenantSlug, renewed.accessToken);
  }
  return parse<T>(response);
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export async function register(data: {
  tenant_name: string;
  tenant_slug: string;
  full_name?: string;
  email: string;
  password: string;
}): Promise<TokenPair> {
  return parse<TokenPair>(await send("/auth/register", json("POST", data), data.tenant_slug));
}

export async function login(data: {
  tenant_slug: string;
  email: string;
  password: string;
}): Promise<TokenPair> {
  return parse<TokenPair>(
    await send(
      "/auth/login",
      json("POST", { email: data.email, password: data.password }),
      data.tenant_slug,
    ),
  );
}

export async function logout(tokens: SessionTokens): Promise<void> {
  try {
    await send(
      "/auth/logout",
      json("POST", { refresh_token: tokens.refreshToken }),
      tokens.tenantSlug,
    );
  } catch {
    // Signing out locally still works if the server is unreachable.
  }
}

export const api = {
  me: () => authed<Session>("/auth/me"),

  products: () => authed<Product[]>("/products"),
  createProduct: (payload: ProductInput & { quantity: number; reorder_level: number }) =>
    authed<Product>("/products", json("POST", payload)),
  updateProduct: (id: string, payload: Partial<ProductInput> & { is_active?: boolean }) =>
    authed<Product>(`/products/${id}`, json("PUT", payload)),
  deleteProduct: (id: string) => authed<void>(`/products/${id}`, json("DELETE")),
  updateInventory: (id: string, payload: { quantity: number; reorder_level: number }) =>
    authed<Inventory>(`/inventory/${id}`, json("PUT", payload)),

  orders: () => authed<Order[]>("/orders"),
  createOrder: (payload: {
    customer_name: string | null;
    items: Array<{ product_id: string; quantity: number }>;
  }) => authed<Order>("/orders", json("POST", payload)),
  fulfillOrder: (id: string) => authed<Order>(`/orders/${id}/fulfill`, json("POST")),
  cancelOrder: (id: string) => authed<Order>(`/orders/${id}/cancel`, json("POST")),

  summary: (days: number) => authed<AnalyticsSummary>(`/analytics/summary?days=${days}`),
  auditLog: (limit = 100) => authed<AuditEntry[]>(`/audit-logs?limit=${limit}`),

  members: () => authed<Member[]>("/auth/users"),
  createMember: (payload: {
    email: string;
    password: string;
    role: Exclude<Role, "owner">;
    full_name: string | null;
  }) => authed<Member>("/auth/users", json("POST", payload)),
  updateMember: (
    id: string,
    payload: { role?: Exclude<Role, "owner">; is_active?: boolean },
  ) => authed<Member>(`/auth/users/${id}`, json("PATCH", payload)),
};

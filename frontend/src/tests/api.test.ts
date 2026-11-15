import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, SessionTokens, api, connectSession, describeError } from "../api/client";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("describeError", () => {
  it("uses the API's detail string", () => {
    expect(describeError({ detail: "SKU 'A' is already in use" }, 409)).toBe("SKU 'A' is already in use");
  });

  it("flattens validation errors into one sentence", () => {
    const body = {
      detail: [
        { loc: ["body", "unit_price"], msg: "Input should be greater than 0" },
        { loc: ["body", "name"], msg: "String should have at least 2 characters" },
      ],
    };
    expect(describeError(body, 422)).toBe(
      "unit_price: Input should be greater than 0 · name: String should have at least 2 characters",
    );
  });

  it("falls back to a generic message", () => {
    expect(describeError(null, 404)).toBe("Request failed (404)");
    expect(describeError("oops", 500)).toMatch(/server ran into a problem/);
  });
});

describe("authenticated requests", () => {
  let session: SessionTokens | null;
  const onRefresh = vi.fn((next: SessionTokens) => {
    session = next;
  });
  const onExpire = vi.fn(() => {
    session = null;
  });
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    session = { tenantSlug: "rail-byte", accessToken: "old-access", refreshToken: "old-refresh" };
    connectSession({ get: () => session, onRefresh, onExpire });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    connectSession(null);
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    fetchMock.mockReset();
  });

  const authHeader = (call: number) =>
    (fetchMock.mock.calls[call][1]?.headers as Record<string, string>).Authorization;

  it("sends the tenant header and bearer token", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, []));

    await api.products();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/products");
    expect((init?.headers as Record<string, string>)["X-Tenant-Slug"]).toBe("rail-byte");
    expect(authHeader(0)).toBe("Bearer old-access");
  });

  it("surfaces the server's error message", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(409, { detail: "Not enough stock for RTX 4060" }));

    await expect(api.orders()).rejects.toMatchObject({
      name: "ApiError",
      status: 409,
      message: "Not enough stock for RTX 4060",
    });
  });

  it("refreshes once on 401 and retries with the new token", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { detail: "Invalid token" }))
      .mockResolvedValueOnce(jsonResponse(200, { access_token: "new-access", refresh_token: "new-refresh" }))
      .mockResolvedValueOnce(jsonResponse(200, []));

    await expect(api.products()).resolves.toEqual([]);

    expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/auth/refresh");
    expect(authHeader(2)).toBe("Bearer new-access");
    expect(onRefresh).toHaveBeenCalledWith({
      tenantSlug: "rail-byte",
      accessToken: "new-access",
      refreshToken: "new-refresh",
    });
  });

  it("shares a single refresh between concurrent 401s", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) {
        return jsonResponse(200, { access_token: "new-access", refresh_token: "new-refresh" });
      }
      const token = (init?.headers as Record<string, string>).Authorization;
      return token === "Bearer old-access" ? jsonResponse(401, { detail: "Invalid token" }) : jsonResponse(200, []);
    });

    await Promise.all([api.products(), api.orders(), api.members()]);

    const refreshCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/auth/refresh"));
    expect(refreshCalls).toHaveLength(1);
  });

  it("expires the session when the refresh token is rejected", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { detail: "Invalid token" }))
      .mockResolvedValueOnce(jsonResponse(401, { detail: "Refresh token revoked" }));

    await expect(api.products()).rejects.toBeInstanceOf(ApiError);
    expect(onExpire).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports an unreachable server clearly", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(api.products()).rejects.toMatchObject({ status: 0, message: expect.stringMatching(/reach the server/) });
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { buildHeaders, login } from "../api/client";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildHeaders", () => {
  it("includes tenant and authorization headers", () => {
    const headers = buildHeaders("rail-byte", "token123") as Record<string, string>;

    expect(headers["X-Tenant-Slug"]).toBe("rail-byte");
    expect(headers.Authorization).toBe("Bearer token123");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("omits authorization when token is missing", () => {
    const headers = buildHeaders("rail-byte") as Record<string, string>;

    expect(headers["X-Tenant-Slug"]).toBe("rail-byte");
    expect(headers.Authorization).toBeUndefined();
  });
});

describe("login", () => {
  it("normalizes tenant slug and email before requesting", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "a",
          refresh_token: "b",
          token_type: "bearer",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    await login({
      tenant_slug: "  RAIL-BYTE-DEMO  ",
      email: "  OWNER@RAILBYTE.COM  ",
      password: "StrongPass123!",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [, options] = fetchSpy.mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    expect(headers["X-Tenant-Slug"]).toBe("rail-byte-demo");

    const body = JSON.parse(String(options?.body)) as { email: string };
    expect(body.email).toBe("owner@railbyte.com");
  });

  it("surfaces API detail message for auth errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Invalid credentials" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(
      login({
        tenant_slug: "rail-byte-demo",
        email: "owner@railbyte.com",
        password: "wrong-password",
      })
    ).rejects.toThrow("Invalid credentials");
  });
});

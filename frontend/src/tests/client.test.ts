import { describe, expect, it } from "vitest";

import { buildHeaders } from "../api/client";

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

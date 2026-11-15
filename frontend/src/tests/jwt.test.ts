import { describe, expect, it } from "vitest";

import { getRoleFromAccessToken } from "../auth/jwt";
import { USER_ROLES } from "../auth/roles";

function buildToken(payload: object): string {
  const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.x`;
}

describe("getRoleFromAccessToken", () => {
  it("extracts role claim from JWT payload", () => {
    const token = buildToken({ rol: USER_ROLES.MANAGER });
    expect(getRoleFromAccessToken(token)).toBe(USER_ROLES.MANAGER);
  });

  it("falls back to staff for invalid payloads", () => {
    expect(getRoleFromAccessToken("bad.token")).toBe(USER_ROLES.STAFF);
  });
});

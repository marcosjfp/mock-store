import { describe, expect, it } from "vitest";

import { USER_ROLES, canManageCatalog, formatRoleLabel } from "../auth/roles";

describe("role helpers", () => {
  it("allows owner and manager to manage catalog", () => {
    expect(canManageCatalog(USER_ROLES.OWNER)).toBe(true);
    expect(canManageCatalog(USER_ROLES.MANAGER)).toBe(true);
  });

  it("blocks staff from catalog write actions", () => {
    expect(canManageCatalog(USER_ROLES.STAFF)).toBe(false);
  });

  it("formats role labels for UI", () => {
    expect(formatRoleLabel(USER_ROLES.OWNER)).toBe("Owner");
    expect(formatRoleLabel(USER_ROLES.MANAGER)).toBe("Manager");
    expect(formatRoleLabel(USER_ROLES.STAFF)).toBe("Staff");
  });
});

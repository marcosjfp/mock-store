export const USER_ROLES = {
  OWNER: "owner",
  MANAGER: "manager",
  STAFF: "staff",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

/** Mirrors the API's role guards so the UI only offers what will succeed. */
export function canManageCatalog(role: UserRole): boolean {
  return role === USER_ROLES.OWNER || role === USER_ROLES.MANAGER;
}

export function canCancelOrders(role: UserRole): boolean {
  return canManageCatalog(role);
}

export function canViewWorkspace(role: UserRole): boolean {
  return canManageCatalog(role);
}

export function canManageTeam(role: UserRole): boolean {
  return role === USER_ROLES.OWNER;
}

export function formatRoleLabel(role: UserRole): string {
  if (role === USER_ROLES.OWNER) {
    return "Owner";
  }
  if (role === USER_ROLES.MANAGER) {
    return "Manager";
  }
  return "Staff";
}

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  owner: "Full control, including the team",
  manager: "Manages catalog, stock and orders",
  staff: "Sells and fulfils orders",
};

export const USER_ROLES = {
  OWNER: "owner",
  MANAGER: "manager",
  STAFF: "staff",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export function canManageCatalog(role: UserRole): boolean {
  return role === USER_ROLES.OWNER || role === USER_ROLES.MANAGER;
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

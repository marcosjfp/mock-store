import { USER_ROLES, UserRole } from "./roles";

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return atob(padded);
}

export function getRoleFromAccessToken(accessToken: string): UserRole {
  try {
    const payloadPart = accessToken.split(".")[1];
    if (!payloadPart) {
      return USER_ROLES.STAFF;
    }

    const payload = JSON.parse(decodeBase64Url(payloadPart)) as {
      rol?: string;
    };

    if (
      payload.rol === USER_ROLES.OWNER ||
      payload.rol === USER_ROLES.MANAGER ||
      payload.rol === USER_ROLES.STAFF
    ) {
      return payload.rol;
    }
  } catch {
    return USER_ROLES.STAFF;
  }

  return USER_ROLES.STAFF;
}

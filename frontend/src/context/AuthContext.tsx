import { createContext, useContext, useMemo, useState } from "react";

import { getRoleFromAccessToken } from "../auth/jwt";
import { UserRole } from "../auth/roles";

export type AuthState = {
  accessToken: string;
  refreshToken: string;
  tenantSlug: string;
  role: UserRole;
};

type AuthContextValue = {
  auth: AuthState | null;
  setAuth: (nextAuth: AuthState) => void;
  clearAuth: () => void;
};

const STORAGE_KEY = "storeops-auth";
const AuthContext = createContext<AuthContextValue | null>(null);

function loadInitialAuth(): AuthState | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AuthState>;
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.tenantSlug) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      tenantSlug: parsed.tenantSlug,
      role: parsed.role ?? getRoleFromAccessToken(parsed.accessToken),
    };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuthState] = useState<AuthState | null>(loadInitialAuth);

  const value = useMemo<AuthContextValue>(
    () => ({
      auth,
      setAuth: (nextAuth) => {
        setAuthState(nextAuth);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextAuth));
      },
      clearAuth: () => {
        setAuthState(null);
        localStorage.removeItem(STORAGE_KEY);
      },
    }),
    [auth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

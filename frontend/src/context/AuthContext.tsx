import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import { SessionTokens, connectSession, logout as logoutRequest } from "../api/client";
import { getRoleFromAccessToken } from "../auth/jwt";
import { UserRole } from "../auth/roles";

export type AuthState = SessionTokens & { role: UserRole };

type AuthContextValue = {
  auth: AuthState | null;
  signIn: (tokens: SessionTokens) => void;
  signOut: () => void;
  /** Ends a session the server no longer accepts and explains why on sign-in. */
  expire: () => void;
  /** True when the last session ended because it expired, not by choice. */
  expired: boolean;
};

const STORAGE_KEY = "storeops-auth";
const AuthContext = createContext<AuthContextValue | null>(null);

function withRole(tokens: SessionTokens): AuthState {
  return { ...tokens, role: getRoleFromAccessToken(tokens.accessToken) };
}

function loadInitialAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<SessionTokens>;
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.tenantSlug) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return withRole({
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      tenantSlug: parsed.tenantSlug,
    });
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function persist(tokens: SessionTokens | null) {
  if (tokens) {
    const { tenantSlug, accessToken, refreshToken } = tokens;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tenantSlug, accessToken, refreshToken }));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(loadInitialAuth);
  const [expired, setExpired] = useState(false);

  // The API client reads tokens through this ref so that a refresh performed
  // mid-request is visible immediately, before React re-renders.
  const current = useRef(auth);
  current.current = auth;

  const apply = useCallback((tokens: SessionTokens | null) => {
    const next = tokens ? withRole(tokens) : null;
    current.current = next;
    persist(next);
    setAuth(next);
  }, []);

  // Connected during render, not in an effect: child effects (where queries
  // start fetching) run before parent effects, so an effect here would be too
  // late for the first requests after a page reload.
  const bridge = useRef({
    get: () => current.current,
    onRefresh: apply,
    onExpire: () => {
      setExpired(true);
      apply(null);
    },
  });
  connectSession(bridge.current);

  const value = useMemo<AuthContextValue>(
    () => ({
      auth,
      expired,
      signIn: (tokens) => {
        setExpired(false);
        apply(tokens);
      },
      expire: () => bridge.current.onExpire(),
      signOut: () => {
        if (current.current) {
          void logoutRequest(current.current);
        }
        setExpired(false);
        apply(null);
      },
    }),
    [auth, expired, apply],
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

/** For screens rendered behind the auth gate, where a session is guaranteed. */
export function useSession(): AuthState {
  const { auth } = useAuth();
  if (!auth) {
    throw new Error("useSession requires an authenticated user");
  }
  return auth;
}

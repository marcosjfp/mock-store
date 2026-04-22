import { FormEvent, useState } from "react";

import { login, register } from "../api/client";
import { getRoleFromAccessToken } from "../auth/jwt";
import { AuthState } from "../context/AuthContext";

type LoginPageProps = {
  onAuthenticated: (auth: AuthState) => void;
};

export default function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [isRegister, setIsRegister] = useState(true);
  const [tenantName, setTenantName] = useState("Rail Byte Components");
  const [tenantSlug, setTenantSlug] = useState("rail-byte");
  const [email, setEmail] = useState("owner@railbyte.com");
  const [password, setPassword] = useState("StrongPass123!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const tokens = isRegister
        ? await register({
            tenant_name: tenantName,
            tenant_slug: tenantSlug,
            email,
            password,
          })
        : await login({ tenant_slug: tenantSlug, email, password });

      onAuthenticated({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tenantSlug,
        role: getRoleFromAccessToken(tokens.access_token),
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to authenticate");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">StoreOps Blueprint</p>
        <h1>Multi-tenant SaaS Trainer</h1>
        <p className="subtitle">
          Practice FastAPI + React with realistic tenant-aware auth, CRUD, queueing, and caching.
        </p>

        <div className="switch-row">
          <button className={!isRegister ? "ghost" : "active"} onClick={() => setIsRegister(true)} type="button">
            Register tenant
          </button>
          <button className={isRegister ? "ghost" : "active"} onClick={() => setIsRegister(false)} type="button">
            Log in
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {isRegister && (
            <label>
              Tenant name
              <input value={tenantName} onChange={(event) => setTenantName(event.target.value)} required />
            </label>
          )}

          <label>
            Tenant slug
            <input value={tenantSlug} onChange={(event) => setTenantSlug(event.target.value)} required />
          </label>

          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? "Working..." : isRegister ? "Create tenant" : "Sign in"}
          </button>

          {error && <p className="error-text">{error}</p>}
        </form>
      </section>
    </main>
  );
}

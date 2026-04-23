import { FormEvent, useState } from "react";

import { login, register } from "../api/client";
import { getRoleFromAccessToken } from "../auth/jwt";
import { AuthState } from "../context/AuthContext";

const DEMO_TENANT_NAME = "Rail Byte Components";
const DEMO_TENANT_SLUG = "rail-byte-demo";
const DEMO_PASSWORD = "StrongPass123!";

const DEMO_USERS = [
  { label: "Owner", email: "owner@railbyte.com" },
  { label: "Manager", email: "manager@railbyte.com" },
  { label: "Staff", email: "staff@railbyte.com" },
];

type LoginPageProps = {
  onAuthenticated: (auth: AuthState) => void;
};

export default function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [tenantName, setTenantName] = useState(DEMO_TENANT_NAME);
  const [tenantSlug, setTenantSlug] = useState(DEMO_TENANT_SLUG);
  const [email, setEmail] = useState("owner@railbyte.com");
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyDemoUser(nextEmail: string) {
    setTenantName(DEMO_TENANT_NAME);
    setTenantSlug(DEMO_TENANT_SLUG);
    setEmail(nextEmail);
    setPassword(DEMO_PASSWORD);
    setIsRegister(false);
    setError(null);
  }

  function switchMode(nextIsRegister: boolean) {
    setIsRegister(nextIsRegister);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) {
      return;
    }

    setError(null);
    setLoading(true);

    const normalizedTenantSlug = tenantSlug.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const tokens = isRegister
        ? await register({
            tenant_name: tenantName.trim(),
            tenant_slug: normalizedTenantSlug,
            email: normalizedEmail,
            password,
          })
        : await login({ tenant_slug: normalizedTenantSlug, email: normalizedEmail, password });

      onAuthenticated({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tenantSlug: normalizedTenantSlug,
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
          Practice FastAPI + React with realistic employee-aware auth, CRUD, queueing, and caching.
        </p>

        <div className="switch-row">
          <button className={!isRegister ? "ghost" : "active"} onClick={() => switchMode(true)} type="button">
            Register tenant
          </button>
          <button className={isRegister ? "ghost" : "active"} onClick={() => switchMode(false)} type="button">
            Log in
          </button>
        </div>

        <section className="demo-box">
          <p>Quick demo login</p>
          <small>
            Tenant slug: <strong>{DEMO_TENANT_SLUG}</strong>
          </small>
          <div className="demo-grid">
            {DEMO_USERS.map((user) => (
              <button
                key={user.email}
                className="ghost"
                type="button"
                onClick={() => applyDemoUser(user.email)}
                disabled={loading}
              >
                {user.label}
              </button>
            ))}
          </div>
        </section>

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

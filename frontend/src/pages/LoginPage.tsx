import { ArrowRight, Boxes, CircleAlert, KeyRound, ShieldCheck, Zap } from "lucide-react";
import { FormEvent, useState } from "react";

import { ApiError, Role, login, register } from "../api/client";
import { formatRoleLabel } from "../auth/roles";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { Avatar, Segmented } from "../components/ui/primitives";
import { useAuth } from "../context/AuthContext";
import { Logo } from "../layout/Logo";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, DEMO_TENANT } from "../lib/demo";
import { slugify } from "../lib/format";

type Mode = "signin" | "register";

const HIGHLIGHTS = [
  { icon: ShieldCheck, title: "Tenant-isolated by design", text: "Every request is scoped by workspace header and JWT claim." },
  { icon: KeyRound, title: "Role-based access", text: "Owner, manager and staff see exactly what they can act on." },
  { icon: Zap, title: "Stock that stays honest", text: "Orders reserve inventory atomically; cancelling returns it." },
];

export default function LoginPage() {
  const { signIn, expired } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [tenantName, setTenantName] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState<"form" | Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function authenticate(kind: "form" | Role, run: () => Promise<{ access_token: string; refresh_token: string }>, slug: string) {
    setError(null);
    setPending(kind);
    try {
      const tokens = await run();
      signIn({ tenantSlug: slug, accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
    } catch (failure) {
      const message = failure instanceof ApiError ? failure.message : "Unable to sign in";
      setError(
        kind !== "form" && failure instanceof ApiError && failure.status === 401
          ? "The demo workspace isn’t seeded yet. Run `python scripts/seed_demo.py` in the backend folder."
          : message,
      );
    } finally {
      setPending(null);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const slug = tenantSlug.trim();
    void authenticate(
      "form",
      () =>
        mode === "register"
          ? register({
              tenant_name: tenantName.trim(),
              tenant_slug: slug,
              full_name: fullName.trim() || undefined,
              email: email.trim(),
              password,
            })
          : login({ tenant_slug: slug, email: email.trim(), password }),
      slug,
    );
  }

  function demoSignIn(account: (typeof DEMO_ACCOUNTS)[number]) {
    void authenticate(
      account.role,
      () => login({ tenant_slug: DEMO_TENANT, email: account.email, password: DEMO_PASSWORD }),
      DEMO_TENANT,
    );
  }

  return (
    <div className="auth">
      <section className="auth-aside" aria-hidden={false}>
        <div className="auth-brand">
          <Logo size={32} />
          <span>StoreOps</span>
        </div>

        <div className="auth-pitch">
          <h1>Orders and inventory for teams that sell hardware.</h1>
          <p>
            A multi-tenant back office: live stock, order fulfilment, sales analytics and a full audit
            trail — one workspace per store.
          </p>
          <ul>
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <span className="auth-pitch-icon">
                  <Icon aria-hidden />
                </span>
                <div>
                  <strong>{title}</strong>
                  <span>{text}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="auth-stack">
          <Boxes aria-hidden /> FastAPI · PostgreSQL · Redis · RabbitMQ · React
        </p>
      </section>

      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-brand auth-brand-mobile">
            <Logo size={28} />
            <span>StoreOps</span>
          </div>

          <h2>{mode === "signin" ? "Sign in to your workspace" : "Create a workspace"}</h2>
          <p className="auth-lede">
            {mode === "signin"
              ? "Use your workspace ID and account, or jump straight into the demo."
              : "You’ll be the owner and can invite your team afterwards."}
          </p>

          {expired && !error && (
            <div className="callout" data-tone="accent" role="status">
              <CircleAlert />
              <span>Your session expired. Sign in again to continue.</span>
            </div>
          )}

          <Segmented
            label="Authentication mode"
            value={mode}
            onChange={(next) => {
              setMode(next);
              setError(null);
            }}
            options={[
              { value: "signin", label: "Sign in" },
              { value: "register", label: "New workspace" },
            ]}
          />

          <form className="form-grid" onSubmit={handleSubmit} noValidate={false}>
            {mode === "register" && (
              <>
                <Field label="Store name">
                  {(control) => (
                    <input
                      {...control}
                      className="input"
                      value={tenantName}
                      placeholder="Rail Byte Components"
                      onChange={(event) => {
                        setTenantName(event.target.value);
                        if (!slugEdited) {
                          setTenantSlug(slugify(event.target.value));
                        }
                      }}
                      minLength={2}
                      maxLength={120}
                      required
                    />
                  )}
                </Field>
                <Field label="Your name">
                  {(control) => (
                    <input
                      {...control}
                      className="input"
                      value={fullName}
                      autoComplete="name"
                      onChange={(event) => setFullName(event.target.value)}
                      maxLength={120}
                    />
                  )}
                </Field>
              </>
            )}

            <Field
              label="Workspace ID"
              hint={mode === "register" ? "Lowercase letters, numbers and dashes. Your team signs in with this." : undefined}
            >
              {(control) => (
                <input
                  {...control}
                  className="input mono"
                  value={tenantSlug}
                  placeholder="rail-byte"
                  autoCapitalize="none"
                  spellCheck={false}
                  onChange={(event) => {
                    setSlugEdited(true);
                    setTenantSlug(event.target.value.toLowerCase());
                  }}
                  pattern="[a-z0-9\-]+"
                  minLength={2}
                  maxLength={80}
                  required
                />
              )}
            </Field>

            <Field label="Email">
              {(control) => (
                <input
                  {...control}
                  className="input"
                  type="email"
                  value={email}
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              )}
            </Field>

            <Field label="Password" hint={mode === "register" ? "At least 8 characters." : undefined}>
              {(control) => (
                <input
                  {...control}
                  className="input"
                  type="password"
                  value={password}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  required
                />
              )}
            </Field>

            {error && (
              <div className="callout" data-tone="critical" role="alert">
                <CircleAlert />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" block loading={pending === "form"} disabled={pending !== null}>
              {mode === "signin" ? "Sign in" : "Create workspace"}
            </Button>
          </form>

          <div className="auth-demo">
            <div className="auth-divider">
              <span>or explore the demo store as</span>
            </div>
            <ul>
              {DEMO_ACCOUNTS.map((account) => (
                <li key={account.role}>
                  <button type="button" disabled={pending !== null} onClick={() => demoSignIn(account)}>
                    <Avatar name={account.name} />
                    <span>
                      <strong>{formatRoleLabel(account.role)}</strong>
                      <span>{account.blurb}</span>
                    </span>
                    {pending === account.role ? <span className="spinner" aria-hidden /> : <ArrowRight aria-hidden />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

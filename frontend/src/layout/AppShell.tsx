import { LogOut, Menu, Moon, Plus, Search, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

import { ApiError } from "../api/client";
import { formatRoleLabel } from "../auth/roles";
import { Button } from "../components/ui/Button";
import { Avatar, Kbd, Skeleton } from "../components/ui/primitives";
import { useAuth, useSession } from "../context/AuthContext";
import { useMe, useSummary } from "../hooks/queries";
import { useTheme } from "../hooks/useTheme";
import { displayName } from "../lib/format";
import { CommandPalette } from "./CommandPalette";
import { Logo } from "./Logo";
import { visibleSections } from "./navigation";

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export function AppShell() {
  const { role, tenantSlug } = useSession();
  const { signOut, expire } = useAuth();
  const { theme, toggle } = useTheme();
  const me = useMe();
  const summary = useSummary(30);
  const location = useLocation();

  // If the server rejects the session outright (workspace removed, account
  // deactivated, token for another tenant), return to sign-in rather than
  // leaving the user on a page of errors.
  const sessionRejected =
    me.error instanceof ApiError && [401, 403, 404].includes(me.error.status);
  useEffect(() => {
    if (sessionRejected) {
      expire();
    }
  }, [sessionRejected, expire]);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // A new page starts at the top, with the mobile nav closed.
  useEffect(() => {
    setNavOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const openOrders = summary.data?.open_orders ?? 0;
  const stockAlerts = summary.data ? summary.data.inventory.low_stock + summary.data.inventory.out_of_stock : 0;
  const counters: Record<string, number> = { "/orders": openOrders, "/catalog": stockAlerts };

  return (
    <div className="shell" data-nav-open={navOpen || undefined}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <aside className="sidebar" aria-label="Primary">
        <div className="workspace">
          <Logo />
          <div style={{ minWidth: 0 }}>
            {me.data ? (
              <strong className="truncate">{me.data.tenant_name}</strong>
            ) : (
              <Skeleton width={120} height={13} />
            )}
            <span className="mono truncate">{tenantSlug}</span>
          </div>
          <Button
            className="sidebar-close"
            variant="ghost"
            size="sm"
            iconOnly
            icon={<X />}
            aria-label="Close menu"
            onClick={() => setNavOpen(false)}
          />
        </div>

        <nav className="nav">
          {visibleSections(role).map((section) => (
            <div key={section.title} className="nav-section">
              <h2>{section.title}</h2>
              <ul>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const count = counters[item.to];
                  return (
                    <li key={item.to}>
                      <NavLink to={item.to} end={item.end} className="nav-link">
                        <Icon aria-hidden />
                        <span>{item.label}</span>
                        {count > 0 && (
                          <span
                            className="nav-count num"
                            title={item.to === "/orders" ? `${count} open orders` : `${count} products need restocking`}
                          >
                            {count}
                          </span>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="account">
          <Avatar name={me.data?.full_name} email={me.data?.email} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <strong className="truncate">{me.data ? displayName(me.data.full_name, me.data.email) : "…"}</strong>
            <span>{formatRoleLabel(role)}</span>
          </div>
          <Button variant="ghost" size="sm" iconOnly icon={<LogOut />} aria-label="Sign out" title="Sign out" onClick={signOut} />
        </div>
      </aside>

      <div className="scrim" onClick={() => setNavOpen(false)} aria-hidden />

      <div className="main-column">
        <header className="topbar">
          <Button
            className="menu-button"
            variant="ghost"
            iconOnly
            icon={<Menu />}
            aria-label="Open menu"
            onClick={() => setNavOpen(true)}
          />
          <button type="button" className="search-trigger" onClick={() => setPaletteOpen(true)}>
            <Search aria-hidden />
            <span>Search or jump to…</span>
            <span className="search-keys">
              <Kbd>{IS_MAC ? "⌘" : "Ctrl"}</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          <div className="topbar-actions">
            <Button
              variant="ghost"
              iconOnly
              icon={theme === "dark" ? <Sun /> : <Moon />}
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              onClick={toggle}
            />
            <Link to="/orders/new" className="btn btn-primary">
              <Plus aria-hidden />
              <span className="hide-sm">New order</span>
            </Link>
          </div>
        </header>

        <main id="main" className="content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

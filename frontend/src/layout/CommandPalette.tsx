import { CornerDownLeft, LogOut, LucideIcon, Moon, Package, Plus, ReceiptText, Search, Sun } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { canManageCatalog } from "../auth/roles";
import { Kbd } from "../components/ui/primitives";
import { useAuth, useSession } from "../context/AuthContext";
import { useOrders, useProducts } from "../hooks/queries";
import { useTheme } from "../hooks/useTheme";
import { formatMoney } from "../lib/format";
import { visibleSections } from "./navigation";

type Command = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  keywords?: string;
  icon: LucideIcon;
  run: () => void;
};

const MAX_RESULTS_PER_GROUP = 6;

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  const navigate = useNavigate();
  const { role } = useSession();
  const { signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const products = useProducts();
  const orders = useOrders();

  useEffect(() => {
    const element = dialog.current;
    if (!element) {
      return;
    }
    if (open && !element.open) {
      setQuery("");
      setCursor(0);
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const go = (to: string) => () => navigate(to);
    const result: Command[] = [];

    for (const section of visibleSections(role)) {
      for (const item of section.items) {
        result.push({
          id: `nav:${item.to}`,
          group: "Go to",
          label: item.label,
          icon: item.icon,
          run: go(item.to),
        });
      }
    }

    result.push({
      id: "action:new-order",
      group: "Actions",
      label: "Create order",
      keywords: "new sale sell checkout",
      icon: Plus,
      run: go("/orders/new"),
    });
    if (canManageCatalog(role)) {
      result.push({
        id: "action:new-product",
        group: "Actions",
        label: "Add product",
        keywords: "new item sku catalog",
        icon: Plus,
        run: go("/catalog?new=1"),
      });
    }
    result.push(
      {
        id: "action:theme",
        group: "Actions",
        label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        keywords: "appearance mode dark light",
        icon: theme === "dark" ? Sun : Moon,
        run: toggle,
      },
      {
        id: "action:sign-out",
        group: "Actions",
        label: "Sign out",
        keywords: "log out logout",
        icon: LogOut,
        run: signOut,
      },
    );

    for (const product of products.data ?? []) {
      result.push({
        id: `product:${product.id}`,
        group: "Products",
        label: product.name,
        hint: `${product.sku} · ${formatMoney(product.unit_price)}`,
        keywords: `${product.sku} ${product.category}`,
        icon: Package,
        run: go(`/catalog?product=${product.id}`),
      });
    }

    for (const order of orders.data ?? []) {
      result.push({
        id: `order:${order.id}`,
        group: "Orders",
        label: `Order #${order.number}`,
        hint: [order.customer_name, formatMoney(order.total_amount)].filter(Boolean).join(" · "),
        keywords: `${order.number} ${order.customer_name ?? ""}`,
        icon: ReceiptText,
        run: go(`/orders?order=${order.id}`),
      });
    }

    return result;
  }, [navigate, role, theme, toggle, signOut, products.data, orders.data]);

  const groups = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches = commands.filter((command) => {
      // Records only appear once you start typing; commands are always listed.
      const isRecord = command.group === "Products" || command.group === "Orders";
      if (terms.length === 0) {
        return !isRecord;
      }
      const haystack = `${command.label} ${command.keywords ?? ""}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });

    const grouped = new Map<string, Command[]>();
    for (const command of matches) {
      const bucket = grouped.get(command.group) ?? [];
      if (bucket.length < MAX_RESULTS_PER_GROUP) {
        bucket.push(command);
        grouped.set(command.group, bucket);
      }
    }
    return [...grouped.entries()];
  }, [commands, query]);

  const flat = useMemo(() => groups.flatMap(([, items]) => items), [groups]);
  const activeId = flat[Math.min(cursor, flat.length - 1)]?.id;

  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  function run(command: Command) {
    onClose();
    command.run();
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setCursor((current) => (flat.length ? (current + delta + flat.length) % flat.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const command = flat[Math.min(cursor, flat.length - 1)];
      if (command) {
        run(command);
      }
    }
  }

  return (
    <dialog
      ref={dialog}
      className="palette"
      aria-label="Command palette"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={(event) => {
        if (event.target === dialog.current) {
          onClose();
        }
      }}
    >
      {open && (
        <div onKeyDown={handleKeyDown}>
          <div className="palette-search">
            <Search aria-hidden />
            <input
              autoFocus
              role="combobox"
              aria-expanded
              aria-controls="palette-results"
              aria-activedescendant={activeId}
              placeholder="Search products, orders and commands…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setCursor(0);
              }}
            />
            <Kbd>esc</Kbd>
          </div>

          <ul ref={list} id="palette-results" className="palette-results" role="listbox">
            {flat.length === 0 && <li className="palette-empty">No matches for “{query}”</li>}
            {groups.map(([group, items]) => (
              <li key={group} role="presentation">
                <div className="palette-group">{group}</div>
                <ul role="group" aria-label={group}>
                  {items.map((command) => {
                    const Icon = command.icon;
                    const selected = command.id === activeId;
                    return (
                      <li
                        key={command.id}
                        id={command.id}
                        role="option"
                        aria-selected={selected}
                        className="palette-item"
                        onMouseMove={() => setCursor(flat.indexOf(command))}
                        onClick={() => run(command)}
                      >
                        <Icon aria-hidden />
                        <span className="truncate">{command.label}</span>
                        {command.hint && <span className="palette-hint truncate">{command.hint}</span>}
                        {selected && <CornerDownLeft className="palette-enter" aria-hidden />}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>

          <footer className="palette-footer">
            <span>
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> navigate
            </span>
            <span>
              <Kbd>↵</Kbd> select
            </span>
          </footer>
        </div>
      )}
    </dialog>
  );
}

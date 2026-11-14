import { Minus, Plus } from "lucide-react";
import { CSSProperties, ReactNode } from "react";

import { OrderStatus, Role, StockStatus } from "../../api/client";
import { formatRoleLabel } from "../../auth/roles";
import { initials } from "../../lib/format";

type Tone = "neutral" | "good" | "warning" | "critical" | "accent";

export function Badge({ tone = "neutral", plain, children }: { tone?: Tone; plain?: boolean; children: ReactNode }) {
  return (
    <span className="badge" data-tone={tone} data-plain={plain || undefined}>
      {children}
    </span>
  );
}

const STOCK: Record<StockStatus, { tone: Tone; label: string }> = {
  in_stock: { tone: "good", label: "In stock" },
  low_stock: { tone: "warning", label: "Low stock" },
  out_of_stock: { tone: "critical", label: "Out of stock" },
};

export function StockBadge({ status }: { status: StockStatus }) {
  const { tone, label } = STOCK[status];
  return <Badge tone={tone}>{label}</Badge>;
}

const ORDER: Record<OrderStatus, { tone: Tone; label: string }> = {
  placed: { tone: "accent", label: "Open" },
  fulfilled: { tone: "good", label: "Fulfilled" },
  cancelled: { tone: "neutral", label: "Cancelled" },
};

export function OrderBadge({ status }: { status: OrderStatus }) {
  const { tone, label } = ORDER[status] ?? { tone: "neutral" as Tone, label: status };
  return <Badge tone={tone}>{label}</Badge>;
}

export function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge plain tone={role === "owner" ? "accent" : "neutral"}>
      {formatRoleLabel(role)}
    </Badge>
  );
}

export function Avatar({
  name,
  email,
  size,
}: {
  name?: string | null;
  email?: string | null;
  size?: "sm" | "lg";
}) {
  return (
    <span className="avatar" data-size={size} aria-hidden>
      {initials(name, email)}
    </span>
  );
}

export function Skeleton({ width, height = 14, style }: { width?: number | string; height?: number | string; style?: CSSProperties }) {
  return <span className="skeleton" style={{ width: width ?? "100%", height, ...style }} aria-hidden />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

type SegmentedOption<T extends string> = { value: T; label: string; count?: number };

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<SegmentedOption<T>>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== undefined && <span className="count">{option.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Stepper({
  value,
  min = 0,
  max = 99_999,
  onChange,
  label,
  disabled,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  label: string;
  disabled?: boolean;
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, Number.isFinite(next) ? Math.trunc(next) : min));
  return (
    <div className="stepper">
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(value - 1))}
      >
        <Minus />
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(event) => onChange(clamp(Number(event.target.value)))}
        onFocus={(event) => event.target.select()}
      />
      <button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={disabled || value >= max}
        onClick={() => onChange(clamp(value + 1))}
      >
        <Plus />
      </button>
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

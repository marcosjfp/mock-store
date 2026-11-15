const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});
const currencyWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const integer = new Intl.NumberFormat("en-US");

export const formatMoney = (value: number) => currency.format(value);
export const formatMoneyWhole = (value: number) => currencyWhole.format(value);
export const formatNumber = (value: number) => integer.format(value);

/** $1,284 → $12.9K → $4.2M: full under 10,000, compact above. */
export function formatMoneyCompact(value: number): string {
  return Math.abs(value) < 10_000 ? currencyWhole.format(value) : compactCurrency.format(value);
}

export function formatDate(iso: string | null, options?: Intl.DateTimeFormatOptions): string {
  if (!iso) {
    return "—";
  }
  return new Date(iso).toLocaleDateString(
    "en-US",
    options ?? { month: "short", day: "numeric", year: "numeric" },
  );
}

export function formatDateTime(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Parses a `YYYY-MM-DD` day bucket without shifting it across time zones. */
export function formatDay(day: string, options?: Intl.DateTimeFormatOptions): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date).toLocaleDateString(
    "en-US",
    options ?? { month: "short", day: "numeric" },
  );
}

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];
const relative = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

export function formatRelative(iso: string | null, now: number = Date.now()): string {
  if (!iso) {
    return "—";
  }
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) {
      return relative.format(Math.trunc(seconds / size), unit);
    }
  }
  return "just now";
}

export function initials(name: string | null | undefined, email?: string | null): string {
  const source = name?.trim() || email?.split("@")[0] || "?";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}

export function displayName(name: string | null | undefined, email: string | null | undefined): string {
  return name?.trim() || email || "Unknown";
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents left behind by NFKD
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

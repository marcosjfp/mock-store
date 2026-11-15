/** Brand mark: a stack of three shelves — inventory, in the simplest form. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden className="logo">
      <rect width="28" height="28" rx="7" fill="var(--ink)" />
      <rect x="7" y="7.5" width="14" height="3" rx="1.5" fill="var(--text-on-ink)" />
      <rect x="7" y="12.5" width="9" height="3" rx="1.5" fill="var(--accent)" />
      <rect x="7" y="17.5" width="14" height="3" rx="1.5" fill="var(--text-on-ink)" opacity="0.55" />
    </svg>
  );
}

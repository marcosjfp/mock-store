import { ReactNode } from "react";

export type BarListItem = {
  key: string;
  label: ReactNode;
  caption?: ReactNode;
  value: number;
  valueLabel: string;
};

/**
 * Ranked horizontal bars: one hue (magnitude, not identity), every bar
 * directly labelled with its value so nothing depends on colour or hover.
 */
export function BarList({ items }: { items: BarListItem[] }) {
  const max = Math.max(...items.map((item) => item.value), 0) || 1;
  return (
    <ol className="barlist">
      {items.map((item) => (
        <li key={item.key}>
          <div className="barlist-row">
            <span className="barlist-label truncate">{item.label}</span>
            <span className="barlist-value num">{item.valueLabel}</span>
          </div>
          <div className="barlist-track" aria-hidden>
            <span className="barlist-bar" style={{ width: `${Math.max(1.5, (item.value / max) * 100)}%` }} />
          </div>
          {item.caption && <span className="barlist-caption">{item.caption}</span>}
        </li>
      ))}
    </ol>
  );
}

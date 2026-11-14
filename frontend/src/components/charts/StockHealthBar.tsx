import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";

type StockHealthBarProps = {
  inStock: number;
  lowStock: number;
  outOfStock: number;
};

/**
 * One whole split into three states. Status colours are reserved for state
 * and always ship with an icon and a label; segments are separated by a
 * surface-coloured gap rather than a stroke.
 */
export function StockHealthBar({ inStock, lowStock, outOfStock }: StockHealthBarProps) {
  const segments = [
    { key: "good", label: "In stock", value: inStock, icon: <CircleCheck /> },
    { key: "warning", label: "Low", value: lowStock, icon: <TriangleAlert /> },
    { key: "critical", label: "Out", value: outOfStock, icon: <CircleAlert /> },
  ];
  const total = inStock + lowStock + outOfStock;

  return (
    <div className="health">
      <div
        className="health-bar"
        role="img"
        aria-label={`${inStock} in stock, ${lowStock} low, ${outOfStock} out of stock`}
      >
        {total === 0 ? (
          <span className="health-segment" data-state="empty" style={{ flexGrow: 1 }} />
        ) : (
          segments
            .filter((segment) => segment.value > 0)
            .map((segment) => (
              <span
                key={segment.key}
                className="health-segment"
                data-state={segment.key}
                style={{ flexGrow: segment.value }}
                title={`${segment.label}: ${segment.value}`}
              />
            ))
        )}
      </div>
      <ul className="health-legend">
        {segments.map((segment) => (
          <li key={segment.key} data-state={segment.key}>
            {segment.icon}
            <span>{segment.label}</span>
            <strong className="num">{segment.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

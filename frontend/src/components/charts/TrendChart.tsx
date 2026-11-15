import { useEffect, useMemo, useRef, useState } from "react";

import { formatDay } from "../../lib/format";
import { axisLabel, niceTicks } from "./scale";

export type TrendPoint = { date: string; value: number };

type TrendChartProps = {
  points: TrendPoint[];
  /** Names the series for screen readers and the data table. */
  label: string;
  formatValue: (value: number) => string;
  axisPrefix?: string;
  height?: number;
};

const MARGIN = { top: 12, right: 12, bottom: 26, left: 44 };

/**
 * Single-series area chart with a crosshair tooltip.
 *
 * One series, so there is no legend — the card title names what is plotted.
 * Pointer and keyboard (← →) both drive the crosshair, and the same data is
 * available to assistive tech as a table.
 */
export function TrendChart({ points, label, formatValue, axisPrefix = "", height = 260 }: TrendChartProps) {
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const element = frame.current;
    if (!element || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const geometry = useMemo(() => {
    const innerWidth = width - MARGIN.left - MARGIN.right;
    const innerHeight = height - MARGIN.top - MARGIN.bottom;
    const ticks = niceTicks(Math.max(...points.map((point) => point.value), 0));
    const axisMax = ticks[ticks.length - 1];
    const step = points.length > 1 ? innerWidth / (points.length - 1) : 0;
    const x = (index: number) => MARGIN.left + index * step;
    const y = (value: number) => MARGIN.top + innerHeight - (value / axisMax) * innerHeight;
    const line = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join("");
    const baseline = MARGIN.top + innerHeight;
    const area = points.length
      ? `${line}L${x(points.length - 1).toFixed(1)},${baseline}L${x(0).toFixed(1)},${baseline}Z`
      : "";
    // Aim for a date label roughly every 80px.
    const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(innerWidth / 80))));
    return { innerWidth, innerHeight, ticks, axisMax, step, x, y, line, area, baseline, labelEvery };
  }, [points, width, height]);

  const { ticks, axisMax, step, x, y, line, area, baseline, labelEvery, innerWidth } = geometry;

  function indexFromPointer(event: React.PointerEvent<SVGRectElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const offset = event.clientX - bounds.left;
    return Math.min(points.length - 1, Math.max(0, Math.round(step ? offset / step : 0)));
  }

  function handleKey(event: React.KeyboardEvent) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    setActive((current) => Math.min(points.length - 1, Math.max(0, (current ?? points.length - 1) + delta)));
  }

  const activePoint = active === null ? null : points[active];
  const tooltipLeft = active === null ? 0 : x(active);
  const flip = tooltipLeft > width - 150;

  return (
    <div ref={frame} className="chart" style={{ height }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${label} per day. Use the left and right arrow keys to read values.`}
        tabIndex={0}
        onKeyDown={handleKey}
        onBlur={() => setActive(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="chart-grid" x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} />
            <text className="chart-tick" x={MARGIN.left - 8} y={y(tick)} dy="0.32em" textAnchor="end">
              {axisLabel(tick, axisMax, axisPrefix)}
            </text>
          </g>
        ))}

        {points.map((point, index) =>
          index % labelEvery === 0 ? (
            <text
              key={point.date}
              className="chart-tick"
              x={x(index)}
              y={baseline + 18}
              textAnchor={index === 0 ? "start" : "middle"}
            >
              {formatDay(point.date)}
            </text>
          ) : null,
        )}

        <path className="chart-area" d={area} />
        <path className="chart-line" d={line} />

        {activePoint && (
          <g>
            <line className="chart-crosshair" x1={tooltipLeft} x2={tooltipLeft} y1={MARGIN.top} y2={baseline} />
            <circle className="chart-dot" cx={tooltipLeft} cy={y(activePoint.value)} r={5} />
          </g>
        )}

        <rect
          x={MARGIN.left}
          y={MARGIN.top}
          width={Math.max(0, innerWidth)}
          height={Math.max(0, baseline - MARGIN.top)}
          fill="transparent"
          onPointerMove={(event) => setActive(indexFromPointer(event))}
          onPointerDown={(event) => setActive(indexFromPointer(event))}
          onPointerLeave={() => setActive(null)}
        />
      </svg>

      {activePoint && (
        <div
          className="chart-tooltip"
          style={{
            left: tooltipLeft,
            top: Math.max(4, y(activePoint.value) - 12),
            transform: `translate(${flip ? "calc(-100% - 12px)" : "12px"}, -50%)`,
          }}
        >
          <span className="chart-tooltip-label">
            {formatDay(activePoint.date, { weekday: "short", month: "short", day: "numeric" })}
          </span>
          <strong className="num">{formatValue(activePoint.value)}</strong>
        </div>
      )}

      <table className="sr-only">
        <caption>{label} per day</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">{label}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.date}>
              <th scope="row">{formatDay(point.date)}</th>
              <td>{formatValue(point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

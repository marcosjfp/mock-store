import { ArrowDownRight, ArrowRight, ArrowUpRight, PackageCheck, ReceiptText } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { AnalyticsSummary, Metric } from "../api/client";
import { BarList } from "../components/charts/BarList";
import { StockHealthBar } from "../components/charts/StockHealthBar";
import { TrendChart } from "../components/charts/TrendChart";
import { EmptyState, OrderBadge, Segmented, Skeleton } from "../components/ui/primitives";
import { useMe, useOrders, useSummary } from "../hooks/queries";
import { PageHeader, QueryError } from "../layout/PageHeader";
import {
  formatMoney,
  formatMoneyCompact,
  formatMoneyWhole,
  formatNumber,
  formatRelative,
  pluralize,
} from "../lib/format";

type Range = "7" | "30" | "90";
type Series = "revenue" | "orders";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) {
    return "Good morning";
  }
  return hour < 18 ? "Good afternoon" : "Good evening";
}

function Delta({ metric, days }: { metric: Metric; days: number }) {
  if (metric.change_pct === null) {
    return <span className="stat-delta muted">No prior data</span>;
  }
  const up = metric.change_pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="stat-delta" data-direction={up ? "up" : "down"}>
      <span className="stat-delta-value">
        <Icon aria-hidden />
        {up ? "+" : "−"}
        {Math.abs(metric.change_pct).toFixed(1)}%
      </span>
      <span className="muted">vs prior {days} days</span>
    </span>
  );
}

function StatTile({ label, value, metric, days }: { label: string; value: string; metric: Metric; days: number }) {
  return (
    <div className="card stat">
      <span className="stat-label">{label}</span>
      <strong className="stat-value num">{value}</strong>
      <Delta metric={metric} days={days} />
    </div>
  );
}

function StatSkeletons() {
  return (
    <>
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="card stat">
          <Skeleton width={90} height={12} />
          <Skeleton width={130} height={28} style={{ marginTop: 10 }} />
          <Skeleton width={150} height={12} style={{ marginTop: 10 }} />
        </div>
      ))}
    </>
  );
}

function Dashboard({ summary, series, onSeriesChange }: { summary: AnalyticsSummary; series: Series; onSeriesChange: (next: Series) => void }) {
  const orders = useOrders();
  const recent = (orders.data ?? []).slice(0, 6);
  const { inventory } = summary;
  const hasSales = summary.orders.value > 0;

  return (
    <>
      <section className="stat-grid" aria-label="Key figures">
        <StatTile label="Revenue" value={formatMoneyCompact(summary.revenue.value)} metric={summary.revenue} days={summary.days} />
        <StatTile label="Orders" value={formatNumber(summary.orders.value)} metric={summary.orders} days={summary.days} />
        <StatTile
          label="Average order value"
          value={formatMoney(summary.average_order_value.value)}
          metric={summary.average_order_value}
          days={summary.days}
        />
        <StatTile label="Units sold" value={formatNumber(summary.units_sold.value)} metric={summary.units_sold} days={summary.days} />
      </section>

      <div className="overview-grid">
        <section className="card span-2">
          <header className="card-header">
            <div>
              <h2 className="card-title">{series === "revenue" ? "Revenue per day" : "Orders per day"}</h2>
              <p className="card-subtitle">
                Last {summary.days} days, cancelled orders excluded
              </p>
            </div>
            <Segmented
              label="Chart metric"
              value={series}
              onChange={onSeriesChange}
              options={[
                { value: "revenue", label: "Revenue" },
                { value: "orders", label: "Orders" },
              ]}
            />
          </header>
          <div className="card-body">
            {hasSales ? (
              <TrendChart
                label={series === "revenue" ? "Revenue" : "Orders"}
                points={summary.series.map((point) => ({ date: point.date, value: point[series] }))}
                formatValue={series === "revenue" ? formatMoney : (value) => pluralize(value, "order")}
                axisPrefix={series === "revenue" ? "$" : ""}
              />
            ) : (
              <EmptyState
                icon={<ReceiptText />}
                title="No sales in this period"
                description="Place your first order and revenue will start charting here."
                action={
                  <Link to="/orders/new" className="btn btn-primary">
                    Create order
                  </Link>
                }
              />
            )}
          </div>
        </section>

        <section className="card">
          <header className="card-header">
            <div>
              <h2 className="card-title">Stock health</h2>
              <p className="card-subtitle">
                {pluralize(inventory.active_products, "active product")} · {formatMoneyWhole(inventory.stock_value)} on hand
              </p>
            </div>
          </header>
          <div className="card-body">
            <StockHealthBar inStock={inventory.in_stock} lowStock={inventory.low_stock} outOfStock={inventory.out_of_stock} />

            <hr className="divider" />
            <h3 className="section-label">Needs restocking</h3>
            {summary.low_stock.length === 0 ? (
              <p className="inline-empty">
                <PackageCheck aria-hidden /> Everything is above its reorder point.
              </p>
            ) : (
              <ul className="restock-list">
                {summary.low_stock.slice(0, 5).map((item) => (
                  <li key={item.product_id}>
                    <Link to={`/catalog?product=${item.product_id}`}>
                      <span className="truncate">{item.name}</span>
                      <span className="restock-qty num" data-empty={item.quantity === 0 || undefined}>
                        {item.quantity === 0 ? "Out" : `${item.quantity} left`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {summary.low_stock.length > 0 && (
              <Link to="/catalog?stock=attention" className="card-link">
                View all in catalog <ArrowRight aria-hidden />
              </Link>
            )}
          </div>
        </section>

        <section className="card">
          <header className="card-header">
            <div>
              <h2 className="card-title">Top products</h2>
              <p className="card-subtitle">By revenue, last {summary.days} days</p>
            </div>
          </header>
          <div className="card-body">
            {summary.top_products.length === 0 ? (
              <p className="inline-empty">No products sold yet.</p>
            ) : (
              <BarList
                items={summary.top_products.map((product) => ({
                  key: product.product_id,
                  label: product.name,
                  caption: `${pluralize(product.units, "unit")} · ${product.category}`,
                  value: product.revenue,
                  valueLabel: formatMoneyWhole(product.revenue),
                }))}
              />
            )}
          </div>
        </section>

        <section className="card">
          <header className="card-header">
            <div>
              <h2 className="card-title">Sales by category</h2>
              <p className="card-subtitle">Revenue share, last {summary.days} days</p>
            </div>
          </header>
          <div className="card-body">
            {summary.categories.length === 0 ? (
              <p className="inline-empty">No category data yet.</p>
            ) : (
              <BarList
                items={summary.categories.slice(0, 6).map((category) => ({
                  key: category.category,
                  label: category.category,
                  value: category.revenue,
                  valueLabel: `${formatMoneyWhole(category.revenue)} · ${Math.round(
                    (category.revenue / (summary.revenue.value || 1)) * 100,
                  )}%`,
                }))}
              />
            )}
          </div>
        </section>

        <section className="card">
          <header className="card-header">
            <div>
              <h2 className="card-title">Recent orders</h2>
              <p className="card-subtitle">
                {summary.open_orders > 0 ? `${pluralize(summary.open_orders, "order")} waiting to be fulfilled` : "Nothing waiting"}
              </p>
            </div>
            <Link to="/orders" className="card-link card-link-inline">
              All orders <ArrowRight aria-hidden />
            </Link>
          </header>
          <div className="card-body">
            {orders.isPending ? (
              <div className="skeleton-stack">
                {[0, 1, 2, 3].map((index) => (
                  <Skeleton key={index} height={34} />
                ))}
              </div>
            ) : recent.length === 0 ? (
              <p className="inline-empty">No orders yet.</p>
            ) : (
              <ul className="recent-orders">
                {recent.map((order) => (
                  <li key={order.id}>
                    <Link to={`/orders?order=${order.id}`}>
                      <div style={{ minWidth: 0 }}>
                        <strong className="truncate">{order.customer_name ?? "Walk-in customer"}</strong>
                        <span className="muted">
                          <span className="mono">#{order.number}</span> · {formatRelative(order.created_at)}
                        </span>
                      </div>
                      <div className="recent-orders-end">
                        <strong className="num">{formatMoney(order.total_amount)}</strong>
                        <OrderBadge status={order.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

export default function OverviewPage() {
  const [range, setRange] = useState<Range>("30");
  const [series, setSeries] = useState<Series>("revenue");
  const me = useMe();
  const summary = useSummary(Number(range));
  const firstName = me.data?.full_name?.split(" ")[0];

  return (
    <>
      <PageHeader
        title={firstName ? `${greeting()}, ${firstName}` : greeting()}
        description="Here’s how the store is doing."
        actions={
          <Segmented
            label="Date range"
            value={range}
            onChange={setRange}
            options={[
              { value: "7", label: "7 days" },
              { value: "30", label: "30 days" },
              { value: "90", label: "90 days" },
            ]}
          />
        }
      />

      {summary.isError ? (
        <QueryError error={summary.error} onRetry={() => void summary.refetch()} />
      ) : !summary.data ? (
        <>
          <section className="stat-grid">
            <StatSkeletons />
          </section>
          <div className="overview-grid">
            <div className="card span-2" style={{ padding: "1.25rem" }}>
              <Skeleton height={300} />
            </div>
            <div className="card" style={{ padding: "1.25rem" }}>
              <Skeleton height={300} />
            </div>
          </div>
        </>
      ) : (
        <div className="fade-swap" data-refreshing={summary.isPlaceholderData || undefined}>
          <Dashboard summary={summary.data} series={series} onSeriesChange={setSeries} />
        </div>
      )}
    </>
  );
}

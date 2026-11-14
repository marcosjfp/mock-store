import { Plus, ReceiptText, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { OrderStatus } from "../api/client";
import { Button } from "../components/ui/Button";
import { Avatar, EmptyState, OrderBadge, Segmented, Skeleton } from "../components/ui/primitives";
import { OrderDrawer } from "../features/OrderDrawer";
import { useOrders } from "../hooks/queries";
import { PageHeader, QueryError } from "../layout/PageHeader";
import { displayName, formatDateTime, formatMoney, formatMoneyWhole, formatRelative, pluralize } from "../lib/format";

type Filter = "all" | OrderStatus;

export default function OrdersPage() {
  const orders = useOrders();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");

  const filter = (params.get("status") as Filter) || "all";
  const selectedId = params.get("order");
  const all = orders.data ?? [];
  const selected = all.find((order) => order.id === selectedId) ?? null;

  function patchParams(changes: Record<string, string | null>) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value === null) {
            next.delete(key);
          } else {
            next.set(key, value);
          }
        }
        return next;
      },
      { replace: true },
    );
  }

  const counts = useMemo(() => {
    const result = { all: all.length, placed: 0, fulfilled: 0, cancelled: 0 };
    for (const order of all) {
      result[order.status] += 1;
    }
    return result;
  }, [all]);

  const visible = useMemo(() => {
    const terms = query.trim().toLowerCase().replace(/^#/, "").split(/\s+/).filter(Boolean);
    return all
      .filter((order) => filter === "all" || order.status === filter)
      .filter((order) => {
        const haystack = [
          order.number,
          order.customer_name,
          order.created_by_name,
          order.created_by_email,
          ...order.items.map((item) => `${item.product_name} ${item.product_sku}`),
        ]
          .join(" ")
          .toLowerCase();
        return terms.every((term) => haystack.includes(term));
      });
  }, [all, filter, query]);

  const openValue = all.filter((order) => order.status === "placed").reduce((sum, order) => sum + order.total_amount, 0);
  const filtered = query.trim() !== "" || filter !== "all";

  return (
    <>
      <PageHeader
        title="Orders"
        description={
          orders.data
            ? counts.placed > 0
              ? `${pluralize(counts.placed, "open order")} worth ${formatMoneyWhole(openValue)} waiting to be fulfilled`
              : "All caught up — nothing waiting to be fulfilled"
            : "Every sale, from placed to fulfilled"
        }
        actions={
          <Link to="/orders/new" className="btn btn-primary">
            <Plus aria-hidden /> New order
          </Link>
        }
      />

      {orders.isError ? (
        <QueryError error={orders.error} onRetry={() => void orders.refetch()} />
      ) : (
        <section className="card">
          <div className="toolbar">
            <Segmented
              label="Filter by status"
              value={filter}
              onChange={(next) => patchParams({ status: next === "all" ? null : next })}
              options={[
                { value: "all", label: "All", count: counts.all },
                { value: "placed", label: "Open", count: counts.placed },
                { value: "fulfilled", label: "Fulfilled", count: counts.fulfilled },
                { value: "cancelled", label: "Cancelled", count: counts.cancelled },
              ]}
            />
            <div className="input-affix grow push">
              <Search aria-hidden />
              <input
                className="input"
                type="search"
                placeholder="Search order, customer or product"
                aria-label="Search orders"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>

          {orders.isPending ? (
            <div className="skeleton-stack" style={{ padding: "1rem" }}>
              {Array.from({ length: 8 }, (_, index) => (
                <Skeleton key={index} height={40} />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<ReceiptText />}
              title={filtered ? "No orders match" : "No orders yet"}
              description={
                filtered ? "Try a different search or status." : "Orders you place will show up here, newest first."
              }
              action={
                filtered ? (
                  <Button
                    onClick={() => {
                      setQuery("");
                      patchParams({ status: null });
                    }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Link to="/orders/new" className="btn btn-primary">
                    Create order
                  </Link>
                )
              }
            />
          ) : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Items</th>
                      <th className="align-right">Total</th>
                      <th>Status</th>
                      <th>Sold by</th>
                      <th>Placed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((order) => (
                      <tr key={order.id} data-clickable onClick={() => patchParams({ order: order.id })}>
                        <td>
                          <button
                            type="button"
                            className="link-button mono"
                            onClick={(event) => {
                              event.stopPropagation();
                              patchParams({ order: order.id });
                            }}
                          >
                            #{order.number}
                          </button>
                        </td>
                        <td>{order.customer_name ?? <span className="muted">Walk-in</span>}</td>
                        <td className="secondary">
                          <span className="truncate items-cell">
                            {order.items[0]?.product_name}
                            {order.items.length > 1 && <span className="muted"> +{order.items.length - 1} more</span>}
                          </span>
                        </td>
                        <td className="align-right num">{formatMoney(order.total_amount)}</td>
                        <td>
                          <OrderBadge status={order.status} />
                        </td>
                        <td>
                          <span className="person-cell">
                            <Avatar size="sm" name={order.created_by_name} email={order.created_by_email} />
                            <span className="truncate">{displayName(order.created_by_name, order.created_by_email)}</span>
                          </span>
                        </td>
                        <td className="secondary" title={formatDateTime(order.created_at)}>
                          {formatRelative(order.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="table-footer">
                Showing {visible.length} of {counts.all} orders
              </div>
            </>
          )}
        </section>
      )}

      <OrderDrawer order={selected} onClose={() => patchParams({ order: null })} />
    </>
  );
}

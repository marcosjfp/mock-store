import { Ban, CircleCheck, PackageCheck } from "lucide-react";
import { useState } from "react";

import { Order } from "../api/client";
import { canCancelOrders } from "../auth/roles";
import { Button } from "../components/ui/Button";
import { ConfirmDialog, Drawer } from "../components/ui/Overlay";
import { Avatar, OrderBadge } from "../components/ui/primitives";
import { useToast } from "../components/ui/Toast";
import { useSession } from "../context/AuthContext";
import { useOrderAction } from "../hooks/queries";
import { displayName, formatDateTime, formatMoney, pluralize } from "../lib/format";

export function OrderDrawer({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const { role } = useSession();
  const toast = useToast();
  const action = useOrderAction();
  const [confirmCancel, setConfirmCancel] = useState(false);

  function run(kind: "fulfill" | "cancel") {
    if (!order) {
      return;
    }
    action.mutate(
      { id: order.id, action: kind },
      {
        onSuccess: (updated) => {
          toast.success(
            kind === "fulfill"
              ? `Order #${updated.number} marked as fulfilled`
              : `Order #${updated.number} cancelled — ${pluralize(updated.item_count, "unit")} returned to stock`,
          );
          setConfirmCancel(false);
        },
        onError: (failure) => {
          setConfirmCancel(false);
          toast.error(failure.message);
        },
      },
    );
  }

  const open = order?.status === "placed";
  const closedAt = order && order.status !== "placed" ? order.updated_at : null;

  return (
    <>
      <Drawer
        open={order !== null}
        onClose={onClose}
        size="lg"
        title={order ? `Order #${order.number}` : ""}
        description={order ? `Placed ${formatDateTime(order.created_at)}` : undefined}
        footer={
          open && (
            <>
              {canCancelOrders(role) && (
                <Button variant="ghost" icon={<Ban />} onClick={() => setConfirmCancel(true)}>
                  Cancel order
                </Button>
              )}
              <span className="spacer" />
              <Button
                variant="primary"
                icon={<PackageCheck />}
                loading={action.isPending && !confirmCancel}
                onClick={() => run("fulfill")}
              >
                Mark as fulfilled
              </Button>
            </>
          )
        }
      >
        {order && (
          <>
            <div className="order-summary">
              <div>
                <span className="muted">Customer</span>
                <strong>{order.customer_name ?? "Walk-in customer"}</strong>
              </div>
              <OrderBadge status={order.status} />
            </div>

            <h3 className="section-label">Items</h3>
            <ul className="line-items">
              {order.items.map((item) => (
                <li key={item.id}>
                  <div style={{ minWidth: 0 }}>
                    <strong className="truncate">{item.product_name}</strong>
                    <span className="muted">
                      <span className="mono">{item.product_sku}</span> · {item.quantity} × {formatMoney(item.unit_price)}
                    </span>
                  </div>
                  <span className="num">{formatMoney(item.line_total)}</span>
                </li>
              ))}
            </ul>
            <div className="order-total">
              <span>Total · {pluralize(order.item_count, "unit")}</span>
              <strong className="num">{formatMoney(order.total_amount)}</strong>
            </div>

            <hr className="divider" />
            <h3 className="section-label">Timeline</h3>
            <ol className="timeline">
              <li>
                <span className="timeline-dot" />
                <div>
                  <strong>Order placed</strong>
                  <span className="muted timeline-actor">
                    <Avatar size="sm" name={order.created_by_name} email={order.created_by_email} />
                    {displayName(order.created_by_name, order.created_by_email)} · {formatDateTime(order.created_at)}
                  </span>
                </div>
              </li>
              {order.status === "fulfilled" && (
                <li data-state="good">
                  <span className="timeline-dot">
                    <CircleCheck />
                  </span>
                  <div>
                    <strong>Fulfilled</strong>
                    <span className="muted">{formatDateTime(closedAt)}</span>
                  </div>
                </li>
              )}
              {order.status === "cancelled" && (
                <li data-state="muted">
                  <span className="timeline-dot">
                    <Ban />
                  </span>
                  <div>
                    <strong>Cancelled</strong>
                    <span className="muted">{formatDateTime(closedAt)} · units returned to stock</span>
                  </div>
                </li>
              )}
              {order.status === "placed" && (
                <li data-state="pending">
                  <span className="timeline-dot" />
                  <div>
                    <strong>Awaiting fulfilment</strong>
                    <span className="muted">Stock is reserved for this order.</span>
                  </div>
                </li>
              )}
            </ol>
          </>
        )}
      </Drawer>

      <ConfirmDialog
        open={confirmCancel}
        title={`Cancel order #${order?.number ?? ""}?`}
        description={`The ${order ? pluralize(order.item_count, "reserved unit") : "reserved units"} will go back into stock. This can’t be undone.`}
        confirmLabel="Cancel order"
        tone="danger"
        loading={action.isPending}
        onConfirm={() => run("cancel")}
        onClose={() => setConfirmCancel(false)}
      />
    </>
  );
}

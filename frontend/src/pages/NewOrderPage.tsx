import { ArrowLeft, CircleAlert, Package, Plus, Search, ShoppingCart, Trash2 } from "lucide-react";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { EmptyState, Skeleton, Stepper } from "../components/ui/primitives";
import { useToast } from "../components/ui/Toast";
import { cartLines, cartReducer, cartTotal } from "../features/cart";
import { useCreateOrder, useProducts } from "../hooks/queries";
import { PageHeader, QueryError } from "../layout/PageHeader";
import { formatMoney, pluralize } from "../lib/format";

export default function NewOrderPage() {
  const products = useProducts();
  const createOrder = useCreateOrder();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [cart, dispatch] = useReducer(cartReducer, {});
  const [customer, setCustomer] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [error, setError] = useState<string | null>(null);

  const sellable = useMemo(() => (products.data ?? []).filter((product) => product.is_active), [products.data]);
  const categories = useMemo(() => [...new Set(sellable.map((product) => product.category))].sort(), [sellable]);

  // "Sell" links elsewhere in the app land here with ?add=<product id>.
  const preselect = params.get("add");
  const consumed = useRef(false);
  useEffect(() => {
    if (!preselect || consumed.current || !products.data) {
      return;
    }
    consumed.current = true;
    const product = products.data.find((candidate) => candidate.id === preselect);
    if (product?.is_active && product.quantity > 0) {
      dispatch({ type: "add", product });
    }
    setParams({}, { replace: true });
  }, [preselect, products.data, setParams]);

  const visible = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return sellable
      .filter((product) => category === "all" || product.category === category)
      .filter((product) => {
        const haystack = `${product.name} ${product.sku} ${product.category}`.toLowerCase();
        return terms.every((term) => haystack.includes(term));
      });
  }, [sellable, category, query]);

  const lines = cartLines(cart, products.data ?? []);
  const total = cartTotal(lines);
  const units = lines.reduce((sum, line) => sum + line.quantity, 0);

  function submit() {
    setError(null);
    createOrder.mutate(
      {
        customer_name: customer.trim() || null,
        items: lines.map((line) => ({ product_id: line.product.id, quantity: line.quantity })),
      },
      {
        onSuccess: (order) => {
          toast.success(`Order #${order.number} placed · ${formatMoney(order.total_amount)}`);
          navigate(`/orders?order=${order.id}`);
        },
        // e.g. a colleague sold the last unit a moment ago — the refetched
        // catalog will already show the new stock level.
        onError: (failure) => setError(failure.message),
      },
    );
  }

  return (
    <>
      <PageHeader
        title="New order"
        description="Pick products, set quantities and place the order. Stock is reserved the moment it’s placed."
        actions={
          <Link to="/orders" className="btn btn-ghost">
            <ArrowLeft aria-hidden /> Back to orders
          </Link>
        }
      />

      {products.isError ? (
        <QueryError error={products.error} onRetry={() => void products.refetch()} />
      ) : (
        <div className="pos">
          <section className="card pos-picker" aria-label="Products">
            <div className="toolbar">
              <div className="input-affix grow" style={{ maxWidth: "none" }}>
                <Search aria-hidden />
                <input
                  className="input"
                  type="search"
                  placeholder="Search name or SKU"
                  aria-label="Search products"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="chips" role="group" aria-label="Filter by category">
              {["all", ...categories].map((name) => (
                <button key={name} type="button" className="chip" aria-pressed={category === name} onClick={() => setCategory(name)}>
                  {name === "all" ? "All" : name}
                </button>
              ))}
            </div>

            {products.isPending ? (
              <div className="product-grid">
                {Array.from({ length: 9 }, (_, index) => (
                  <Skeleton key={index} height={112} style={{ borderRadius: 10 }} />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <EmptyState
                icon={<Package />}
                title={sellable.length === 0 ? "Nothing to sell yet" : "No products match"}
                description={
                  sellable.length === 0 ? "Add products to the catalog first." : "Try a different search or category."
                }
              />
            ) : (
              <ul className="product-grid">
                {visible.map((product) => {
                  const inCart = cart[product.id] ?? 0;
                  const remaining = product.quantity - inCart;
                  const soldOut = product.quantity === 0;
                  return (
                    <li key={product.id}>
                      <button
                        type="button"
                        className="product-card"
                        data-selected={inCart > 0 || undefined}
                        disabled={remaining <= 0}
                        onClick={() => dispatch({ type: "add", product })}
                        aria-label={`Add ${product.name}, ${formatMoney(product.unit_price)}, ${remaining} available`}
                      >
                        <span className="product-card-top">
                          <span className="product-thumb" aria-hidden>
                            {product.category.slice(0, 3).toUpperCase()}
                          </span>
                          {inCart > 0 ? (
                            <span className="product-card-count num">{inCart}</span>
                          ) : (
                            !soldOut && <Plus className="product-card-plus" aria-hidden />
                          )}
                        </span>
                        <strong>{product.name}</strong>
                        <span className="product-card-meta">
                          <span className="num">{formatMoney(product.unit_price)}</span>
                          <span className="muted" data-low={product.stock_status !== "in_stock" || undefined}>
                            {soldOut ? "Out of stock" : remaining <= 0 ? "All in cart" : `${remaining} left`}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <aside className="card pos-cart" aria-label="Order summary">
            <header className="card-header">
              <div>
                <h2 className="card-title">Order summary</h2>
                <p className="card-subtitle">{units > 0 ? pluralize(units, "unit") : "No items yet"}</p>
              </div>
              {lines.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "clear" })}>
                  Clear
                </Button>
              )}
            </header>

            <div className="card-body pos-cart-body">
              <Field label="Customer" hint="Optional — leave blank for a walk-in sale.">
                {(control) => (
                  <input
                    {...control}
                    className="input"
                    value={customer}
                    placeholder="Company or person"
                    maxLength={120}
                    onChange={(event) => setCustomer(event.target.value)}
                  />
                )}
              </Field>

              {lines.length === 0 ? (
                <div className="cart-empty">
                  <ShoppingCart aria-hidden />
                  <p>Select products on the left to start building the order.</p>
                </div>
              ) : (
                <ul className="cart-lines">
                  {lines.map(({ product, quantity, lineTotal }) => (
                    <li key={product.id}>
                      <div className="cart-line-head">
                        <strong className="truncate">{product.name}</strong>
                        <span className="num">{formatMoney(lineTotal)}</span>
                      </div>
                      <div className="cart-line-controls">
                        <Stepper
                          label={`quantity of ${product.name}`}
                          value={quantity}
                          min={1}
                          max={product.quantity}
                          onChange={(next) => dispatch({ type: "set", product, quantity: next })}
                        />
                        <span className="muted num">{formatMoney(product.unit_price)} each</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          icon={<Trash2 />}
                          aria-label={`Remove ${product.name}`}
                          onClick={() => dispatch({ type: "remove", productId: product.id })}
                        />
                      </div>
                      {quantity >= product.quantity && (
                        <span className="cart-line-note">That’s every unit in stock.</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <footer className="pos-cart-footer">
              {error && (
                <div className="callout" data-tone="critical" role="alert">
                  <CircleAlert />
                  <span>{error}</span>
                </div>
              )}
              <div className="order-total">
                <span>Total</span>
                <strong className="num">{formatMoney(total)}</strong>
              </div>
              <Button
                variant="primary"
                size="lg"
                block
                disabled={lines.length === 0}
                loading={createOrder.isPending}
                onClick={submit}
              >
                Place order
              </Button>
            </footer>
          </aside>
        </div>
      )}
    </>
  );
}

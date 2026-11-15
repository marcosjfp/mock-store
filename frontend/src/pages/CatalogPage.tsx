import { ArrowDown, ArrowUp, ChevronsUpDown, Package, Plus, Search, ShoppingCart } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { Product } from "../api/client";
import { canManageCatalog } from "../auth/roles";
import { Button } from "../components/ui/Button";
import { Badge, EmptyState, Segmented, Skeleton, StockBadge } from "../components/ui/primitives";
import { useToast } from "../components/ui/Toast";
import { useSession } from "../context/AuthContext";
import { ProductDrawer } from "../features/ProductDrawer";
import { StockCell } from "../features/StockCell";
import { useAdjustStock, useProducts } from "../hooks/queries";
import { PageHeader, QueryError } from "../layout/PageHeader";
import { formatMoney, pluralize } from "../lib/format";

type StockFilter = "all" | "attention" | "archived";
type SortKey = "name" | "category" | "unit_price" | "quantity";
type Sort = { key: SortKey; direction: 1 | -1 };

const COLUMNS: Array<{ key: SortKey; label: string; align?: "right" }> = [
  { key: "name", label: "Product" },
  { key: "category", label: "Category" },
  { key: "unit_price", label: "Price", align: "right" },
  { key: "quantity", label: "In stock" },
];

function compare(a: Product, b: Product, key: SortKey): number {
  const left = a[key];
  const right = b[key];
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  return String(left).localeCompare(String(right), undefined, { sensitivity: "base" });
}

export default function CatalogPage() {
  const { role } = useSession();
  const canEdit = canManageCatalog(role);
  const products = useProducts();
  const adjust = useAdjustStock();
  const toast = useToast();

  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<Sort>({ key: "name", direction: 1 });

  const stockFilter = (params.get("stock") as StockFilter) || "all";
  const selectedId = params.get("product");
  const creating = params.get("new") === "1" && canEdit;

  const all = products.data ?? [];
  const selected = all.find((product) => product.id === selectedId) ?? null;

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

  const counts = useMemo(
    () => ({
      all: all.filter((product) => product.is_active).length,
      attention: all.filter((product) => product.is_active && product.stock_status !== "in_stock").length,
      archived: all.filter((product) => !product.is_active).length,
    }),
    [all],
  );

  const categories = useMemo(() => [...new Set(all.map((product) => product.category))].sort(), [all]);

  const visible = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return all
      .filter((product) => {
        if (stockFilter === "archived") {
          return !product.is_active;
        }
        if (!product.is_active) {
          return false;
        }
        return stockFilter === "all" || product.stock_status !== "in_stock";
      })
      .filter((product) => category === "all" || product.category === category)
      .filter((product) => {
        const haystack = `${product.name} ${product.sku} ${product.category}`.toLowerCase();
        return terms.every((term) => haystack.includes(term));
      })
      .sort((a, b) => compare(a, b, sort.key) * sort.direction || a.name.localeCompare(b.name));
  }, [all, stockFilter, category, query, sort]);

  function toggleSort(key: SortKey) {
    setSort((current) =>
      current.key === key ? { key, direction: current.direction === 1 ? -1 : 1 } : { key, direction: 1 },
    );
  }

  function changeStock(product: Product, quantity: number) {
    adjust.mutate(
      { id: product.id, quantity, reorder_level: product.reorder_level },
      { onError: (failure) => toast.error(`Couldn’t update ${product.name}: ${failure.message}`) },
    );
  }

  const filtered = query.trim() !== "" || category !== "all" || stockFilter !== "all";

  return (
    <>
      <PageHeader
        title="Catalog"
        description={
          products.data
            ? `${pluralize(counts.all, "active product")} across ${pluralize(categories.length, "category", "categories")}`
            : "Products and live stock levels"
        }
        actions={
          canEdit && (
            <Button variant="primary" icon={<Plus />} onClick={() => patchParams({ new: "1", product: null })}>
              Add product
            </Button>
          )
        }
      />

      {products.isError ? (
        <QueryError error={products.error} onRetry={() => void products.refetch()} />
      ) : (
        <section className="card">
          <div className="toolbar">
            <div className="input-affix grow">
              <Search aria-hidden />
              <input
                className="input"
                type="search"
                placeholder="Search name or SKU"
                aria-label="Search products"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <select
              className="select"
              aria-label="Filter by category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="all">All categories</option>
              {categories.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
            <div className="push">
              <Segmented
                label="Filter by stock"
                value={stockFilter}
                onChange={(next) => patchParams({ stock: next === "all" ? null : next })}
                options={[
                  { value: "all", label: "Active", count: counts.all },
                  { value: "attention", label: "Needs restock", count: counts.attention },
                  { value: "archived", label: "Archived", count: counts.archived },
                ]}
              />
            </div>
          </div>

          {products.isPending ? (
            <div className="skeleton-stack" style={{ padding: "1rem" }}>
              {Array.from({ length: 8 }, (_, index) => (
                <Skeleton key={index} height={40} />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<Package />}
              title={filtered ? "No products match" : "Your catalog is empty"}
              description={
                filtered
                  ? "Try a different search or clear the filters."
                  : canEdit
                    ? "Add your first product to start tracking stock and taking orders."
                    : "A manager hasn’t added any products yet."
              }
              action={
                filtered ? (
                  <Button
                    onClick={() => {
                      setQuery("");
                      setCategory("all");
                      patchParams({ stock: null });
                    }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  canEdit && (
                    <Button variant="primary" icon={<Plus />} onClick={() => patchParams({ new: "1" })}>
                      Add product
                    </Button>
                  )
                )
              }
            />
          ) : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      {COLUMNS.map((column) => {
                        const active = sort.key === column.key;
                        const Icon = !active ? ChevronsUpDown : sort.direction === 1 ? ArrowUp : ArrowDown;
                        return (
                          <th
                            key={column.key}
                            className={column.align === "right" ? "align-right" : undefined}
                            aria-sort={active ? (sort.direction === 1 ? "ascending" : "descending") : "none"}
                          >
                            <button type="button" onClick={() => toggleSort(column.key)}>
                              {column.label}
                              <Icon aria-hidden />
                            </button>
                          </th>
                        );
                      })}
                      <th>Status</th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((product) => (
                      <tr key={product.id} data-clickable onClick={() => patchParams({ product: product.id, new: null })}>
                        <td>
                          <div className="product-cell">
                            <span className="product-thumb" aria-hidden>
                              {product.category.slice(0, 3).toUpperCase()}
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <button
                                type="button"
                                className="link-button truncate"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  patchParams({ product: product.id, new: null });
                                }}
                              >
                                {product.name}
                              </button>
                              <span className="mono muted">{product.sku}</span>
                            </div>
                          </div>
                        </td>
                        <td className="secondary">{product.category}</td>
                        <td className="align-right num">{formatMoney(product.unit_price)}</td>
                        <td onClick={(event) => event.stopPropagation()}>
                          {canEdit && product.is_active ? (
                            <StockCell
                              label={`stock for ${product.name}`}
                              quantity={product.quantity}
                              onCommit={(quantity) => changeStock(product, quantity)}
                            />
                          ) : (
                            <span className="num">{product.quantity}</span>
                          )}
                        </td>
                        <td>
                          {product.is_active ? <StockBadge status={product.stock_status} /> : <Badge plain>Archived</Badge>}
                        </td>
                        <td className="align-right" onClick={(event) => event.stopPropagation()}>
                          {product.is_active && product.quantity > 0 && (
                            <Link
                              to={`/orders/new?add=${product.id}`}
                              className="btn btn-ghost btn-sm row-action"
                              aria-label={`Sell ${product.name}`}
                            >
                              <ShoppingCart aria-hidden /> Sell
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="table-footer">
                Showing {visible.length} of {stockFilter === "archived" ? counts.archived : counts.all}
              </div>
            </>
          )}
        </section>
      )}

      <ProductDrawer
        open={creating || selected !== null}
        product={creating ? null : selected}
        canEdit={canEdit}
        onClose={() => patchParams({ product: null, new: null })}
      />
    </>
  );
}

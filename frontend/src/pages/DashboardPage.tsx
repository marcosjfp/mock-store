import { useCallback, useEffect, useState } from "react";

import {
  Inventory,
  Order,
  Product,
  createOrder,
  createProduct,
  getInventory,
  listOrders,
  listProducts,
  updateInventory,
} from "../api/client";
import { canManageCatalog, formatRoleLabel } from "../auth/roles";
import { AuthState } from "../context/AuthContext";
import OrderPanel from "../components/OrderPanel";
import ProductPanel from "../components/ProductPanel";

type DashboardPageProps = {
  auth: AuthState;
  onLogout: () => void;
};

export default function DashboardPage({ auth, onLogout }: DashboardPageProps) {
  const canEditCatalog = canManageCatalog(auth.role);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventoryByProduct, setInventoryByProduct] = useState<Record<string, Inventory>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [productsData, ordersData] = await Promise.all([
        listProducts(auth.tenantSlug, auth.accessToken),
        listOrders(auth.tenantSlug, auth.accessToken),
      ]);

      const inventoryPairs = await Promise.all(
        productsData.map(async (product) => {
          const inventory = await getInventory(auth.tenantSlug, auth.accessToken, product.id);
          return [product.id, inventory] as const;
        })
      );

      setProducts(productsData);
      setOrders(ordersData);
      setInventoryByProduct(Object.fromEntries(inventoryPairs));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [auth.accessToken, auth.tenantSlug]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleCreateProduct(payload: {
    sku: string;
    name: string;
    description?: string;
    unit_price: number;
  }) {
    await createProduct(auth.tenantSlug, auth.accessToken, payload);
    await loadData();
  }

  async function handleUpdateInventory(productId: string, quantity: number, reorderLevel: number) {
    await updateInventory(auth.tenantSlug, auth.accessToken, productId, {
      quantity,
      reorder_level: reorderLevel,
    });
    await loadData();
  }

  async function handleCreateOrder(productId: string, quantity: number) {
    await createOrder(auth.tenantSlug, auth.accessToken, {
      items: [{ product_id: productId, quantity }],
    });
    await loadData();
  }

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Tenant</p>
          <h1>{auth.tenantSlug}</h1>
          <p className="role-badge">Role: {formatRoleLabel(auth.role)}</p>
        </div>
        <button type="button" className="ghost" onClick={onLogout}>
          Log out
        </button>
      </header>

      {loading && <p className="notice">Loading store data...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && (
        <section className="grid">
          <ProductPanel
            products={products}
            inventoryByProduct={inventoryByProduct}
            canManageCatalog={canEditCatalog}
            onCreateProduct={handleCreateProduct}
            onUpdateInventory={handleUpdateInventory}
          />
          <OrderPanel products={products} orders={orders} onCreateOrder={handleCreateOrder} />
        </section>
      )}
    </main>
  );
}

import { FormEvent } from "react";

import { Inventory, Product } from "../api/client";

type ProductPanelProps = {
  products: Product[];
  inventoryByProduct: Record<string, Inventory | undefined>;
  canManageCatalog: boolean;
  onCreateProduct: (payload: {
    sku: string;
    name: string;
    description?: string;
    unit_price: number;
  }) => Promise<void>;
  onUpdateInventory: (productId: string, quantity: number, reorderLevel: number) => Promise<void>;
};

export default function ProductPanel({
  products,
  inventoryByProduct,
  canManageCatalog,
  onCreateProduct,
  onUpdateInventory,
}: ProductPanelProps) {
  async function handleCreateProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const sku = String(form.get("sku") ?? "").trim();
    const name = String(form.get("name") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const unitPrice = Number(form.get("unitPrice") ?? 0);

    if (!sku || !name || !unitPrice) {
      return;
    }

    await onCreateProduct({
      sku,
      name,
      description: description || undefined,
      unit_price: unitPrice,
    });

    event.currentTarget.reset();
  }

  async function handleUpdateInventory(event: FormEvent<HTMLFormElement>, productId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const quantity = Number(form.get("quantity") ?? 0);
    const reorder = Number(form.get("reorder") ?? 0);
    await onUpdateInventory(productId, quantity, reorder);
  }

  return (
    <section className="panel">
      <header>
        <h2>Products + Inventory</h2>
      </header>

      {canManageCatalog ? (
        <form className="compact-form" onSubmit={handleCreateProduct}>
          <input name="sku" placeholder="SKU" required />
          <input name="name" placeholder="Product name" required />
          <input name="description" placeholder="Description" />
          <input name="unitPrice" placeholder="Price" type="number" step="0.01" min="0.01" required />
          <button type="submit">Add product</button>
        </form>
      ) : (
        <p className="notice">Staff role has read-only catalog access.</p>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>SKU</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Reorder</th>
              <th>Save</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const inventory = inventoryByProduct[product.id];
              const formId = `inventory-form-${product.id}`;
              return (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{product.sku}</td>
                  <td>{product.unit_price.toFixed(2)}</td>
                  <td>
                    <input
                      className="inline-stock-input"
                      form={formId}
                      name="quantity"
                      type="number"
                      min="0"
                      defaultValue={inventory?.quantity ?? 0}
                      disabled={!canManageCatalog}
                      required
                    />
                  </td>
                  <td>
                    <input
                      className="inline-stock-input"
                      form={formId}
                      name="reorder"
                      type="number"
                      min="0"
                      defaultValue={inventory?.reorder_level ?? 0}
                      disabled={!canManageCatalog}
                      required
                    />
                  </td>
                  <td>
                    <form id={formId} onSubmit={(event) => void handleUpdateInventory(event, product.id)}>
                      <button type="submit" disabled={!canManageCatalog}>
                        Update
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

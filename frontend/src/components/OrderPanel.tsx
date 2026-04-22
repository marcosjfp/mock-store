import { FormEvent } from "react";

import { Order, Product } from "../api/client";

type OrderPanelProps = {
  products: Product[];
  orders: Order[];
  onCreateOrder: (productId: string, quantity: number) => Promise<void>;
};

export default function OrderPanel({ products, orders, onCreateOrder }: OrderPanelProps) {
  async function handleCreateOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const productId = String(form.get("productId") ?? "");
    const quantity = Number(form.get("quantity") ?? 1);

    if (!productId || quantity <= 0) {
      return;
    }

    await onCreateOrder(productId, quantity);
    event.currentTarget.reset();
  }

  return (
    <section className="panel">
      <header>
        <h2>Orders</h2>
      </header>

      <form className="compact-form" onSubmit={handleCreateOrder}>
        <select name="productId" required defaultValue="">
          <option value="" disabled>
            Select product
          </option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
        <input name="quantity" type="number" min="1" defaultValue={1} required />
        <button type="submit">Place order</button>
      </form>

      <ul className="order-list">
        {orders.map((order) => (
          <li key={order.id}>
            <div>
              <strong>{order.id.slice(0, 8)}</strong>
              <span>{order.status}</span>
            </div>
            <div>
              <span>{order.items.length} items</span>
              <strong>{order.total_amount.toFixed(2)}</strong>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

import { describe, expect, it } from "vitest";

import { Product } from "../api/client";
import { cartLines, cartReducer, cartTotal } from "../features/cart";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    tenant_id: "t1",
    sku: "CPU-1",
    name: "Test CPU",
    description: null,
    category: "CPU",
    unit_price: 19.99,
    is_active: true,
    quantity: 3,
    reorder_level: 1,
    stock_status: "in_stock",
    created_at: null,
    ...overrides,
  };
}

describe("cartReducer", () => {
  it("adds one unit at a time and never exceeds stock", () => {
    const item = product({ quantity: 2 });
    let cart = cartReducer({}, { type: "add", product: item });
    cart = cartReducer(cart, { type: "add", product: item });
    cart = cartReducer(cart, { type: "add", product: item });
    expect(cart).toEqual({ p1: 2 });
  });

  it("ignores products that are out of stock", () => {
    expect(cartReducer({}, { type: "add", product: product({ quantity: 0 }) })).toEqual({});
  });

  it("clamps typed quantities and removes a line at zero", () => {
    const item = product();
    expect(cartReducer({}, { type: "set", product: item, quantity: 99 })).toEqual({ p1: 3 });
    expect(cartReducer({ p1: 2 }, { type: "set", product: item, quantity: 0 })).toEqual({});
  });

  it("removes and clears", () => {
    expect(cartReducer({ p1: 1, p2: 4 }, { type: "remove", productId: "p1" })).toEqual({ p2: 4 });
    expect(cartReducer({ p1: 1, p2: 4 }, { type: "clear" })).toEqual({});
  });
});

describe("cart totals", () => {
  it("prices lines against the live catalog without float drift", () => {
    const lines = cartLines({ p1: 3, p2: 1 }, [product(), product({ id: "p2", unit_price: 0.1 })]);
    expect(lines.map((line) => line.lineTotal)).toEqual([59.97, 0.1]);
    expect(cartTotal(lines)).toBe(60.07);
  });

  it("drops archived or missing products", () => {
    const lines = cartLines({ p1: 1, gone: 2 }, [product({ is_active: false })]);
    expect(lines).toEqual([]);
  });
});

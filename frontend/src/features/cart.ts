import { Product } from "../api/client";

/** Cart state: product id → requested quantity. */
export type Cart = Record<string, number>;

export type CartAction =
  | { type: "add"; product: Product }
  | { type: "set"; product: Product; quantity: number }
  | { type: "remove"; productId: string }
  | { type: "clear" };

/** Quantities are always clamped to what is actually in stock. */
export function cartReducer(cart: Cart, action: CartAction): Cart {
  switch (action.type) {
    case "add": {
      const next = Math.min((cart[action.product.id] ?? 0) + 1, action.product.quantity);
      return next > 0 ? { ...cart, [action.product.id]: next } : cart;
    }
    case "set": {
      const next = Math.min(Math.max(0, Math.trunc(action.quantity)), action.product.quantity);
      if (next === 0) {
        const { [action.product.id]: _removed, ...rest } = cart;
        return rest;
      }
      return { ...cart, [action.product.id]: next };
    }
    case "remove": {
      const { [action.productId]: _removed, ...rest } = cart;
      return rest;
    }
    case "clear":
      return {};
  }
}

export type CartLine = { product: Product; quantity: number; lineTotal: number };

/** Resolves cart ids against the live catalog, dropping anything unsellable. */
export function cartLines(cart: Cart, products: Product[]): CartLine[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  return Object.entries(cart).flatMap(([productId, quantity]) => {
    const product = byId.get(productId);
    if (!product || !product.is_active) {
      return [];
    }
    return [{ product, quantity, lineTotal: Math.round(product.unit_price * quantity * 100) / 100 }];
  });
}

export function cartTotal(lines: CartLine[]): number {
  return Math.round(lines.reduce((sum, line) => sum + line.lineTotal, 0) * 100) / 100;
}

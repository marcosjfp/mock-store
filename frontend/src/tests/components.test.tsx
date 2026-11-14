import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StockCell } from "../features/StockCell";
import { validateProduct } from "../features/ProductDrawer";
import { StockHealthBar } from "../components/charts/StockHealthBar";

describe("StockCell", () => {
  afterEach(() => vi.useRealTimers());

  it("commits only the settled value after rapid clicks", () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    render(<StockCell label="stock for CPU" quantity={5} onCommit={onCommit} />);

    const increase = screen.getByRole("button", { name: "Increase stock for CPU" });
    fireEvent.click(increase);
    fireEvent.click(increase);
    fireEvent.click(increase);

    expect(screen.getByRole("spinbutton")).toHaveValue(8);
    expect(onCommit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(600);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(8);
  });

  it("does not commit when the value returns to where it started", () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    render(<StockCell label="stock" quantity={5} onCommit={onCommit} />);

    fireEvent.click(screen.getByRole("button", { name: "Increase stock" }));
    fireEvent.click(screen.getByRole("button", { name: "Decrease stock" }));
    vi.advanceTimersByTime(600);

    expect(onCommit).not.toHaveBeenCalled();
  });
});

describe("validateProduct", () => {
  const valid = { name: "RTX 4070", sku: "GPU-1", category: "GPU", price: "619", description: "", quantity: "4", reorder: "2" };

  it("accepts a complete product", () => {
    expect(validateProduct(valid)).toEqual({});
  });

  it("flags each invalid field", () => {
    const errors = validateProduct({ ...valid, name: " ", sku: "", price: "-1", quantity: "1.5", reorder: "" });
    expect(Object.keys(errors).sort()).toEqual(["name", "price", "quantity", "reorder", "sku"]);
  });
});

describe("StockHealthBar", () => {
  it("labels every state so meaning never depends on colour", () => {
    render(<StockHealthBar inStock={23} lowStock={4} outOfStock={1} />);

    expect(screen.getByRole("img", { name: "23 in stock, 4 low, 1 out of stock" })).toBeInTheDocument();
    expect(screen.getByText("In stock")).toBeInTheDocument();
    expect(screen.getByText("Low")).toBeInTheDocument();
    expect(screen.getByText("Out")).toBeInTheDocument();
  });
});

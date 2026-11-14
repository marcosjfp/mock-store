import { Archive, ArchiveRestore, CircleAlert, ShoppingCart, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Product } from "../api/client";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { ConfirmDialog, Drawer } from "../components/ui/Overlay";
import { StockBadge } from "../components/ui/primitives";
import { useToast } from "../components/ui/Toast";
import { useDeleteProduct, useSaveProduct, useSetProductActive } from "../hooks/queries";
import { CATEGORIES } from "../lib/categories";
import { formatDate, formatMoney } from "../lib/format";

type Draft = {
  name: string;
  sku: string;
  category: string;
  price: string;
  description: string;
  quantity: string;
  reorder: string;
};

const EMPTY: Draft = { name: "", sku: "", category: "CPU", price: "", description: "", quantity: "0", reorder: "5" };

function toDraft(product: Product | null): Draft {
  if (!product) {
    return EMPTY;
  }
  return {
    name: product.name,
    sku: product.sku,
    category: product.category,
    price: product.unit_price.toFixed(2),
    description: product.description ?? "",
    quantity: String(product.quantity),
    reorder: String(product.reorder_level),
  };
}

type Errors = Partial<Record<keyof Draft, string>>;

export function validateProduct(draft: Draft): Errors {
  const errors: Errors = {};
  if (draft.name.trim().length < 2) {
    errors.name = "Give the product a name (at least 2 characters).";
  }
  if (!draft.sku.trim()) {
    errors.sku = "A SKU is required.";
  }
  const price = Number(draft.price);
  if (!draft.price.trim() || !Number.isFinite(price) || price <= 0) {
    errors.price = "Enter a price above zero.";
  }
  for (const key of ["quantity", "reorder"] as const) {
    const value = Number(draft[key]);
    if (draft[key].trim() === "" || !Number.isInteger(value) || value < 0) {
      errors[key] = "Use a whole number, 0 or more.";
    }
  }
  return errors;
}

type ProductDrawerProps = {
  /** `null` with `open` creates a new product. */
  product: Product | null;
  open: boolean;
  canEdit: boolean;
  onClose: () => void;
};

export function ProductDrawer({ product, open, canEdit, onClose }: ProductDrawerProps) {
  const toast = useToast();
  const save = useSaveProduct();
  const setActive = useSetProductActive();
  const remove = useDeleteProduct();

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset the form whenever the drawer opens for a different product.
  useEffect(() => {
    if (open) {
      setDraft(toDraft(product));
      setErrors({});
      setServerError(null);
    }
  }, [open, product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isNew = !product;
  const set = (key: keyof Draft) => (event: { target: { value: string } }) =>
    setDraft((current) => ({ ...current, [key]: event.target.value }));

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateProduct(draft);
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) {
      return;
    }

    const quantity = Number(draft.quantity);
    const reorder_level = Number(draft.reorder);
    save.mutate(
      {
        id: product?.id,
        stockChanged: !product || quantity !== product.quantity || reorder_level !== product.reorder_level,
        values: {
          name: draft.name.trim(),
          sku: draft.sku.trim(),
          category: draft.category,
          unit_price: Number(draft.price),
          description: draft.description.trim() || null,
          quantity,
          reorder_level,
        },
      },
      {
        onSuccess: (saved) => {
          toast.success(isNew ? `${saved.name} added to the catalog` : `${saved.name} updated`);
          onClose();
        },
        onError: (failure) => setServerError(failure.message),
      },
    );
  }

  function toggleArchive() {
    if (!product) {
      return;
    }
    setActive.mutate(
      { id: product.id, is_active: !product.is_active },
      {
        onSuccess: (saved) => {
          toast.success(saved.is_active ? `${saved.name} restored` : `${saved.name} archived`);
          onClose();
        },
        onError: (failure) => toast.error(failure.message),
      },
    );
  }

  function handleDelete() {
    if (!product) {
      return;
    }
    remove.mutate(product.id, {
      onSuccess: () => {
        toast.success(`${product.name} deleted`);
        setConfirmDelete(false);
        onClose();
      },
      onError: (failure) => {
        setConfirmDelete(false);
        setServerError(failure.message);
      },
    });
  }

  const formId = "product-form";

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title={isNew ? "Add product" : canEdit ? "Edit product" : product.name}
        description={
          isNew ? "New products appear in the catalog immediately." : <span className="mono">{product.sku}</span>
        }
        footer={
          canEdit ? (
            <>
              {!isNew && (
                <>
                  <Button
                    variant="ghost"
                    icon={product.is_active ? <Archive /> : <ArchiveRestore />}
                    loading={setActive.isPending}
                    onClick={toggleArchive}
                  >
                    {product.is_active ? "Archive" : "Restore"}
                  </Button>
                  <Button
                    variant="ghost"
                    iconOnly
                    icon={<Trash2 />}
                    aria-label="Delete product"
                    title="Delete product"
                    onClick={() => setConfirmDelete(true)}
                  />
                  <span className="spacer" />
                </>
              )}
              <Button onClick={onClose}>Cancel</Button>
              <Button type="submit" form={formId} variant="primary" loading={save.isPending}>
                {isNew ? "Add product" : "Save changes"}
              </Button>
            </>
          ) : (
            product?.is_active &&
            product.quantity > 0 && (
              <Link to={`/orders/new?add=${product.id}`} className="btn btn-primary">
                <ShoppingCart aria-hidden /> Add to new order
              </Link>
            )
          )
        }
      >
        {canEdit ? (
          <form id={formId} className="form-grid" onSubmit={handleSubmit} noValidate>
            {serverError && (
              <div className="callout" data-tone="critical" role="alert">
                <CircleAlert />
                <span>{serverError}</span>
              </div>
            )}
            {product && !product.is_active && (
              <div className="callout">
                <Archive />
                <span>This product is archived. It is hidden from new orders but kept for order history.</span>
              </div>
            )}

            <Field label="Name" error={errors.name}>
              {(control) => (
                <input {...control} className="input" value={draft.name} onChange={set("name")} maxLength={180} autoFocus={isNew} />
              )}
            </Field>

            <div className="form-row">
              <Field label="SKU" error={errors.sku}>
                {(control) => (
                  <input {...control} className="input mono" value={draft.sku} onChange={set("sku")} maxLength={50} spellCheck={false} />
                )}
              </Field>
              <Field label="Category">
                {(control) => (
                  <select {...control} className="select" value={draft.category} onChange={set("category")}>
                    {CATEGORIES.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                )}
              </Field>
            </div>

            <Field label="Unit price" error={errors.price}>
              {(control) => (
                <div className="input-affix">
                  <span className="affix">$</span>
                  <input {...control} className="input num" inputMode="decimal" value={draft.price} onChange={set("price")} placeholder="0.00" />
                </div>
              )}
            </Field>

            <Field label="Description" hint="Optional. Shown to staff when building an order.">
              {(control) => (
                <textarea {...control} className="textarea" value={draft.description} onChange={set("description")} maxLength={500} rows={3} />
              )}
            </Field>

            <hr className="divider" style={{ margin: "0.25rem 0" }} />
            <h3 className="section-label" style={{ marginBottom: 0 }}>
              Inventory
            </h3>
            <div className="form-row">
              <Field label="Units in stock" error={errors.quantity}>
                {(control) => (
                  <input {...control} className="input num" inputMode="numeric" value={draft.quantity} onChange={set("quantity")} />
                )}
              </Field>
              <Field label="Reorder point" error={errors.reorder} hint="Flagged as low at or below this.">
                {(control) => (
                  <input {...control} className="input num" inputMode="numeric" value={draft.reorder} onChange={set("reorder")} />
                )}
              </Field>
            </div>
          </form>
        ) : (
          product && (
            <>
              {product.description && <p className="secondary" style={{ marginBottom: "1.1rem" }}>{product.description}</p>}
              <dl className="meta-list">
                <dt>Category</dt>
                <dd>{product.category}</dd>
                <dt>Unit price</dt>
                <dd className="num">{formatMoney(product.unit_price)}</dd>
                <dt>Availability</dt>
                <dd>
                  <StockBadge status={product.stock_status} />
                </dd>
                <dt>Units in stock</dt>
                <dd className="num">{product.quantity}</dd>
                <dt>Reorder point</dt>
                <dd className="num">{product.reorder_level}</dd>
                <dt>Added</dt>
                <dd>{formatDate(product.created_at)}</dd>
              </dl>
              <hr className="divider" />
              <p className="muted" style={{ fontSize: "0.8125rem" }}>
                Your role has read-only access to the catalog. Ask a manager to change prices or stock.
              </p>
            </>
          )
        )}
      </Drawer>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${product?.name ?? "product"}?`}
        description="This permanently removes the product and its stock record. Products that appear on orders can’t be deleted — archive them instead."
        confirmLabel="Delete product"
        tone="danger"
        loading={remove.isPending}
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}

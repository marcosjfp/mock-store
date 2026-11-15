import { X } from "lucide-react";
import { ReactNode, useEffect, useRef } from "react";

import { Button } from "./Button";

/**
 * Both overlays are native <dialog> elements opened with showModal(), which
 * gives focus trapping, Escape-to-close, an inert page and a top-layer
 * backdrop without any extra library.
 */
function useModalDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handlers = {
    onCancel: (event: React.SyntheticEvent) => {
      event.preventDefault();
      onClose();
    },
    // A click that lands on the <dialog> itself is a click on the backdrop.
    onMouseDown: (event: React.MouseEvent<HTMLDialogElement>) => {
      if (event.target === ref.current) {
        onClose();
      }
    },
  };

  return { ref, handlers };
}

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  size?: "md" | "lg";
  footer?: ReactNode;
  children: ReactNode;
};

export function Drawer({ open, onClose, title, description, size = "md", footer, children }: DrawerProps) {
  const { ref, handlers } = useModalDialog(open, onClose);

  return (
    <dialog ref={ref} className="drawer" data-size={size} {...handlers}>
      {open && (
        <>
          <header className="drawer-header">
            <div style={{ minWidth: 0 }}>
              <h2>{title}</h2>
              {description && <p>{description}</p>}
            </div>
            <Button variant="ghost" size="sm" iconOnly icon={<X />} aria-label="Close" onClick={onClose} />
          </header>
          <div className="drawer-body">{children}</div>
          {footer && <footer className="drawer-footer">{footer}</footer>}
        </>
      )}
    </dialog>
  );
}

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = "primary",
  loading,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const { ref, handlers } = useModalDialog(open, onClose);

  return (
    <dialog ref={ref} className="modal" {...handlers}>
      {open && (
        <>
          <div className="modal-body">
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          <div className="modal-footer">
            <Button onClick={onClose} disabled={loading}>
              Keep it
            </Button>
            <Button variant={tone} loading={loading} onClick={onConfirm} autoFocus>
              {confirmLabel}
            </Button>
          </div>
        </>
      )}
    </dialog>
  );
}

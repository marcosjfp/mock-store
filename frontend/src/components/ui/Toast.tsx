import { CircleAlert, CircleCheck, X } from "lucide-react";
import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type Tone = "success" | "error";
type ToastItem = { id: number; tone: Tone; message: string };

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);
const LIFETIME_MS = { success: 3500, error: 6000 };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const region = useRef<HTMLDivElement>(null);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone: Tone, message: string) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-3), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), LIFETIME_MS[tone]);
    },
    [dismiss],
  );

  // The region is a manual popover so it renders in the top layer, above any
  // open modal <dialog>. Re-showing it moves it to the top of that stack.
  useEffect(() => {
    const element = region.current as (HTMLDivElement & {
      showPopover?: () => void;
      hidePopover?: () => void;
    }) | null;
    if (!element?.showPopover || toasts.length === 0) {
      return;
    }
    try {
      if (element.matches(":popover-open")) {
        element.hidePopover?.();
      }
      element.showPopover();
    } catch {
      // Popover API unavailable — the fixed-position fallback still works.
    }
  }, [toasts]);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push("success", message),
      error: (message) => push("error", message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        ref={region}
        className="toasts"
        role="status"
        aria-live="polite"
        {...{ popover: "manual" }}
      >
        {toasts.map((toast) => (
          <div key={toast.id} className="toast" data-tone={toast.tone}>
            {toast.tone === "success" ? <CircleCheck /> : <CircleAlert />}
            <p>{toast.message}</p>
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(toast.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

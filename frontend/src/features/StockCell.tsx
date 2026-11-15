import { useEffect, useRef, useState } from "react";

import { Stepper } from "../components/ui/primitives";

const COMMIT_DELAY_MS = 500;

/**
 * Inline stock editor. Clicks and keystrokes update the number immediately,
 * but only the value you settle on is sent — so "+ + +" is one request and
 * one audit entry, not three.
 */
export function StockCell({
  label,
  quantity,
  onCommit,
}: {
  label: string;
  quantity: number;
  onCommit: (quantity: number) => void;
}) {
  const [value, setValue] = useState(quantity);
  const timer = useRef<number>();
  const dirty = useRef(false);

  // Follow the server value unless the user is mid-edit.
  useEffect(() => {
    if (!dirty.current) {
      setValue(quantity);
    }
  }, [quantity]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function handleChange(next: number) {
    setValue(next);
    dirty.current = true;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      dirty.current = false;
      if (next !== quantity) {
        onCommit(next);
      }
    }, COMMIT_DELAY_MS);
  }

  return <Stepper label={label} value={value} onChange={handleChange} />;
}

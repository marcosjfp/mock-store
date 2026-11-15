import { ReactNode, useId } from "react";

type FieldProps = {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  /** Receives the id and aria wiring for the control. */
  children: (control: {
    id: string;
    "aria-invalid"?: true;
    "aria-describedby"?: string;
  }) => ReactNode;
};

/** Label + control + hint/error, wired together for assistive tech. */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": note ? noteId : undefined,
      })}
      {note && (
        <span id={noteId} className={error ? "field-error" : "field-hint"} role={error ? "alert" : undefined}>
          {note}
        </span>
      )}
    </div>
  );
}

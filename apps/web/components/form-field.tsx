import { useId, type ReactNode } from "react";

export function FormField({
  label,
  help,
  error,
  children,
}: {
  label: string;
  help?: string;
  error?: string;
  children: (inputProps: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
}) {
  const id = useId();
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-[var(--color-fg-primary)]">
        {label}
      </label>
      {help && (
        <p id={helpId} className="mt-0.5 text-xs text-[var(--color-fg-muted)]">
          {help}
        </p>
      )}
      <div className="mt-1.5">
        {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-[var(--color-status-down)]">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClassName =
  "w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2 font-mono text-sm text-[var(--color-fg-primary)] placeholder:text-[var(--color-fg-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-accent)]";

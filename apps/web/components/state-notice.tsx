import type { ReactNode } from "react";

/**
 * Three deliberately different states for a region of data. They are never
 * interchangeable: empty means the source answered and there is nothing,
 * unavailable means the source could not be asked, loading means it has not
 * answered yet.
 */

export function LoadingState({ label, lines = 3 }: { label: string; lines?: number }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div aria-hidden className="space-y-2">
        {Array.from({ length: lines }, (_, index) => (
          <div
            key={index}
            className="h-4 animate-pulse rounded bg-[var(--color-bg-raised)]"
            style={{ width: `${index === lines - 1 ? 55 : 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--color-border-default)] px-4 py-6 text-center">
      <p className="text-sm font-medium text-[var(--color-fg-primary)]">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-[var(--color-fg-muted)]">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function UnavailableState({
  title,
  message,
  children,
  tone = "unavailable",
}: {
  title: string;
  /** What went wrong, in the user's terms. */
  message: string;
  /** What still works or what to do next. */
  children?: ReactNode;
  /** `error` is for a failure the user can act on; `unavailable` for a backend that did not answer. */
  tone?: "unavailable" | "error";
}) {
  const color = tone === "error" ? "var(--color-status-down)" : "var(--color-status-pending)";
  const background = tone === "error" ? "var(--color-status-down-bg)" : "var(--color-status-pending-bg)";
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className="rounded-lg border px-4 py-3 text-sm"
      style={{ borderColor: color, backgroundColor: background }}
    >
      <p className="font-medium" style={{ color }}>
        {title}
      </p>
      <p className="mt-1 text-[var(--color-fg-secondary)]">{message}</p>
      {children && <div className="mt-2 text-[var(--color-fg-secondary)]">{children}</div>}
    </div>
  );
}

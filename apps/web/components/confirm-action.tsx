"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * A button that opens an inline confirmation before anything is sent to the
 * wallet. The confirmation says what the action does, and the user must
 * choose to continue. It is not a native confirm() dialog, so it cannot block
 * the page, and Escape or "Keep" closes it without side effects.
 */
export function ConfirmAction({
  label,
  title,
  children,
  confirmLabel,
  cancelLabel = "Go back",
  onConfirm,
  disabled,
  tone = "default",
}: {
  label: string;
  title: string;
  /** What the action does and does not do. Shown before the user confirms. */
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // Move focus into the confirmation when it opens, and back to the trigger
  // when it closes, so keyboard users never lose their place.
  useEffect(() => {
    if (open) {
      panelRef.current?.focus();
    } else if (wasOpen.current) {
      triggerRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  const accent = tone === "danger" ? "var(--color-status-down)" : "var(--color-accent)";
  const focusRing =
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]";

  if (!open) {
    return (
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="true"
        onClick={() => setOpen(true)}
        className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${focusRing} ${
          tone === "danger"
            ? "border-[var(--color-status-down)] text-[var(--color-status-down)]"
            : "border-[var(--color-border-default)] text-[var(--color-fg-primary)] hover:border-[var(--color-border-strong)]"
        }`}
      >
        {label}
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      role="group"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
      className="animate-fade-in-up w-full max-w-xl rounded-lg border bg-[var(--color-bg-raised)] p-4 focus:outline-none"
      style={{ borderColor: accent }}
    >
      <p id={titleId} className="text-sm font-semibold text-[var(--color-fg-primary)]">
        {title}
      </p>
      <div className="mt-2 space-y-2 text-sm text-[var(--color-fg-secondary)]">{children}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            onConfirm();
          }}
          className={`rounded-md px-3 py-2 text-sm font-medium text-[var(--color-accent-fg)] transition-opacity hover:opacity-90 ${focusRing}`}
          style={{ backgroundColor: accent }}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={`rounded-md border border-[var(--color-border-default)] px-3 py-2 text-sm font-medium text-[var(--color-fg-secondary)] hover:text-[var(--color-fg-primary)] ${focusRing}`}
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}

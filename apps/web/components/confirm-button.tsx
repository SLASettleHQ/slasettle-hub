"use client";

import { useEffect, useState } from "react";

/**
 * A button that requires a second click within a few seconds to actually
 * fire `onConfirm`, for actions worth a deliberate second look (cancel,
 * withdraw) without resorting to a blocking native confirm() dialog.
 */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  disabled,
  tone = "default",
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
}) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timeout = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(timeout);
  }, [confirming]);

  const dangerClasses =
    tone === "danger"
      ? "border-[var(--color-status-down)] text-[var(--color-status-down)]"
      : "border-[var(--color-border-default)] text-[var(--color-fg-primary)] hover:border-[var(--color-border-strong)]";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (confirming) {
          setConfirming(false);
          onConfirm();
        } else {
          setConfirming(true);
        }
      }}
      className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${dangerClasses}`}
    >
      {confirming ? confirmLabel : label}
    </button>
  );
}

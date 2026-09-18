"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";

export function SlaLookupForm() {
  const router = useRouter();
  const inputId = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
      setError("Enter a numeric SLA ID, e.g. 42.");
      return;
    }
    setError(null);
    router.push(`/status/${trimmed}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="flex-1">
        <label htmlFor={inputId} className="sr-only">
          SLA ID
        </label>
        <input
          id={inputId}
          name="slaId"
          inputMode="numeric"
          placeholder="SLA ID, e.g. 42"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className="w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2 font-mono text-sm text-[var(--color-fg-primary)] placeholder:text-[var(--color-fg-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-accent)]"
        />
        {error && (
          <p id={`${inputId}-error`} role="alert" className="mt-1 text-xs text-[var(--color-status-down)]">
            {error}
          </p>
        )}
      </div>
      <button
        type="submit"
        className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-2 text-sm font-medium text-[var(--color-fg-primary)] transition-colors hover:border-[var(--color-border-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-accent)]"
      >
        View status
      </button>
    </form>
  );
}

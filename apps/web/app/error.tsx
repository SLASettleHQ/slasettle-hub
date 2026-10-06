"use client";

import Link from "next/link";
import { useEffect } from "react";

// In this Next.js version the recovery callback is `retry`, not `reset`.
export default function RouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-16" role="alert">
      <h1 className="text-xl font-semibold text-[var(--color-fg-primary)]">This page failed to render</h1>
      <p className="mt-3 text-[var(--color-fg-secondary)]">
        The page hit an unexpected error while rendering. Nothing was sent to your wallet. Retrying re-renders
        the page; if it keeps failing, reload it or return to the overview.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-[var(--color-fg-muted)]">Reference: {error.digest}</p>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)] transition-opacity hover:opacity-90"
        >
          Retry
        </button>
        <Link
          href="/"
          className="rounded-md border border-[var(--color-border-default)] px-4 py-2 text-sm font-medium text-[var(--color-fg-primary)]"
        >
          Back to overview
        </Link>
      </div>
    </div>
  );
}

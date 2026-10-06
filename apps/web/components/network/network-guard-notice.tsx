"use client";

import type { NetworkGuard } from "./use-network-guard";

export function NetworkGuardNotice({ guard }: { guard: NetworkGuard }) {
  if (!guard.blocked) return null;
  return (
    <p role="alert" className="text-sm text-[var(--color-status-pending)]">
      {guard.message}
    </p>
  );
}

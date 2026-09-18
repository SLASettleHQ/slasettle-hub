"use client";

import { useState } from "react";
import { truncateAddress } from "@/lib/format";
import { useWallet } from "./wallet-provider";

export function WalletPanel({ onClose }: { onClose: () => void }) {
  const { connection, disconnect } = useWallet();
  const [copied, setCopied] = useState(false);

  if (!connection) {
    return null;
  }

  async function copyAddress() {
    if (!connection) return;
    try {
      await navigator.clipboard.writeText(connection.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied; the address is still visible to copy manually.
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Wallet"
      className="animate-dropdown-in absolute right-0 top-full z-20 mt-2 w-72 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-raised)] p-3 shadow-[var(--shadow-raised)]"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-fg-muted)]">
          Connected address
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-status-up-bg)] px-2 py-0.5 text-xs font-medium text-[var(--color-status-up)]">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
          Connected
        </span>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2 font-mono text-sm text-[var(--color-fg-primary)]">
        <span title={connection.address}>{truncateAddress(connection.address, 6)}</span>
        <button
          type="button"
          onClick={copyAddress}
          className="shrink-0 rounded border border-[var(--color-border-default)] px-2 py-1 text-xs font-sans text-[var(--color-fg-secondary)] transition-colors hover:text-[var(--color-fg-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-accent)]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <dl className="mt-3 space-y-1 border-t border-[var(--color-border-subtle)] pt-3 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-[var(--color-fg-muted)]">Network</dt>
          <dd className="text-[var(--color-fg-secondary)]">{connection.network}</dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={() => {
          disconnect();
          onClose();
        }}
        className="mt-3 w-full rounded-md border border-[var(--color-border-default)] py-1.5 text-xs font-medium text-[var(--color-fg-secondary)] transition-colors hover:border-[var(--color-status-down)] hover:text-[var(--color-status-down)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-accent)]"
      >
        Disconnect
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { truncateAddress } from "@/lib/format";
import { explorerTxUrl } from "@/lib/network";

export function TransactionEvidence({ transactionHash }: { transactionHash: string }) {
  // Built locally from the hash for the configured network, not taken from
  // the indexer's `explorer_url`, so a bad response cannot choose the link.
  const explorerUrl = explorerTxUrl(transactionHash);
  const [copied, setCopied] = useState(false);

  async function copyHash() {
    try {
      await navigator.clipboard.writeText(transactionHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied; the hash is still visible to copy manually.
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs text-[var(--color-fg-secondary)]" title={transactionHash}>
        {truncateAddress(transactionHash, 6)}
      </span>
      <button
        type="button"
        onClick={copyHash}
        className="rounded border border-[var(--color-border-default)] px-1.5 py-0.5 text-[11px] text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-accent)]"
      >
        {copied ? "Copied" : "Copy"}
      </button>
      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] font-medium text-[var(--color-accent)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-accent)]"
        >
          View on explorer
        </a>
      )}
    </div>
  );
}

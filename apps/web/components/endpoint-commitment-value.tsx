"use client";

import { useState } from "react";
import { endpointHashToHex } from "@/lib/endpoint-commitment";

export function EndpointCommitmentValue({ endpointHash }: { endpointHash: Uint8Array }) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const hex = endpointHashToHex(endpointHash);

  async function copyCommitment() {
    try {
      await navigator.clipboard.writeText(hex);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  return (
    <div className="flex min-w-0 flex-wrap items-start gap-2">
      <code className="min-w-0 flex-1 break-all text-xs text-[var(--color-fg-primary)]" title={hex}>
        {hex}
      </code>
      <button
        type="button"
        onClick={() => void copyCommitment()}
        className="shrink-0 rounded-md border border-[var(--color-border-default)] px-2 py-1 text-xs font-medium text-[var(--color-fg-secondary)] hover:text-[var(--color-fg-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        aria-label="Copy endpoint commitment"
      >
        Copy
      </button>
      {copyStatus !== "idle" && (
        <span className="sr-only" role="status" aria-live="polite">
          {copyStatus === "copied" ? "Endpoint commitment copied." : "Could not copy endpoint commitment."}
        </span>
      )}
    </div>
  );
}

import { truncateAddress } from "@/lib/format";
import { explorerTxUrl } from "@/lib/network";
import type { TransactionState } from "@/lib/use-transaction";

export function TransactionStatus({ state }: { state: TransactionState }) {
  if (state.status === "idle") {
    return null;
  }

  if (state.status === "building" || state.status === "signing" || state.status === "submitting") {
    const label =
      state.status === "building"
        ? "Preparing transaction…"
        : state.status === "signing"
          ? "Waiting for signature in your wallet…"
          : "Submitting to the network…";
    return (
      <p role="status" className="text-sm text-[var(--color-fg-secondary)]">
        {label}
      </p>
    );
  }

  if (state.status === "confirmed") {
    const explorerUrl = explorerTxUrl(state.hash);
    return (
      <p role="status" className="animate-fade-in-up text-sm text-[var(--color-status-up)]">
        Confirmed &mdash;{" "}
        {explorerUrl ? (
          <a href={explorerUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            {truncateAddress(state.hash, 6)}
          </a>
        ) : (
          <span className="font-mono">{truncateAddress(state.hash, 6)}</span>
        )}
      </p>
    );
  }

  return (
    <p role="alert" className="text-sm text-[var(--color-status-down)]">
      {state.message}
      {state.hash && ` (tx ${truncateAddress(state.hash, 6)})`}
    </p>
  );
}

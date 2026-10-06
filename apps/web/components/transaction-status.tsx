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

  if (state.status === "pending") {
    return (
      <p role="status" className="text-sm text-[var(--color-status-pending)]">
        Pending confirmation. <HashLink hash={state.hash} />
      </p>
    );
  }

  if (state.status === "confirmed") {
    return (
      <p role="status" className="animate-fade-in-up text-sm text-[var(--color-status-up)]">
        Confirmed. <HashLink hash={state.hash} />
      </p>
    );
  }

  if (state.status === "rejected") {
    return (
      <p role="status" className="text-sm text-[var(--color-fg-secondary)]">
        Rejected. {state.message}
      </p>
    );
  }

  if (state.status === "unconfirmed") {
    return (
      <p role="alert" className="text-sm text-[var(--color-status-pending)]">
        Not yet confirmed. {state.message} <HashLink hash={state.hash} />
      </p>
    );
  }

  return (
    <p role="alert" className="text-sm text-[var(--color-status-down)]">
      Failed. {state.message}
      {state.hash && (
        <>
          {" "}
          <HashLink hash={state.hash} />
        </>
      )}
    </p>
  );
}

function HashLink({ hash }: { hash: string }) {
  const explorerUrl = explorerTxUrl(hash);
  return explorerUrl ? (
    <a href={explorerUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
      {truncateAddress(hash, 6)}
    </a>
  ) : (
    <span className="font-mono">{truncateAddress(hash, 6)}</span>
  );
}

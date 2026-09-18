"use client";

import { buildTriggerSettlementTx } from "@slasettle/sdk";
import { TransactionStatus } from "@/components/transaction-status";
import { useWallet } from "@/components/wallet/wallet-provider";
import { useTransaction } from "@/lib/use-transaction";

/**
 * Anyone can call trigger_settlement once quorum is reached — the contract
 * has no provider-only auth on this function. A wallet is only needed to
 * sign this specific call, not to view the page.
 */
export function TriggerSettlementAction({
  slaId,
  roundId,
  onSettled,
}: {
  slaId: bigint;
  roundId: bigint;
  onSettled?: () => void;
}) {
  const { status, connection, connect } = useWallet();
  const { state, run } = useTransaction();

  const busy = state.status === "building" || state.status === "signing" || state.status === "submitting";

  async function handleTrigger() {
    if (!connection) return;
    const result = await run(
      async () => buildTriggerSettlementTx({ caller: connection.address, slaId, roundId }),
      connection,
    );
    if (result?.status === "SUCCESS") {
      onSettled?.();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {connection ? (
        <button
          type="button"
          onClick={() => void handleTrigger()}
          disabled={busy}
          className="rounded-md bg-[var(--color-accent)] px-3 py-2 text-sm font-medium text-[var(--color-accent-fg)] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          Trigger Settlement
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void connect()}
          disabled={status === "checking" || status === "connecting" || status === "unavailable"}
          className="rounded-md border border-[var(--color-border-default)] px-3 py-2 text-sm font-medium text-[var(--color-fg-primary)] transition-colors hover:border-[var(--color-border-strong)] disabled:opacity-60"
        >
          Connect wallet to trigger settlement
        </button>
      )}
      <TransactionStatus state={state} />
    </div>
  );
}

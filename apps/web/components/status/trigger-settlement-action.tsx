"use client";

import { buildTriggerSettlementTx } from "@slasettle/sdk";
import { NetworkGuardNotice } from "@/components/network/network-guard-notice";
import { useNetworkGuard } from "@/components/network/use-network-guard";
import { TokenAmount } from "@/components/token-amount";
import { TransactionStatus } from "@/components/transaction-status";
import { useWallet } from "@/components/wallet/wallet-provider";
import { isTransactionBusy, useTransaction } from "@/lib/use-transaction";

/**
 * Anyone can call trigger_settlement once quorum is reached — the contract
 * has no provider-only auth on this function. A wallet is only needed to
 * sign this specific call, not to view the page.
 */
export function TriggerSettlementAction({
  slaId,
  roundId,
  votesDown,
  quorumThreshold,
  penaltyPerBreach,
  tokenDecimals,
  tokenSymbol,
  onSettled,
}: {
  slaId: bigint;
  roundId: bigint;
  votesDown: number;
  quorumThreshold: number;
  penaltyPerBreach: bigint;
  tokenDecimals: number;
  tokenSymbol: string;
  onSettled?: () => void;
}) {
  const { status, connection, connect } = useWallet();
  const { state, run } = useTransaction();
  const guard = useNetworkGuard();

  const busy = isTransactionBusy(state);

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
    <div>
      <p className="text-sm font-medium text-[var(--color-fg-primary)]">Settlement can be triggered</p>
      <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-[var(--color-fg-muted)]">Round</dt>
          <dd className="font-mono">{roundId.toString()}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-fg-muted)]">Down votes</dt>
          <dd className="font-mono">
            {votesDown} of {quorumThreshold} required
          </dd>
        </div>
        <div>
          <dt className="text-[var(--color-fg-muted)]">Penalty per breach</dt>
          <dd>
            <TokenAmount amount={penaltyPerBreach} decimals={tokenDecimals} symbol={tokenSymbol} />
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-[var(--color-fg-muted)]">
        Any connected wallet can submit this. It does not need to be the provider, the beneficiary or a
        watcher. The wallet that submits it signs the transaction and pays the network fee.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {connection ? (
          <button
            type="button"
            onClick={() => void handleTrigger()}
            disabled={busy || guard.blocked}
            className="rounded-md bg-[var(--color-accent)] px-3 py-2 text-sm font-medium text-[var(--color-accent-fg)] transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            Trigger settlement for round {roundId.toString()}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void connect()}
            disabled={status === "checking" || status === "connecting" || status === "unavailable"}
            className="rounded-md border border-[var(--color-border-default)] px-3 py-2 text-sm font-medium text-[var(--color-fg-primary)] transition-colors hover:border-[var(--color-border-strong)] disabled:opacity-60"
          >
            {status === "unavailable" ? "Install Freighter to trigger settlement" : "Connect wallet to trigger settlement"}
          </button>
        )}
        <NetworkGuardNotice guard={guard} />
        <TransactionStatus state={state} />
      </div>
    </div>
  );
}

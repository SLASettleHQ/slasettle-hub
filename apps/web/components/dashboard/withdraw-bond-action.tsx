"use client";

import { buildWithdrawBondTx } from "@slasettle/sdk";
import { ConfirmAction } from "@/components/confirm-action";
import { NetworkGuardNotice } from "@/components/network/network-guard-notice";
import { useNetworkGuard } from "@/components/network/use-network-guard";
import { TokenAmount } from "@/components/token-amount";
import { TransactionStatus } from "@/components/transaction-status";
import { useWallet } from "@/components/wallet/wallet-provider";
import { isTransactionBusy, useTransaction } from "@/lib/use-transaction";

/**
 * Only rendered for a cancelled SLA, because the contract allows withdrawal
 * only after cancellation. When nothing remains in the bond there is nothing
 * to withdraw, so the action is replaced by a statement rather than a button
 * that would only fail.
 */
export function WithdrawBondAction({
  slaId,
  bondBalance,
  tokenDecimals,
  tokenSymbol,
  onSuccess,
}: {
  slaId: bigint;
  bondBalance: bigint;
  tokenDecimals: number;
  tokenSymbol: string;
  onSuccess?: () => void;
}) {
  const { connection } = useWallet();
  const { state, run } = useTransaction();
  const guard = useNetworkGuard();

  const busy = isTransactionBusy(state);

  async function handleWithdraw() {
    if (!connection) return;
    const result = await run(
      async () => buildWithdrawBondTx({ caller: connection.address, slaId }),
      connection,
    );
    if (result?.status === "SUCCESS") {
      onSuccess?.();
    }
  }

  // Nothing left to withdraw: never offer the button. After this component's
  // own withdrawal confirms, the balance reads zero, and the confirmation (hash
  // and explorer link) stays visible next to the statement.
  if (bondBalance === 0n) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-[var(--color-fg-muted)]">
          This SLA is cancelled and no bond remains, so there is nothing to withdraw.
        </p>
        <TransactionStatus state={state} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ConfirmAction
        label="Withdraw remaining bond"
        title={`Withdraw the remaining bond of SLA #${slaId.toString()}?`}
        confirmLabel="Sign and withdraw"
        disabled={busy || !connection || guard.blocked}
        onConfirm={() => void handleWithdraw()}
      >
        <p>
          The bond currently holds{" "}
          <TokenAmount amount={bondBalance} decimals={tokenDecimals} symbol={tokenSymbol} />. This
          transaction withdraws what remains in the bond.
        </p>
        <p>
          The SLA was cancelled in an earlier, separate transaction. Cancelling and withdrawing are different
          operations.
        </p>
      </ConfirmAction>
      <NetworkGuardNotice guard={guard} />
      <TransactionStatus state={state} />
    </div>
  );
}

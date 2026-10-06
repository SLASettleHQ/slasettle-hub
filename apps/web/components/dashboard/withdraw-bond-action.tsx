"use client";

import { buildWithdrawBondTx } from "@slasettle/sdk";
import { ConfirmButton } from "@/components/confirm-button";
import { NetworkGuardNotice } from "@/components/network/network-guard-notice";
import { useNetworkGuard } from "@/components/network/use-network-guard";
import { TransactionStatus } from "@/components/transaction-status";
import { useWallet } from "@/components/wallet/wallet-provider";
import { isTransactionBusy, useTransaction } from "@/lib/use-transaction";

export function WithdrawBondAction({ slaId, onSuccess }: { slaId: bigint; onSuccess?: () => void }) {
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ConfirmButton
        label="Withdraw Bond"
        confirmLabel="Click again to confirm"
        disabled={busy || !connection || guard.blocked}
        onConfirm={() => void handleWithdraw()}
      />
      <NetworkGuardNotice guard={guard} />
      <TransactionStatus state={state} />
    </div>
  );
}

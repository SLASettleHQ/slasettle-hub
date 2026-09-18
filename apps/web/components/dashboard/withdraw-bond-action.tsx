"use client";

import { buildWithdrawBondTx } from "@slasettle/sdk";
import { ConfirmButton } from "@/components/confirm-button";
import { TransactionStatus } from "@/components/transaction-status";
import { useWallet } from "@/components/wallet/wallet-provider";
import { useTransaction } from "@/lib/use-transaction";

export function WithdrawBondAction({ slaId, onSuccess }: { slaId: bigint; onSuccess?: () => void }) {
  const { connection } = useWallet();
  const { state, run } = useTransaction();

  const busy = state.status === "building" || state.status === "signing" || state.status === "submitting";

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
        disabled={busy || !connection}
        onConfirm={() => void handleWithdraw()}
      />
      <TransactionStatus state={state} />
    </div>
  );
}

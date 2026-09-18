"use client";

import { buildCancelSlaTx } from "@slasettle/sdk";
import { ConfirmButton } from "@/components/confirm-button";
import { TransactionStatus } from "@/components/transaction-status";
import { useWallet } from "@/components/wallet/wallet-provider";
import { useTransaction } from "@/lib/use-transaction";

export function CancelSlaAction({ slaId, onSuccess }: { slaId: bigint; onSuccess?: () => void }) {
  const { connection } = useWallet();
  const { state, run } = useTransaction();

  const busy = state.status === "building" || state.status === "signing" || state.status === "submitting";

  async function handleCancel() {
    if (!connection) return;
    const result = await run(
      async () => buildCancelSlaTx({ caller: connection.address, slaId }),
      connection,
    );
    if (result?.status === "SUCCESS") {
      onSuccess?.();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ConfirmButton
        label="Cancel SLA"
        confirmLabel="Click again to confirm"
        tone="danger"
        disabled={busy || !connection}
        onConfirm={() => void handleCancel()}
      />
      <TransactionStatus state={state} />
    </div>
  );
}

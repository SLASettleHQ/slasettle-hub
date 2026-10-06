"use client";

import { buildCancelSlaTx } from "@slasettle/sdk";
import { ConfirmButton } from "@/components/confirm-button";
import { NetworkGuardNotice } from "@/components/network/network-guard-notice";
import { useNetworkGuard } from "@/components/network/use-network-guard";
import { TransactionStatus } from "@/components/transaction-status";
import { useWallet } from "@/components/wallet/wallet-provider";
import { isTransactionBusy, useTransaction } from "@/lib/use-transaction";

export function CancelSlaAction({ slaId, onSuccess }: { slaId: bigint; onSuccess?: () => void }) {
  const { connection } = useWallet();
  const { state, run } = useTransaction();
  const guard = useNetworkGuard();

  const busy = isTransactionBusy(state);

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
        disabled={busy || !connection || guard.blocked}
        onConfirm={() => void handleCancel()}
      />
      <NetworkGuardNotice guard={guard} />
      <TransactionStatus state={state} />
    </div>
  );
}

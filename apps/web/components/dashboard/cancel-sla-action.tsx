"use client";

import { buildCancelSlaTx } from "@slasettle/sdk";
import { ConfirmAction } from "@/components/confirm-action";
import { NetworkGuardNotice } from "@/components/network/network-guard-notice";
import { useNetworkGuard } from "@/components/network/use-network-guard";
import { TransactionStatus } from "@/components/transaction-status";
import { useWallet } from "@/components/wallet/wallet-provider";
import { isTransactionBusy, useTransaction } from "@/lib/use-transaction";
import type { SubmittedTransaction } from "@/lib/wallet";

export function CancelSlaAction({ slaId, onSuccess }: { slaId: bigint; onSuccess?: (result: SubmittedTransaction) => void }) {
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
      onSuccess?.(result);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ConfirmAction
        label="Cancel SLA"
        title={`Cancel SLA #${slaId.toString()}?`}
        confirmLabel="Sign and cancel"
        cancelLabel="Keep SLA active"
        tone="danger"
        disabled={busy || !connection || guard.blocked}
        onConfirm={() => void handleCancel()}
      >
        <p>This changes the SLA&apos;s status to Cancelled. A cancelled SLA can no longer be settled or topped up.</p>
        <p>
          Cancelling does not withdraw the bond. Withdrawing the remaining bond is a separate transaction that
          becomes available after cancellation.
        </p>
        <p>You will be asked to sign one transaction in your wallet.</p>
      </ConfirmAction>
      <NetworkGuardNotice guard={guard} />
      <TransactionStatus state={state} />
    </div>
  );
}
